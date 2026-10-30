'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { limitError } from '@/lib/appLimits'
import {
  DATE_RE,
  DEFAULT_DAILY_HOURS,
  DEFAULT_WEEKLY_HOURS,
  PLACE_COLORS,
  REGISTRO_LIMITS,
  TIME_RE,
  addDays,
  endAfter,
  nowToMinute,
  parseDecimal,
  romeLocalToMs,
  romeParts,
  romeToday,
  shiftTimes,
  type WorkPlace,
  type WorkShift,
} from '@/lib/registroOre'

// Registro ore e turni: proprietario e piano li controlla anche il database
// (RLS di work_places e work_shifts, chiave esterna doppia posto/persona);
// qui validazione dei campi e passaggio da «giorno + ora» italiani a istanti.

type ActionResult<T> = { success: true; data: T } | { success: false; message: string; limitText?: string }

const TOOL = 'registro-ore'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_RE = /^#[0-9a-f]{6}$/i
const HOUR = 3_600_000
const MINUTE = 60_000
const PLACE_COLS = 'id, name, color, hourly_rate, daily_hours, weekly_hours'
const SHIFT_COLS = 'id, place_id, work_date, starts_at, ends_at, break_minutes, is_holiday, is_night, notes'

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, TOOL))) return null
  return { supabase, userId: user.id }
}

// I numeri del database possono arrivare come testo: qui diventano numeri
function toPlace(row: Record<string, unknown>): WorkPlace {
  return {
    id: String(row.id),
    name: String(row.name),
    color: String(row.color),
    hourly_rate: row.hourly_rate === null || row.hourly_rate === undefined ? null : Number(row.hourly_rate),
    daily_hours: Number(row.daily_hours),
    weekly_hours: Number(row.weekly_hours),
  }
}

function toShift(row: Record<string, unknown>): WorkShift {
  return {
    id: String(row.id),
    place_id: String(row.place_id),
    work_date: String(row.work_date),
    starts_at: new Date(String(row.starts_at)).toISOString(),
    ends_at: row.ends_at ? new Date(String(row.ends_at)).toISOString() : null,
    break_minutes: Number(row.break_minutes) || 0,
    is_holiday: !!row.is_holiday,
    is_night: !!row.is_night,
    notes: (row.notes as string | null) ?? null,
  }
}

function dbError(error: { code?: string; message?: string }): string {
  if (error.code === '23505') return 'alreadyOpen'
  if (error.code === '23503') return 'noPlace'
  if (error.code === '23514') return 'invalid'
  return 'saveError'
}

// ─── Lettura ──────────────────────────────────────────────────────────────

export type RegistroInitial = {
  places: WorkPlace[]
  shifts: WorkShift[]
  open: WorkShift | null
  personName: string
}

export async function listPlaces(): Promise<WorkPlace[]> {
  const g = await gate()
  if (!g) return []
  const { data } = await g.supabase.from('work_places').select(PLACE_COLS).order('created_at')
  return (data ?? []).map(toPlace)
}

/** Turni con giorno compreso fra from e to (inclusi). */
export async function listShifts(from: string, to: string): Promise<WorkShift[]> {
  const g = await gate()
  if (!g || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) return []
  // Al massimo un paio di mesi per volta
  if (Date.parse(to) - Date.parse(from) > 70 * 24 * HOUR) return []
  const { data } = await g.supabase
    .from('work_shifts')
    .select(SHIFT_COLS)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('starts_at')
    .limit(2000)
  return (data ?? []).map(toShift)
}

export async function getOpenShift(): Promise<WorkShift | null> {
  const g = await gate()
  if (!g) return null
  const { data } = await g.supabase.from('work_shifts').select(SHIFT_COLS).is('ends_at', null).maybeSingle()
  return data ? toShift(data) : null
}

export async function getRegistroInitial(from: string, to: string): Promise<RegistroInitial> {
  const g = await gate()
  if (!g) return { places: [], shifts: [], open: null, personName: '' }
  const [places, shifts, open, { data: me }] = await Promise.all([
    listPlaces(),
    listShifts(from, to),
    getOpenShift(),
    g.supabase.from('profiles').select('first_name, last_name').eq('id', g.userId).maybeSingle(),
  ])
  const personName = [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim()
  return { places, shifts, open, personName }
}

// ─── Posti di lavoro ──────────────────────────────────────────────────────

export type PlaceInput = {
  id?: string | null
  name: string
  color: string
  hourlyRate: string
  dailyHours: string
  weeklyHours: string
}

export async function savePlace(input: PlaceInput): Promise<ActionResult<WorkPlace>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const name = clip(input.name, REGISTRO_LIMITS.placeName)
  if (!name) return { success: false, message: 'nameRequired' }
  const color = HEX_RE.test(input.color) ? input.color : PLACE_COLORS[0]
  const rate = parseDecimal(input.hourlyRate)
  const daily = parseDecimal(input.dailyHours) ?? DEFAULT_DAILY_HOURS
  const weekly = parseDecimal(input.weeklyHours) ?? DEFAULT_WEEKLY_HOURS
  if (rate !== null && (Number.isNaN(rate) || rate < 0 || rate > 1000)) return { success: false, message: 'rate' }
  if (Number.isNaN(daily) || daily < 1 || daily > 24) return { success: false, message: 'dailyHours' }
  if (Number.isNaN(weekly) || weekly < 1 || weekly > 168) return { success: false, message: 'weeklyHours' }
  const fields = {
    name,
    color,
    hourly_rate: rate === null ? null : Math.round(rate * 100) / 100,
    daily_hours: Math.round(daily * 100) / 100,
    weekly_hours: Math.round(weekly * 100) / 100,
  }

  if (input.id) {
    if (!UUID_RE.test(input.id)) return { success: false, message: 'invalid' }
    const { data, error } = await g.supabase.from('work_places').update(fields).eq('id', input.id).select(PLACE_COLS).maybeSingle()
    if (error || !data) {
      if (error) console.error('[RegistroOre] update place failed:', error)
      return { success: false, message: error ? dbError(error) : 'notFound' }
    }
    return { success: true, data: toPlace(data) }
  }

  const { data, error } = await g.supabase
    .from('work_places')
    .insert({ user_id: g.userId, ...fields })
    .select(PLACE_COLS)
    .single()
  if (error || !data) {
    console.error('[RegistroOre] create place failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: error ? dbError(error) : 'saveError' }
  }
  return { success: true, data: toPlace(data) }
}

/** Cancella il posto e tutti i suoi turni. */
export async function deletePlace(id: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(id)) return { success: false, message: 'invalid' }
  const { error } = await g.supabase.from('work_places').delete().eq('id', id)
  if (error) {
    console.error('[RegistroOre] delete place failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

// ─── Turni ────────────────────────────────────────────────────────────────

export type ShiftInput = {
  id?: string | null
  placeId: string
  date: string
  start: string
  /** null = turno ancora in corso */
  end: string | null
  breakMinutes: number | string
  isHoliday: boolean
  isNight: boolean
  notes: string
}

function breakOf(value: number | string): number | null {
  const n = typeof value === 'number' ? value : value.trim() === '' ? 0 : Number(value)
  if (!Number.isInteger(n) || n < 0 || n > REGISTRO_LIMITS.breakMax) return null
  return n
}

async function insertShift(
  g: NonNullable<Awaited<ReturnType<typeof gate>>>,
  row: Omit<WorkShift, 'id'>,
): Promise<ActionResult<WorkShift>> {
  const { data, error } = await g.supabase
    .from('work_shifts')
    .insert({ user_id: g.userId, ...row })
    .select(SHIFT_COLS)
    .single()
  if (error || !data) {
    if (error?.code !== '23505') console.error('[RegistroOre] create shift failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: error ? dbError(error) : 'saveError' }
  }
  await awardToolPoint(TOOL)
  return { success: true, data: toShift(data) }
}

export async function saveShift(input: ShiftInput): Promise<ActionResult<WorkShift>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(input.placeId)) return { success: false, message: 'noPlace' }
  const times = shiftTimes(input.date, input.start, input.end)
  if (!times.ok) return { success: false, message: times.error }
  const breakMinutes = breakOf(input.breakMinutes)
  if (breakMinutes === null) return { success: false, message: 'break' }
  if (times.endMs !== null && breakMinutes * MINUTE >= times.endMs - times.startMs) return { success: false, message: 'breakTooLong' }
  // Un turno in corso non può cominciare nel futuro
  if (times.endMs === null && times.startMs > Date.now() + 5 * MINUTE) return { success: false, message: 'future' }

  const row = {
    place_id: input.placeId,
    work_date: input.date,
    starts_at: new Date(times.startMs).toISOString(),
    ends_at: times.endMs === null ? null : new Date(times.endMs).toISOString(),
    break_minutes: breakMinutes,
    is_holiday: !!input.isHoliday,
    is_night: !!input.isNight,
    notes: clip(input.notes, REGISTRO_LIMITS.notes) || null,
  }

  if (input.id) {
    if (!UUID_RE.test(input.id)) return { success: false, message: 'invalid' }
    const { data, error } = await g.supabase.from('work_shifts').update(row).eq('id', input.id).select(SHIFT_COLS).maybeSingle()
    if (error || !data) {
      if (error && error.code !== '23505') console.error('[RegistroOre] update shift failed:', error)
      return { success: false, message: error ? dbError(error) : 'notFound' }
    }
    return { success: true, data: toShift(data) }
  }
  return insertShift(g, row)
}

/**
 * «Inizio turno»: adesso, oppure all'ora scritta (oggi; se quell'ora non è
 * ancora arrivata si intende ieri, es. alle 00:10 si scrive 23:50).
 */
export async function startShift(placeId: string, time?: string | null): Promise<ActionResult<WorkShift>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(placeId)) return { success: false, message: 'noPlace' }
  let startMs = nowToMinute()
  if (time) {
    if (!TIME_RE.test(time)) return { success: false, message: 'time' }
    const today = romeToday()
    startMs = romeLocalToMs(today, time)
    if (startMs > Date.now() + MINUTE) startMs = romeLocalToMs(addDays(today, -1), time)
  }
  return insertShift(g, {
    place_id: placeId,
    work_date: romeParts(startMs).date,
    starts_at: new Date(startMs).toISOString(),
    ends_at: null,
    break_minutes: 0,
    is_holiday: false,
    is_night: false,
    notes: null,
  })
}

/** «Fine turno»: chiude il turno in corso all'ora scritta (la prima dopo l'inizio). */
export async function endShift(id: string, end: string, breakMinutesInput: number | string): Promise<ActionResult<WorkShift>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(id)) return { success: false, message: 'invalid' }
  const breakMinutes = breakOf(breakMinutesInput)
  if (breakMinutes === null) return { success: false, message: 'break' }
  const { data: current } = await g.supabase.from('work_shifts').select(SHIFT_COLS).eq('id', id).maybeSingle()
  if (!current) return { success: false, message: 'notFound' }
  const startMs = Date.parse(String(current.starts_at))
  const endMs = endAfter(startMs, end)
  if (endMs === null) return { success: false, message: 'time' }
  if (endMs - startMs > 24 * HOUR) return { success: false, message: 'tooLong' }
  if (breakMinutes * MINUTE >= endMs - startMs) return { success: false, message: 'breakTooLong' }
  const { data, error } = await g.supabase
    .from('work_shifts')
    .update({ ends_at: new Date(endMs).toISOString(), break_minutes: breakMinutes })
    .eq('id', id)
    .select(SHIFT_COLS)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[RegistroOre] end shift failed:', error)
    return { success: false, message: error ? dbError(error) : 'notFound' }
  }
  return { success: true, data: toShift(data) }
}

export async function deleteShift(id: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  if (!UUID_RE.test(id)) return { success: false, message: 'invalid' }
  const { error } = await g.supabase.from('work_shifts').delete().eq('id', id)
  if (error) {
    console.error('[RegistroOre] delete shift failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

/**
 * «Ripeti il turno di ieri»: copia su oggi i turni finiti di ieri, con gli
 * stessi orari dell'orologio (e la stessa durata anche se fra i due giorni
 * cambia l'ora), stessa pausa, posto e segni. Le note non si copiano.
 */
export async function repeatYesterday(): Promise<ActionResult<WorkShift[]>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const today = romeToday()
  const yesterday = addDays(today, -1)
  const { data } = await g.supabase
    .from('work_shifts')
    .select(SHIFT_COLS)
    .eq('work_date', yesterday)
    .not('ends_at', 'is', null)
    .order('starts_at')
  const source = (data ?? []).map(toShift)
  if (!source.length) return { success: false, message: 'nothingYesterday' }

  const created: WorkShift[] = []
  for (const s of source) {
    const start = romeParts(Date.parse(s.starts_at)).time
    const end = romeParts(Date.parse(s.ends_at!)).time
    const times = shiftTimes(today, start, end)
    if (!times.ok || times.endMs === null) continue
    const breakMinutes = Math.min(s.break_minutes, Math.max(0, Math.round((times.endMs - times.startMs) / MINUTE) - 1))
    const result = await insertShift(g, {
      place_id: s.place_id,
      work_date: today,
      starts_at: new Date(times.startMs).toISOString(),
      ends_at: new Date(times.endMs).toISOString(),
      break_minutes: breakMinutes,
      is_holiday: false,
      is_night: s.is_night,
      notes: null,
    })
    if (!result.success) return created.length ? { success: true, data: created } : result
    created.push(result.data)
  }
  return { success: true, data: created }
}

// Registro ore e turni: tipi e calcoli condivisi (pagina, azioni, PDF).
// Tutto in minuti interi; gli orari sono istanti veri (millisecondi) letti e
// scritti con il fuso Europe/Rome, così il cambio dell'ora non sbaglia i conti.
// Niente import: il file si prova anche da solo con node.

export type WorkPlace = {
  id: string
  name: string
  color: string
  hourly_rate: number | null
  daily_hours: number
  weekly_hours: number
}

export type WorkShift = {
  id: string
  place_id: string
  work_date: string
  starts_at: string
  ends_at: string | null
  break_minutes: number
  is_holiday: boolean
  is_night: boolean
  notes: string | null
}

export const REGISTRO_LIMITS = { placeName: 80, notes: 500, breakMax: 720, places: 30 }

export const PLACE_COLORS = ['#c9a227', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#db2777'] as const

export const DEFAULT_DAILY_HOURS = 8
export const DEFAULT_WEEKLY_HOURS = 40

const TZ = 'Europe/Rome'
const MINUTE = 60_000
const HOUR = 3_600_000

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

// ─── Date e ore italiane ──────────────────────────────────────────────────

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Giorno (AAAA-MM-GG) e ora (HH:MM) italiani di un istante. */
export function romeParts(ms: number): { date: string; time: string } {
  const p: Record<string, string> = {}
  for (const part of partsFormat.formatToParts(new Date(ms))) p[part.type] = part.value
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

/**
 * Istante del giorno e dell'ora scritti come li legge l'orologio in Italia.
 * L'Italia è a +1 (ora solare) o +2 (ora legale): si prova con entrambi.
 * - Ora che capita due volte (notte del ritorno all'ora solare, 02:00–02:59):
 *   si prende la prima.
 * - Ora che non esiste (notte del passaggio all'ora legale, 02:00–02:59):
 *   si va avanti di un'ora, come fa l'orologio (02:30 → 03:30).
 */
export function romeLocalToMs(date: string, time: string): number {
  return romeLocalCandidates(date, time)[0]
}

/** Tutti gli istanti in cui l'orologio italiano segna quel giorno e quell'ora (due nell'ora doppia), in ordine. */
function romeLocalCandidates(date: string, time: string): number[] {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const naive = Date.UTC(y, m - 1, d, h, mi)
  const valid = [naive - 2 * HOUR, naive - HOUR].filter((ms) => {
    const p = romeParts(ms)
    return p.date === date && p.time === time
  })
  return valid.length ? valid : [naive - HOUR]
}

/**
 * Prima volta dopo startMs in cui l'orologio segna «time», il giorno «date»
 * o quello dopo. Nell'ora doppia (ritorno all'ora solare) un turno
 * 02:30–02:15 dura 45 minuti: la fine è la seconda 02:15, non il giorno dopo.
 */
function firstAfter(startMs: number, date: string, time: string): number {
  const next = [...romeLocalCandidates(date, time), ...romeLocalCandidates(addDays(date, 1), time)].find((ms) => ms > startMs)
  return next ?? romeLocalToMs(addDays(date, 1), time)
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** 0 = domenica … 6 = sabato */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7))
}

export function romeToday(): string {
  return romeParts(Date.now()).date
}

/** Adesso, arrotondato al minuto (i turni si contano a minuti interi). */
export function nowToMinute(): number {
  return Math.floor(Date.now() / MINUTE) * MINUTE
}

/** Primo e ultimo giorno del mese (month 1–12). */
export function monthBounds(year: number, month: number): { first: string; last: string } {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return { first, last }
}

/** Giorni da leggere per il mese: dal lunedì della prima settimana alla domenica dell'ultima. */
export function monthFetchRange(year: number, month: number): { from: string; to: string } {
  const { first, last } = monthBounds(year, month)
  return { from: mondayOf(first), to: addDays(mondayOf(last), 6) }
}

// ─── Festività nazionali ──────────────────────────────────────────────────

export type HolidayKey =
  | 'newYear'
  | 'epiphany'
  | 'easter'
  | 'easterMonday'
  | 'liberation'
  | 'labour'
  | 'republic'
  | 'assumption'
  | 'allSaints'
  | 'immaculate'
  | 'christmas'
  | 'stStephen'

/** Domenica di Pasqua (calendario gregoriano, metodo «anonimo»). */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const holidayCache = new Map<number, Map<string, HolidayKey>>()

export function italianHolidays(year: number): Map<string, HolidayKey> {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const easter = easterSunday(year)
  const fixed: [string, HolidayKey][] = [
    ['01-01', 'newYear'],
    ['01-06', 'epiphany'],
    ['04-25', 'liberation'],
    ['05-01', 'labour'],
    ['06-02', 'republic'],
    ['08-15', 'assumption'],
    ['11-01', 'allSaints'],
    ['12-08', 'immaculate'],
    ['12-25', 'christmas'],
    ['12-26', 'stStephen'],
  ]
  const map = new Map<string, HolidayKey>(fixed.map(([md, key]) => [`${year}-${md}`, key]))
  // Pasqua e Pasquetta (la Liberazione può cadere a Pasquetta: si tiene il nome della Liberazione)
  if (!map.has(easter)) map.set(easter, 'easter')
  const monday = addDays(easter, 1)
  if (!map.has(monday)) map.set(monday, 'easterMonday')
  holidayCache.set(year, map)
  return map
}

export function holidayOf(date: string): HolidayKey | null {
  return italianHolidays(Number(date.slice(0, 4))).get(date) ?? null
}

// ─── Turni ────────────────────────────────────────────────────────────────

export type ShiftTimesError = 'time' | 'same' | 'tooLong'

/**
 * Inizio e fine di un turno scritto a mano: giorno di inizio e ore HH:MM.
 * Se la fine è uguale o prima dell'inizio il turno finisce il giorno dopo
 * (18:00–02:00). Al massimo 24 ore.
 */
export function shiftTimes(
  date: string,
  start: string,
  end: string | null,
): { ok: true; startMs: number; endMs: number | null } | { ok: false; error: ShiftTimesError } {
  if (!DATE_RE.test(date) || !TIME_RE.test(start) || (end !== null && !TIME_RE.test(end))) return { ok: false, error: 'time' }
  const startMs = romeLocalToMs(date, start)
  if (end === null) return { ok: true, startMs, endMs: null }
  if (end === start) return { ok: false, error: 'same' }
  const endMs = firstAfter(startMs, date, end)
  if (endMs - startMs > 24 * HOUR) return { ok: false, error: 'tooLong' }
  return { ok: true, startMs, endMs }
}

/** Fine di un turno già iniziato: la prima volta dopo l'inizio in cui l'orologio segna «end». */
export function endAfter(startMs: number, end: string): number | null {
  if (!TIME_RE.test(end)) return null
  return firstAfter(startMs, romeParts(startMs).date, end)
}

/** I due intervalli [inizio, fine) si sovrappongono (fine null = turno in corso, fino ad adesso). */
export function shiftsOverlap(aStart: number, aEnd: number | null, bStart: number, bEnd: number | null, now = Date.now()): boolean {
  const ae = aEnd ?? Math.max(now, aStart + MINUTE)
  const be = bEnd ?? Math.max(now, bStart + MINUTE)
  return aStart < be && bStart < ae
}

/** Minuti dall'inizio alla fine (tempo vero, pausa compresa). */
export function grossMinutes(shift: Pick<WorkShift, 'starts_at' | 'ends_at'>): number {
  if (!shift.ends_at) return 0
  return Math.max(0, Math.round((Date.parse(shift.ends_at) - Date.parse(shift.starts_at)) / MINUTE))
}

/** Minuti lavorati: tempo vero meno la pausa. Turno in corso = 0. */
export function workedMinutes(shift: Pick<WorkShift, 'starts_at' | 'ends_at' | 'break_minutes'>): number {
  if (!shift.ends_at) return 0
  return Math.max(0, grossMinutes(shift) - (shift.break_minutes || 0))
}

/** Pezzi del turno giorno per giorno (a mezzanotte italiana), in minuti veri. */
export function splitByRomeDay(startMs: number, endMs: number): { date: string; minutes: number }[] {
  const out: { date: string; minutes: number }[] = []
  let cur = startMs
  let guard = 0
  while (cur < endMs && guard++ < 10) {
    const date = romeParts(cur).date
    const nextMidnight = romeLocalToMs(addDays(date, 1), '00:00')
    const segEnd = Math.min(endMs, nextMidnight)
    out.push({ date, minutes: Math.round((segEnd - cur) / MINUTE) })
    cur = segEnd
  }
  return out
}

export type ShiftBreakdown = {
  worked: number
  /** ore di domenica (non festiva) */
  sunday: number
  /** ore nei festivi: nazionali o turno segnato «festivo» */
  holiday: number
  night: number
}

/**
 * Domeniche e festivi si contano sul giorno vero: in un turno 22:00–06:00
 * fra sabato e domenica le 6 ore dopo mezzanotte sono di domenica. La pausa
 * si toglie in proporzione ai pezzi. «Festivo» e «notturno» segnati a mano
 * valgono per tutto il turno.
 */
export function shiftBreakdown(shift: WorkShift): ShiftBreakdown {
  const worked = workedMinutes(shift)
  const result: ShiftBreakdown = { worked, sunday: 0, holiday: 0, night: shift.is_night ? worked : 0 }
  if (!shift.ends_at || worked === 0) return result
  if (shift.is_holiday) {
    result.holiday = worked
    return result
  }
  const pieces = splitByRomeDay(Date.parse(shift.starts_at), Date.parse(shift.ends_at))
  const total = pieces.reduce((s, p) => s + p.minutes, 0)
  let given = 0
  pieces.forEach((piece, index) => {
    const share = index === pieces.length - 1 ? worked - given : Math.round((piece.minutes * worked) / total)
    given += share
    if (holidayOf(piece.date)) result.holiday += share
    else if (weekdayOf(piece.date) === 0) result.sunday += share
  })
  return result
}

// ─── Mese ─────────────────────────────────────────────────────────────────

export type DaySummary = {
  date: string
  holiday: HolidayKey | null
  shifts: WorkShift[]
  worked: number
  ordinary: number
  overtime: number
  /** straordinario di ogni turno: va ai turni che superano la soglia, in ordine di orario */
  shiftOvertime: Record<string, number>
}

export type WeekSummary = {
  monday: string
  sunday: string
  placeId: string
  worked: number
  threshold: number
  over: number
  /** la settimana comprende giorni del mese prima o dopo */
  crossesMonth: boolean
}

export type MonthTotals = {
  worked: number
  ordinary: number
  overtime: number
  sunday: number
  holiday: number
  night: number
  shifts: number
  daysWorked: number
  /** stima del lordo in euro (null = nessuna paga oraria) */
  gross: number | null
  /** alcune ore sono in posti senza paga oraria: non entrano nella stima */
  grossPartial: boolean
}

export type MonthSummary = { days: DaySummary[]; weeks: WeekSummary[]; totals: MonthTotals }

const thresholdMinutes = (hours: number) => Math.round(Number(hours) * 60)

/**
 * Conti del mese. Straordinario = minuti oltre la soglia giornaliera del
 * posto, giorno per giorno (giorno del turno = giorno in cui comincia). La
 * soglia settimanale si confronta a parte, settimana per settimana (lunedì–
 * domenica, per intero anche se esce dal mese: per questo servono i turni
 * di monthFetchRange). I turni in corso non si contano.
 */
export function summarizeMonth(shifts: WorkShift[], places: WorkPlace[], year: number, month: number, placeId: string | null = null): MonthSummary {
  const { first, last } = monthBounds(year, month)
  const placeById = new Map(places.map((p) => [p.id, p]))
  const closed = shifts
    .filter((s) => s.ends_at && placeById.has(s.place_id) && (!placeId || s.place_id === placeId))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))

  // Giorni del mese
  const byDate = new Map<string, WorkShift[]>()
  for (const s of closed) {
    if (s.work_date < first || s.work_date > last) continue
    const list = byDate.get(s.work_date) ?? []
    list.push(s)
    byDate.set(s.work_date, list)
  }

  const totals: MonthTotals = { worked: 0, ordinary: 0, overtime: 0, sunday: 0, holiday: 0, night: 0, shifts: 0, daysWorked: 0, gross: null, grossPartial: false }
  let grossCents = 0
  let hasRate = false

  const days: DaySummary[] = []
  for (const [date, list] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const day: DaySummary = { date, holiday: holidayOf(date), shifts: list, worked: 0, ordinary: 0, overtime: 0, shiftOvertime: {} }
    // Soglia giornaliera per posto (due lavori diversi hanno ognuno la sua)
    const perPlace = new Map<string, number>()
    for (const s of list) {
      const b = shiftBreakdown(s)
      const before = perPlace.get(s.place_id) ?? 0
      const limit = thresholdMinutes(placeById.get(s.place_id)!.daily_hours)
      day.shiftOvertime[s.id] = Math.max(0, before + b.worked - Math.max(limit, before))
      perPlace.set(s.place_id, before + b.worked)
      totals.sunday += b.sunday
      totals.holiday += b.holiday
      totals.night += b.night
      totals.shifts += 1
      const rate = placeById.get(s.place_id)?.hourly_rate
      if (rate !== null && rate !== undefined && Number(rate) > 0) {
        hasRate = true
        grossCents += (b.worked * Number(rate) * 100) / 60
      } else if (b.worked > 0) {
        totals.grossPartial = true
      }
    }
    for (const [pid, minutes] of perPlace) {
      const limit = thresholdMinutes(placeById.get(pid)!.daily_hours)
      const over = Math.max(0, minutes - limit)
      day.worked += minutes
      day.overtime += over
      day.ordinary += minutes - over
    }
    totals.worked += day.worked
    totals.ordinary += day.ordinary
    totals.overtime += day.overtime
    if (day.worked > 0) totals.daysWorked += 1
    days.push(day)
  }
  totals.gross = hasRate ? Math.round(grossCents) / 100 : null
  if (!hasRate) totals.grossPartial = false

  // Settimane che toccano il mese, per posto
  const weeks: WeekSummary[] = []
  const firstMonday = mondayOf(first)
  for (let monday = firstMonday; monday <= last; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6)
    const perPlace = new Map<string, number>()
    for (const s of closed) {
      if (s.work_date < monday || s.work_date > sunday) continue
      perPlace.set(s.place_id, (perPlace.get(s.place_id) ?? 0) + workedMinutes(s))
    }
    for (const [pid, worked] of perPlace) {
      if (worked === 0) continue
      const threshold = thresholdMinutes(placeById.get(pid)!.weekly_hours)
      weeks.push({ monday, sunday, placeId: pid, worked, threshold, over: Math.max(0, worked - threshold), crossesMonth: monday < first || sunday > last })
    }
  }

  return { days, weeks, totals }
}

// ─── Formati ──────────────────────────────────────────────────────────────

/** 450 → «7:30» */
export function formatHM(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.abs(Math.round(minutes))
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

/** 450 → «7,5» (ore con i decimali, come in busta paga) */
export function formatDecimalHours(minutes: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Math.round((minutes / 60) * 100) / 100)
}

export function formatEuro(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value)
}

/** Ora italiana HH:MM di un istante salvato */
export function romeTime(iso: string): string {
  return romeParts(Date.parse(iso)).time
}

/** Fine del turno su un giorno diverso dall'inizio (es. 18:00–02:00) */
export function endsNextDay(shift: Pick<WorkShift, 'starts_at' | 'ends_at'>): boolean {
  if (!shift.ends_at) return false
  return romeParts(Date.parse(shift.ends_at)).date !== romeParts(Date.parse(shift.starts_at)).date
}

/** «gio 1 ott» nella lingua della pagina */
export function formatDay(date: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

export function formatMonth(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}

/** Numero scritto all'italiana («12,50» o «12.5») oppure null; NaN se non valido */
export function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const text = value.trim().replace(/\s|€/g, '')
  if (!text) return null
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text
  if (!/^\d+(\.\d+)?$/.test(normalized)) return NaN
  return Number(normalized)
}

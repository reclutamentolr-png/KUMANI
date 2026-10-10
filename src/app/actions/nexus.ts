'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { addDays, todayKey } from '@/lib/agenda'
import { nexusSolution } from '@/lib/nexus/grid'
import { NEXUS_LOCALES, type NexusLocale, type NexusResult, type NexusStatus } from '@/lib/nexus/types'

// KUMANI NEXUS: la griglia del giorno arriva al browser senza risposte; le
// parole si controllano qui, una alla volta, e il risultato si salva solo
// dopo aver verificato la griglia intera. Una sola lingua al giorno: quella
// scelta con «Inizia» (nexus_days) vale fino a mezzanotte su ogni dispositivo.

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

async function player() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'nexus'))) return null
  return { supabase, user }
}

const isLocale = (value: string): value is NexusLocale => (NEXUS_LOCALES as readonly string[]).includes(value)
// Oggi, o ieri per chi ha iniziato prima di mezzanotte
const playableDay = (day: string) => day === todayKey() || day === addDays(todayKey(), -1)

async function streakOf(userId: string): Promise<number> {
  const { data } = await service().from('nexus_results').select('day').eq('user_id', userId).order('day', { ascending: false }).limit(400)
  const days = new Set((data ?? []).map((row) => row.day as string))
  let cursor = days.has(todayKey()) ? todayKey() : addDays(todayKey(), -1)
  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

// La lingua già scelta per quel giorno (null = non ancora iniziato)
async function dayLocale(userId: string, day: string): Promise<NexusLocale | null> {
  const { data } = await service().from('nexus_days').select('locale').eq('user_id', userId).eq('day', day).maybeSingle<{ locale: string }>()
  if (data && isLocale(data.locale)) return data.locale
  // Prima del registro dei giorni: vale la lingua del risultato già salvato
  const { data: result } = await service().from('nexus_results').select('locale').eq('user_id', userId).eq('day', day).limit(1).maybeSingle<{ locale: string }>()
  return result && isLocale(result.locale) ? result.locale : null
}

// Parole, aiuti e risultato solo nella lingua del giorno
async function allowed(userId: string, day: string, locale: NexusLocale) {
  const chosen = await dayLocale(userId, day)
  return !chosen || chosen === locale
}

export async function getNexusStatus(locale: string): Promise<NexusStatus | null> {
  const session = await player()
  if (!session || !isLocale(locale)) return null
  const day = todayKey()
  const lockedLocale = await dayLocale(session.user.id, day)
  const gridLocale = lockedLocale ?? locale
  const [{ data }, streak] = await Promise.all([
    session.supabase.from('nexus_results').select('seconds, hints').eq('user_id', session.user.id).eq('day', day).eq('locale', gridLocale).maybeSingle(),
    streakOf(session.user.id),
  ])
  return { puzzle: nexusSolution(day, gridLocale).puzzle, result: data ? { seconds: data.seconds, hints: data.hints } : null, streak, lockedLocale }
}

// «Inizia»: da qui la lingua resta quella fino a domani. Se era già stata
// scelta un'altra lingua (es. da un altro dispositivo), torna quella.
export async function startNexus(day: string, locale: string): Promise<{ locale: NexusLocale } | { error: string }> {
  if (!isLocale(locale) || !playableDay(day)) return { error: 'invalid' }
  const session = await player()
  if (!session) return { error: 'access' }
  const chosen = await dayLocale(session.user.id, day)
  if (chosen) return { locale: chosen }
  const { error } = await service().from('nexus_days').upsert({ user_id: session.user.id, day, locale }, { onConflict: 'user_id,day', ignoreDuplicates: true })
  if (error) console.error('[Nexus] start failed:', error.message)
  return { locale: (await dayLocale(session.user.id, day)) ?? locale }
}

export async function checkNexusWord(day: string, locale: string, slotId: string, guess: string): Promise<boolean> {
  if (!isLocale(locale) || !playableDay(day) || !/^[A-Z]{3,7}$/.test(guess)) return false
  const session = await player()
  if (!session || !(await allowed(session.user.id, day, locale))) return false
  return nexusSolution(day, locale).answers[slotId] === guess
}

// Aiuto: la lettera giusta di una casella
export async function revealNexusLetter(day: string, locale: string, row: number, col: number): Promise<string | null> {
  if (!isLocale(locale) || !playableDay(day) || !Number.isInteger(row) || !Number.isInteger(col)) return null
  const session = await player()
  if (!session || !(await allowed(session.user.id, day, locale))) return null
  return nexusSolution(day, locale).letters[row]?.[col] || null
}

export async function finishNexus(
  day: string,
  locale: string,
  grid: string[][],
  seconds: number,
  hints: number
): Promise<{ result: NexusResult; streak: number } | { error: string }> {
  if (!isLocale(locale) || !playableDay(day)) return { error: 'invalid' }
  const session = await player()
  if (!session) return { error: 'access' }
  if (!(await allowed(session.user.id, day, locale))) return { error: 'otherLanguage' }
  const { letters } = nexusSolution(day, locale)
  const solved = letters.every((row, r) => row.every((ch, c) => !ch || grid?.[r]?.[c] === ch))
  if (!solved) return { error: 'notSolved' }

  const result = { seconds: Math.min(Math.max(Math.round(seconds), 0), 86400), hints: Math.min(Math.max(Math.round(hints), 0), 49) }
  // Il primo risultato del giorno resta quello buono
  const { error } = await service()
    .from('nexus_results')
    .upsert({ user_id: session.user.id, day, locale, ...result }, { onConflict: 'user_id,day,locale', ignoreDuplicates: true })
  if (error) {
    console.error('[Nexus] save failed:', error.message)
    return { error: 'saveError' }
  }
  // La lingua del giorno resta registrata anche se «Inizia» non era passato dal server
  await service().from('nexus_days').upsert({ user_id: session.user.id, day, locale }, { onConflict: 'user_id,day', ignoreDuplicates: true })
  await awardToolPoint('nexus')
  return { result, streak: await streakOf(session.user.id) }
}

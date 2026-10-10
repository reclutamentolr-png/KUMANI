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
// dopo aver verificato la griglia intera.

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

export async function getNexusStatus(locale: string): Promise<NexusStatus | null> {
  const session = await player()
  if (!session || !isLocale(locale)) return null
  const day = todayKey()
  const [{ data }, streak] = await Promise.all([
    session.supabase.from('nexus_results').select('seconds, hints').eq('user_id', session.user.id).eq('day', day).eq('locale', locale).maybeSingle(),
    streakOf(session.user.id),
  ])
  return { puzzle: nexusSolution(day, locale).puzzle, result: data ? { seconds: data.seconds, hints: data.hints } : null, streak }
}

export async function checkNexusWord(day: string, locale: string, slotId: string, guess: string): Promise<boolean> {
  if (!isLocale(locale) || !playableDay(day) || !/^[A-Z]{3,7}$/.test(guess)) return false
  if (!(await player())) return false
  return nexusSolution(day, locale).answers[slotId] === guess
}

// Aiuto: la lettera giusta di una casella
export async function revealNexusLetter(day: string, locale: string, row: number, col: number): Promise<string | null> {
  if (!isLocale(locale) || !playableDay(day) || !Number.isInteger(row) || !Number.isInteger(col)) return null
  if (!(await player())) return null
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
  await awardToolPoint('nexus')
  return { result, streak: await streakOf(session.user.id) }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { cleanAnswers, toMinutes, type QuizAnswers, type SleepLog } from '@/lib/cronobioma'

// KUMANI CRONOBIOMA: profilo (risposte del questionario, ora del risveglio e
// ore di sonno volute) e diario del sonno. Dati sulla salute: si salvano solo
// con il consenso esplicito e li vede solo chi li scrive (RLS).

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }
type Supabase = Awaited<ReturnType<typeof createClient>>

export type CronobiomaProfile = { answers: QuizAnswers; wake_time: string; sleep_need: number; health_consent_at: string }

async function gate(): Promise<{ ok: true; supabase: Supabase; userId: string } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'cronobioma'))) return { ok: false, message: 'subscriptionRequired' }
  return { ok: true, supabase, userId: user.id }
}

const validTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

// Profilo nuovo o aggiornato. Il primo salvataggio richiede il consenso.
export async function saveCronobiomaProfile(input: { answers: unknown; wakeTime: string; sleepNeed: number; consent: boolean }): Promise<ActionResult<CronobiomaProfile>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const answers = cleanAnswers(input.answers)
  if (!answers) return { success: false, message: 'invalidAnswers' }
  if (!validTime(input.wakeTime)) return { success: false, message: 'invalidAnswers' }
  const sleepNeed = Math.min(600, Math.max(360, Math.round(Number(input.sleepNeed) / 15) * 15 || 480))
  const { data: existing } = await g.supabase.from('cronobioma_profiles').select('health_consent_at').maybeSingle()
  if (!existing && input.consent !== true) return { success: false, message: 'consentRequired' }
  const row = { answers, wake_time: input.wakeTime, sleep_need: sleepNeed, health_consent_at: existing?.health_consent_at ?? new Date().toISOString() }
  const { data, error } = await g.supabase.from('cronobioma_profiles').upsert(row, { onConflict: 'owner_id' }).select('answers, wake_time, sleep_need, health_consent_at').single()
  if (error) return { success: false, message: 'saveError' }
  return { success: true, data: data as CronobiomaProfile }
}

// Una notte nel diario (si può correggere: una riga per notte)
export async function logCronobiomaNight(input: SleepLog): Promise<ActionResult<SleepLog>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { data: profile } = await g.supabase.from('cronobioma_profiles').select('owner_id').maybeSingle()
  if (!profile) return { success: false, message: 'consentRequired' }
  const night = typeof input.night === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.night) ? input.night : null
  const today = new Date().toISOString().slice(0, 10)
  if (!night || night > today || !validTime(input.bed) || !validTime(input.wake) || ![1, 2, 3].includes(input.quality)) return { success: false, message: 'invalidNight' }
  // Più di 16 ore o meno di un'ora di sonno: quasi certamente un errore
  const length = ((toMinutes(input.wake)! - toMinutes(input.bed)! + 1440) % 1440) || 1440
  if (length < 60 || length > 16 * 60) return { success: false, message: 'invalidNight' }
  const { data, error } = await g.supabase
    .from('cronobioma_sleep_logs')
    .upsert({ night, bed: input.bed, wake: input.wake, quality: input.quality }, { onConflict: 'owner_id,night' })
    .select('night, bed, wake, quality')
    .single()
  if (error) return { success: false, message: error.message.includes('cronobioma_limit') ? 'limitReached' : 'saveError' }
  // KU Karma del giorno (una volta al giorno, controllato dal database)
  await awardToolPoint('cronobioma')
  return { success: true, data: data as SleepLog }
}

export async function deleteCronobiomaNight(night: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  const { error } = await supabase.from('cronobioma_sleep_logs').delete().eq('night', night)
  if (error) return { success: false, message: 'deleteError' }
  return { success: true, data: null }
}

// Cancella tutto (diario e profilo): si può fare sempre, anche senza piano
export async function deleteCronobiomaData(): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  const logs = await supabase.from('cronobioma_sleep_logs').delete().eq('owner_id', user.id)
  const profile = await supabase.from('cronobioma_profiles').delete().eq('owner_id', user.id)
  if (logs.error || profile.error) return { success: false, message: 'deleteError' }
  return { success: true, data: null }
}

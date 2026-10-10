'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveAureyaAccess } from '@/lib/aureya-server'
import {
  ACOUSTIC_FREQUENCIES,
  ACUITY_LEVELS,
  AMSLER_SIZE,
  computeAcousticScore,
  computeAcuityScore,
  type AcousticTestResult,
  type AcuityTestResult,
  type AmslerTestResult,
} from '@/lib/aureya'

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }

async function requireActiveAureyaAccess(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'notLoggedIn' }
  }

  const hasAccess = await hasActiveAureyaAccess(supabase, user.id)
  if (!hasAccess) {
    return { ok: false, message: 'subscriptionRequired' }
  }

  return { ok: true, userId: user.id }
}

export async function saveAcousticTestResult(result: AcousticTestResult): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActiveAureyaAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  // Solo valori ammessi (come per gli altri test): due orecchie, frequenze
  // del test, livello tra 0 e 1, dispositivo noto
  const frequencies: readonly number[] = ACOUSTIC_FREQUENCIES
  const device = result?.device === 'headphones' || result?.device === 'speaker' ? result.device : null
  const thresholds = (Array.isArray(result?.thresholds) ? result.thresholds : [])
    .filter(
      (t) =>
        (t?.ear === 'left' || t?.ear === 'right') &&
        frequencies.includes(Number(t?.frequency)) &&
        (t?.level === null || (typeof t?.level === 'number' && t.level >= 0 && t.level <= 1))
    )
    .slice(0, frequencies.length * 2)
    .map((t) => ({ ear: t.ear, frequency: t.frequency, level: t.level }))
  if (!device || thresholds.length === 0) return { success: false, message: 'saveError' }
  const clean = { device, thresholds } as AcousticTestResult

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aureya_test_results')
    .insert({
      user_id: gate.userId,
      test_type: 'acoustic',
      result: clean,
      score: computeAcousticScore(clean.thresholds),
      device_confirmation: device,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[Aureya] saveAcousticTestResult failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: { id: data.id } }
}

export async function saveAcuityTestResult(result: AcuityTestResult): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActiveAureyaAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  // Solo valori ammessi: due occhi, livelli della tabella
  const levels: readonly number[] = ACUITY_LEVELS
  const eyes = (result.eyes ?? [])
    .filter((e) => (e.eye === 'left' || e.eye === 'right') && (e.bestLogMar === null || levels.includes(e.bestLogMar)))
    .slice(0, 2)
    .map((e) => ({ eye: e.eye, bestLogMar: e.bestLogMar, ...(e.limitedByScreen === true ? { limitedByScreen: true } : {}) }))
  if (eyes.length === 0) return { success: false, message: 'saveError' }
  const clean: AcuityTestResult = {
    distanceCm: Number(result.distanceCm) || 0,
    pxPerMm: Number(result.pxPerMm) || 0,
    eyes,
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aureya_test_results')
    .insert({ user_id: gate.userId, test_type: 'acuity', result: clean, score: computeAcuityScore(eyes) })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[Aureya] saveAcuityTestResult failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: { id: data.id } }
}

// La griglia di Amsler non dà un punteggio: si salvano le zone segnate
export async function saveAmslerTestResult(result: AmslerTestResult): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActiveAureyaAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const max = AMSLER_SIZE * AMSLER_SIZE
  const eyes = (result.eyes ?? [])
    .filter((e) => e.eye === 'left' || e.eye === 'right')
    .slice(0, 2)
    .map((e) => ({ eye: e.eye, marked: [...new Set((e.marked ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n < max))] }))
  if (eyes.length === 0) return { success: false, message: 'saveError' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aureya_test_results')
    .insert({ user_id: gate.userId, test_type: 'amsler', result: { eyes }, score: null })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[Aureya] saveAmslerTestResult failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: { id: data.id } }
}

export async function deleteTestResult(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveAureyaAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase.from('aureya_test_results').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Aureya] deleteTestResult failed:', error)
    return { success: false, message: 'deleteError' }
  }

  return { success: true, data: null }
}

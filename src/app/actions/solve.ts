'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { pushDb } from '@/lib/push'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { cleanRun } from '@/lib/solve/engine'
import { solveGuideBySlug } from '@/lib/solve/guides.it'
import { SOLVE_CACHE_TAG, canSeeSolve, getSolveEnabled } from '@/lib/solve/server'
import type { SolveOutcome } from '@/lib/solve/types'

// KUMANI Risolvi: salvataggio del percorso di chi è collegato (risposte e
// passi spuntati), «Ricomincia» ed esito finale. Scrive con la sessione
// della persona: la tabella accetta solo le sue righe.

async function context(guideId: string) {
  const guide = solveGuideBySlug(guideId)
  if (!guide || !(await canSeeSolve())) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { guide, supabase, user } : null
}

export async function saveSolveRun(guideId: string, answers: unknown, done: unknown): Promise<{ success: boolean }> {
  const ctx = await context(guideId)
  if (!ctx) return { success: false }
  const run = cleanRun(ctx.guide, answers, done)
  const { error } = await ctx.supabase.from('solve_runs').upsert(
    { user_id: ctx.user.id, guide_id: ctx.guide.id, version: ctx.guide.version, answers: run.answers, done: run.done, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,guide_id' }
  )
  return { success: !error }
}

export async function finishSolveRun(guideId: string, outcome: SolveOutcome): Promise<{ success: boolean }> {
  const ctx = await context(guideId)
  if (!ctx || !['yes', 'no', 'unknown'].includes(outcome)) return { success: false }
  const now = new Date().toISOString()
  const { error } = await ctx.supabase
    .from('solve_runs')
    .update({ outcome, completed_at: now, updated_at: now })
    .eq('user_id', ctx.user.id)
    .eq('guide_id', ctx.guide.id)
  return { success: !error }
}

export async function resetSolveRun(guideId: string): Promise<{ success: boolean }> {
  const ctx = await context(guideId)
  if (!ctx) return { success: false }
  const { error } = await ctx.supabase.from('solve_runs').delete().eq('user_id', ctx.user.id).eq('guide_id', ctx.guide.id)
  return { success: !error }
}

// Admin → Panoramica: accendere Risolvi per tutti e vedere quanto si usa
export async function adminGetSolve(): Promise<{ enabled: boolean; started: number; completed: number; solved: number } | { error: string }> {
  if (!(await verifyAdmin('settings.read'))) return { error: 'Non autorizzato' }
  const db = pushDb()
  const [enabled, started, completed, solved] = await Promise.all([
    getSolveEnabled(),
    db.from('solve_runs').select('user_id', { count: 'exact', head: true }),
    db.from('solve_runs').select('user_id', { count: 'exact', head: true }).not('completed_at', 'is', null),
    db.from('solve_runs').select('user_id', { count: 'exact', head: true }).eq('outcome', 'yes'),
  ])
  return { enabled, started: started.count ?? 0, completed: completed.count ?? 0, solved: solved.count ?? 0 }
}

export async function adminSetSolve(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const { error } = await pushDb()
    .from('system_settings')
    .upsert({ key: 'solve_enabled', value: enabled ? 'true' : 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  revalidateTag(SOLVE_CACHE_TAG, { expire: 0 })
  return { success: true }
}

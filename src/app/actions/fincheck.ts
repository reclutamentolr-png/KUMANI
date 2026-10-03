'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// FinCheck: salvataggio del test (punti e KU Karma calcolati dal database)
// e obiettivi del piano d'azione spuntati.

const GOALS = ['emergencyFund', 'noNewDebt', 'saveAuto', 'track30', 'compareBills', 'cutWants', 'cancelSub', 'writeGoal']

export async function saveFinCheck(answers: number[]): Promise<{ success: boolean; ku?: number; code?: string }> {
  if (!Array.isArray(answers) || answers.length !== 15 || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) {
    return { success: false, code: 'invalid' }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fincheck_save', { p_answers: answers })
  if (error) {
    console.error('[fincheck] test non salvato:', error.message)
    return { success: false, code: /too_fast/.test(error.message) ? 'too_fast' : 'error' }
  }
  const row = (Array.isArray(data) ? data[0] : data) as { ku_awarded?: number } | null
  revalidatePath('/[locale]/marketplace/fincheck', 'page')
  return { success: true, ku: row?.ku_awarded ?? 0 }
}

export async function setFinCheckGoal(resultId: string, goal: string, done: boolean): Promise<{ success: boolean }> {
  if (!GOALS.includes(goal)) return { success: false }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }
  const { data: row } = await supabase.from('fincheck_results').select('goals_done').eq('id', resultId).eq('user_id', user.id).maybeSingle()
  if (!row) return { success: false }
  const current = new Set((row.goals_done as string[]) ?? [])
  if (done) current.add(goal)
  else current.delete(goal)
  const { error } = await supabase.from('fincheck_results').update({ goals_done: [...current] }).eq('id', resultId).eq('user_id', user.id)
  return { success: !error }
}

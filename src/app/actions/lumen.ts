'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { LUMEN_BODY_MAX, LUMEN_TITLE_MAX, type LumenScript } from '@/lib/lumen'

// KUMANI LUMEN: qui solo i copioni (tabella lumen_scripts, visibili a chi li
// ha scritti). Il video si registra e si scarica nel browser e non arriva mai
// sul server.

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }
type Supabase = Awaited<ReturnType<typeof createClient>>

async function gate(): Promise<{ ok: true; supabase: Supabase } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'lumen'))) return { ok: false, message: 'subscriptionRequired' }
  return { ok: true, supabase }
}

const COLUMNS = 'id, title, body, updated_at'

export async function listLumenScripts(): Promise<ActionResult<LumenScript[]>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { data, error } = await g.supabase.from('lumen_scripts').select(COLUMNS).order('updated_at', { ascending: false }).limit(200)
  if (error) return { success: false, message: 'loadError' }
  return { success: true, data: (data ?? []) as LumenScript[] }
}

// Nuovo copione (senza id) o modifica di uno esistente
export async function saveLumenScript(input: { id?: string; title: string; body: string }): Promise<ActionResult<LumenScript>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const row = { title: String(input.title ?? '').trim().slice(0, LUMEN_TITLE_MAX), body: String(input.body ?? '').slice(0, LUMEN_BODY_MAX) }
  const query = input.id
    ? g.supabase.from('lumen_scripts').update(row).eq('id', input.id).select(COLUMNS).single()
    : g.supabase.from('lumen_scripts').insert(row).select(COLUMNS).single()
  const { data, error } = await query
  if (error) return { success: false, message: error.message.includes('lumen_limit') ? 'limitReached' : 'saveError' }
  return { success: true, data: data as LumenScript }
}

export async function deleteLumenScript(id: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { error } = await g.supabase.from('lumen_scripts').delete().eq('id', id)
  if (error) return { success: false, message: 'deleteError' }
  return { success: true, data: null }
}

// Dopo una registrazione o un copione letto fino in fondo: KU Karma del
// giorno (una volta al giorno, controllato dal database)
export async function lumenDone(): Promise<void> {
  await awardToolPoint('lumen')
}

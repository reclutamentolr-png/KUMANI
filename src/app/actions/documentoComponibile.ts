'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { limitError } from '@/lib/appLimits'
import {
  DOC_LIMITS,
  normalizeBlocks,
  type BlocksError,
  type ComposableDocRow,
  type ComposableDocSummary,
  type DocContent,
} from '@/lib/documentoComponibile'

// Documento componibile: proprietario e piano li controlla anche il database
// (RLS di composable_documents, limiti di peso e di immagini); qui la pulizia
// dei blocchi prima di salvare.

type ActionResult<T> = { success: true; data: T } | { success: false; message: string; limitText?: string }

const TOOL = 'documento-componibile'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SUMMARY_COLUMNS = 'id, title, field_count, updated_at'

const cut = (text: string, max: number) => text.slice(0, max).replace(/[\uD800-\uDBFF]$/, '')
const clip = (value: unknown, max: number) => (typeof value === 'string' ? cut(value.replace(/\s+/g, ' ').trim(), max) : '')

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!(await hasActiveToolAccess(supabase, user.id, TOOL))) return null
  return { supabase, userId: user.id }
}

function toRow(doc: DocContent): { ok: true; row: DocContent } | { ok: false; error: BlocksError | 'titleRequired' } {
  if (!doc || typeof doc !== 'object') return { ok: false, error: 'badBlocks' }
  const title = clip(doc.title, DOC_LIMITS.title)
  if (!title) return { ok: false, error: 'titleRequired' }
  const blocks = normalizeBlocks(doc.blocks)
  if (!blocks.ok) return { ok: false, error: blocks.error }
  return { ok: true, row: { title, footer: clip(doc.footer, DOC_LIMITS.footer), blocks: blocks.blocks } }
}

// Errore del database sui controlli di peso, immagini o blocchi (vedi migrazione)
function checkError(error: { message?: string } | null): string | null {
  const m = error?.message ?? ''
  if (m.includes('composable_documents_blocks_size')) return 'tooBig'
  if (m.includes('composable_documents_blocks_images')) return 'tooManyImages'
  if (m.includes('composable_documents_blocks_count')) return 'tooManyBlocks'
  return null
}

export async function listComposableDocuments(): Promise<ComposableDocSummary[]> {
  const g = await gate()
  if (!g) return []
  const { data, error } = await g.supabase
    .from('composable_documents')
    .select(SUMMARY_COLUMNS)
    .eq('user_id', g.userId)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('[Documento componibile] list failed:', error)
    return []
  }
  return (data ?? []) as ComposableDocSummary[]
}

export async function getComposableDocument(id: string): Promise<ComposableDocRow | null> {
  if (!UUID_RE.test(id)) return null
  const g = await gate()
  if (!g) return null
  const { data } = await g.supabase
    .from('composable_documents')
    .select('id, title, footer, blocks, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', g.userId)
    .maybeSingle()
  if (!data) return null
  const row = data as ComposableDocRow
  return { ...row, blocks: Array.isArray(row.blocks) ? row.blocks : [] }
}

// Documento nuovo (vuoto o da un modello pronto)
export async function createComposableDocument(doc: DocContent): Promise<ActionResult<{ id: string }>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const r = toRow(doc)
  if (!r.ok) return { success: false, message: r.error }
  const { data, error } = await g.supabase
    .from('composable_documents')
    .insert({ user_id: g.userId, ...r.row })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[Documento componibile] create failed:', error?.message)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: checkError(error) ?? 'saveError' }
  }
  await awardToolPoint(TOOL)
  return { success: true, data: { id: data.id } }
}

export async function updateComposableDocument(id: string, doc: DocContent): Promise<ActionResult<{ updatedAt: string }>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'notFound' }
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const r = toRow(doc)
  if (!r.ok) return { success: false, message: r.error }
  const { data, error } = await g.supabase
    .from('composable_documents')
    .update(r.row)
    .eq('id', id)
    .eq('user_id', g.userId)
    .select('updated_at')
    .maybeSingle()
  if (error) {
    console.error('[Documento componibile] update failed:', error.message)
    return { success: false, message: checkError(error) ?? 'saveError' }
  }
  if (!data) return { success: false, message: 'notFound' }
  return { success: true, data: { updatedAt: data.updated_at } }
}

// Copia di un documento, con «(copia)» nel titolo nella lingua del sito
export async function duplicateComposableDocument(id: string, copySuffix: string): Promise<ActionResult<ComposableDocSummary>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'notFound' }
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const { data: source } = await g.supabase
    .from('composable_documents')
    .select('title, footer, blocks')
    .eq('id', id)
    .eq('user_id', g.userId)
    .maybeSingle()
  if (!source) return { success: false, message: 'notFound' }
  const suffix = ` ${clip(copySuffix, 20) || '(copia)'}`
  const title = `${cut(String(source.title), DOC_LIMITS.title - suffix.length)}${suffix}`
  const { data, error } = await g.supabase
    .from('composable_documents')
    .insert({ user_id: g.userId, title, footer: source.footer, blocks: source.blocks })
    .select(SUMMARY_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[Documento componibile] duplicate failed:', error?.message)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: data as ComposableDocSummary }
}

export async function deleteComposableDocument(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'notFound' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'noAccess' }
  // Cancellare i propri documenti si può sempre, anche senza piano attivo
  const { error } = await supabase.from('composable_documents').delete().eq('id', id).eq('user_id', user.id)
  if (error) {
    console.error('[Documento componibile] delete failed:', error.message)
    return { success: false, message: 'deleteError' }
  }
  return { success: true, data: null }
}

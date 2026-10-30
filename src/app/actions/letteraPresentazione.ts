'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { limitError } from '@/lib/appLimits'
import {
  LETTER_LIMITS,
  asLetterLang,
  asTemplate,
  type CoverLetterForm,
  type CoverLetterRow,
  type CoverLetterSummary,
} from '@/lib/letteraPresentazione'

// Lettera di presentazione (piano Plus): proprietario e piano li controlla
// anche il database (RLS di cover_letters); qui la pulizia dei campi.

type ActionResult<T> = { success: true; data: T } | { success: false; message: string; limitText?: string }

const TOOL = 'lettera-presentazione'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
// Testo lungo: si tengono gli a capo, si tolgono gli spazi in fondo alle righe
const clipBody = (value: unknown, max: number) =>
  typeof value === 'string'
    ? value
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, max)
    : ''

const SUMMARY_COLUMNS = 'id, title, recipient_company, position, content_language, template, letter_date, updated_at'

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!(await hasActiveToolAccess(supabase, user.id, TOOL))) return null
  return { supabase, userId: user.id }
}

function toRow(form: CoverLetterForm) {
  const date = clip(form.letterDate, 10)
  return {
    title: clip(form.title, LETTER_LIMITS.title),
    content_language: asLetterLang(form.language),
    template: asTemplate(form.template),
    position: clip(form.position, LETTER_LIMITS.position),
    sender_name: clip(form.senderName, LETTER_LIMITS.senderName),
    sender_role: clip(form.senderRole, LETTER_LIMITS.senderRole),
    sender_email: clip(form.senderEmail, LETTER_LIMITS.senderEmail),
    sender_phone: clip(form.senderPhone, LETTER_LIMITS.senderPhone),
    sender_city: clip(form.senderCity, LETTER_LIMITS.senderCity),
    recipient_company: clip(form.recipientCompany, LETTER_LIMITS.recipientCompany),
    recipient_name: clip(form.recipientName, LETTER_LIMITS.recipientName),
    recipient_address: clipBody(form.recipientAddress, LETTER_LIMITS.recipientAddress),
    place: clip(form.place, LETTER_LIMITS.place),
    letter_date: DATE_RE.test(date) && date >= '2000-01-01' && date <= '2100-12-31' ? date : null,
    subject: clip(form.subject, LETTER_LIMITS.subject),
    greeting: clip(form.greeting, LETTER_LIMITS.greeting),
    body: clipBody(form.body, LETTER_LIMITS.body),
    closing: clip(form.closing, LETTER_LIMITS.closing),
    signature: clip(form.signature, LETTER_LIMITS.signature),
    attach_cv: form.attachCv !== false,
  }
}

export async function listCoverLetters(): Promise<CoverLetterSummary[]> {
  const g = await gate()
  if (!g) return []
  const { data, error } = await g.supabase
    .from('cover_letters')
    .select(SUMMARY_COLUMNS)
    .eq('user_id', g.userId)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('[Lettera] list failed:', error)
    return []
  }
  return (data ?? []) as CoverLetterSummary[]
}

export async function getCoverLetter(id: string): Promise<CoverLetterRow | null> {
  if (!UUID_RE.test(id)) return null
  const g = await gate()
  if (!g) return null
  const { data } = await g.supabase.from('cover_letters').select('*').eq('id', id).eq('user_id', g.userId).maybeSingle()
  return (data as CoverLetterRow | null) ?? null
}

export async function createCoverLetter(form: CoverLetterForm): Promise<ActionResult<{ id: string }>> {
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const row = toRow(form)
  if (!row.title) return { success: false, message: 'titleRequired' }
  const { data, error } = await g.supabase
    .from('cover_letters')
    .insert({ user_id: g.userId, ...row })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[Lettera] create failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint(TOOL)
  return { success: true, data: { id: data.id } }
}

export async function updateCoverLetter(id: string, form: CoverLetterForm): Promise<ActionResult<{ updatedAt: string }>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'notFound' }
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const row = toRow(form)
  if (!row.title) return { success: false, message: 'titleRequired' }
  const { data, error } = await g.supabase
    .from('cover_letters')
    .update(row)
    .eq('id', id)
    .eq('user_id', g.userId)
    .select('updated_at')
    .maybeSingle()
  if (error) {
    console.error('[Lettera] update failed:', error)
    return { success: false, message: 'saveError' }
  }
  if (!data) return { success: false, message: 'notFound' }
  return { success: true, data: { updatedAt: data.updated_at } }
}

// Copia di una lettera (per una candidatura simile): stessi dati, titolo con
// «(copia)» nella lingua del sito
export async function duplicateCoverLetter(id: string, copySuffix: string): Promise<ActionResult<CoverLetterSummary>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'notFound' }
  const g = await gate()
  if (!g) return { success: false, message: 'noAccess' }
  const { data: source } = await g.supabase.from('cover_letters').select('*').eq('id', id).eq('user_id', g.userId).maybeSingle()
  if (!source) return { success: false, message: 'notFound' }
  const suffix = ` ${clip(copySuffix, 20) || '(copia)'}`
  const title = `${String(source.title).slice(0, LETTER_LIMITS.title - suffix.length)}${suffix}`
  // Si copiano solo le colonne della lettera (niente id, proprietario, date)
  const copy = Object.fromEntries(
    Object.entries(source as Record<string, unknown>).filter(([k]) => !['id', 'user_id', 'created_at', 'updated_at'].includes(k)),
  )
  const { data, error } = await g.supabase
    .from('cover_letters')
    .insert({ ...copy, title, user_id: g.userId })
    .select(SUMMARY_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[Lettera] duplicate failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: data as CoverLetterSummary }
}

export async function deleteCoverLetter(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'notFound' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'noAccess' }
  // Cancellare le proprie lettere si può sempre, anche senza piano attivo
  const { error } = await supabase.from('cover_letters').delete().eq('id', id).eq('user_id', user.id)
  if (error) {
    console.error('[Lettera] delete failed:', error)
    return { success: false, message: 'deleteError' }
  }
  return { success: true, data: null }
}

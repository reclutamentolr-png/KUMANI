'use server'

import { randomBytes } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { DOC_BUCKET, DOC_CATEGORIES, DOC_FORMATS, DOC_LOCALES, DOC_MAX_BYTES, type DocCategory, type DocFormat, type DocLocale, type KumaniDoc, type Localized } from '@/lib/documents'

// Admin → Documenti KUMANI: schede dei documenti (titolo e descrizione nelle
// 7 lingue) e caricamento dei file per lingua e formato. Il file va dal
// browser direttamente nel bucket privato con un link di caricamento firmato,
// così anche le presentazioni pesanti non passano dal server.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

type Result<T = object> = ({ success: true } & T) | { success: false; error: string }

const clean = (value: Localized | undefined, max: number): Localized => {
  const out: Localized = {}
  for (const l of DOC_LOCALES) {
    const v = (value?.[l] ?? '').trim().slice(0, max)
    if (v) out[l] = v
  }
  return out
}

export async function adminListDocuments(): Promise<Result<{ documents: KumaniDoc[] }>> {
  if (!(await verifyAdmin('settings.read'))) return { success: false, error: 'Non autorizzato' }
  const { data, error } = await db()
    .from('kumani_documents')
    .select('id, title, description, category, sort_order, is_published, files:kumani_document_files(id, locale, format, file_name, size_bytes, uploaded_at)')
    .order('sort_order')
    .order('created_at')
  if (error) return { success: false, error: error.code === '42P01' ? 'Esegui la migrazione 20261218100000_documents.sql.' : error.message }
  return { success: true, documents: (data ?? []) as unknown as KumaniDoc[] }
}

export async function adminSaveDocument(input: {
  id?: string
  title: Localized
  description: Localized
  category: DocCategory
  sort_order: number
  is_published: boolean
}): Promise<Result<{ id: string }>> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const title = clean(input.title, 120)
  if (!title.it) return { success: false, error: 'Scrivi almeno il titolo in italiano' }
  const row = {
    title,
    description: clean(input.description, 400),
    category: DOC_CATEGORIES.includes(input.category) ? input.category : 'other',
    sort_order: Number.isFinite(input.sort_order) ? Math.round(input.sort_order) : 0,
    is_published: Boolean(input.is_published),
    updated_at: new Date().toISOString(),
  }
  const q = input.id
    ? db().from('kumani_documents').update(row).eq('id', input.id).select('id').single()
    : db().from('kumani_documents').insert(row).select('id').single()
  const { data, error } = await q
  if (error || !data) return { success: false, error: error?.message ?? 'Salvataggio non riuscito' }
  return { success: true, id: data.id }
}

export async function adminDeleteDocument(id: string): Promise<Result> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const { data: files } = await db().from('kumani_document_files').select('storage_path').eq('document_id', id)
  if (files?.length) await db().storage.from(DOC_BUCKET).remove(files.map((f) => f.storage_path))
  const { error } = await db().from('kumani_documents').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// 1. Link di caricamento firmato per un file (lingua + formato)
export async function adminCreateDocUploadUrl(input: { documentId: string; locale: DocLocale; format: DocFormat; size: number }): Promise<Result<{ path: string; token: string }>> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  if (!DOC_LOCALES.includes(input.locale) || !DOC_FORMATS.includes(input.format)) return { success: false, error: 'Lingua o formato non validi' }
  if (!(input.size > 0) || input.size > DOC_MAX_BYTES) return { success: false, error: 'Il file deve pesare al massimo 50 MB' }
  const path = `${input.documentId}/${input.locale}/${randomBytes(8).toString('hex')}.${input.format}`
  const { data, error } = await db().storage.from(DOC_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return { success: false, error: error?.message ?? 'Caricamento non disponibile' }
  return { success: true, path: data.path, token: data.token }
}

// 2. Dopo il caricamento: registra il file e toglie quello vecchio della stessa lingua e formato
export async function adminConfirmDocUpload(input: { documentId: string; locale: DocLocale; format: DocFormat; path: string; fileName: string; size: number }): Promise<Result> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  if (!input.path.startsWith(`${input.documentId}/${input.locale}/`)) return { success: false, error: 'Percorso non valido' }
  const { data: old } = await db()
    .from('kumani_document_files')
    .select('storage_path')
    .eq('document_id', input.documentId)
    .eq('locale', input.locale)
    .eq('format', input.format)
    .maybeSingle()
  const fileName = input.fileName.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120) || `documento.${input.format}`
  const { error } = await db()
    .from('kumani_document_files')
    .upsert(
      { document_id: input.documentId, locale: input.locale, format: input.format, storage_path: input.path, file_name: fileName, size_bytes: input.size, uploaded_at: new Date().toISOString() },
      { onConflict: 'document_id,locale,format' },
    )
  if (error) return { success: false, error: error.message }
  if (old?.storage_path && old.storage_path !== input.path) await db().storage.from(DOC_BUCKET).remove([old.storage_path])
  await db().from('kumani_documents').update({ updated_at: new Date().toISOString() }).eq('id', input.documentId)
  return { success: true }
}

export async function adminDeleteDocFile(fileId: string): Promise<Result> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const { data: file } = await db().from('kumani_document_files').select('storage_path').eq('id', fileId).maybeSingle()
  if (!file) return { success: false, error: 'File non trovato' }
  await db().storage.from(DOC_BUCKET).remove([file.storage_path])
  const { error } = await db().from('kumani_document_files').delete().eq('id', fileId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

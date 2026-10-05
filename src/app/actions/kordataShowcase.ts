'use server'

import { randomBytes } from 'node:crypto'
import { updateTag } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isToolOnline } from '@/lib/toolOnline'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { localizedPath, notifyUser } from '@/lib/push'
import { SHOWCASE_CACHE_TAG, SHOWCASE_REJECT_REASONS, type ShowcaseInfo, type ShowcaseRejectReason } from '@/lib/convivio'

// Kordata in vetrina in homepage: foto del lotto, richiesta del capocordata
// o del fornitore confermato, approvazione dello Staff. Le regole (chi può,
// quali lotti) sono nelle funzioni SQL convivio_*showcase*.

const BUCKET = 'convivio-photos'
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Errore SQL → codice per i testi (kordataShowcase.error_*)
function code(message: string | undefined): string {
  if (message?.includes('suspended')) return 'suspended'
  if (message?.includes('not_eligible')) return 'not_eligible'
  if (message?.includes('not_allowed')) return 'not_allowed'
  return 'saveError'
}

export async function getShowcaseInfo(groupId: string): Promise<ShowcaseInfo | null> {
  if (!ID_RE.test(groupId)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('convivio_showcase_info', { p_group: groupId })
  return (data as ShowcaseInfo | null) ?? null
}

// Foto del lotto (già ridotta nel browser): nella cartella di chi la carica
export async function uploadConvivioPhoto(groupId: string, formData: FormData): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!ID_RE.test(groupId)) return { ok: false, error: 'saveError' }
  if (!(await isToolOnline('convivio'))) return { ok: false, error: 'suspended' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_allowed' }
  const { data: allowed } = await supabase.rpc('convivio_can_manage', { p_group: groupId })
  if (allowed !== true) return { ok: false, error: 'not_allowed' }

  const file = formData.get('file')
  const types: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  if (!(file instanceof File) || !types[file.type] || file.size > 2 * 1024 * 1024) return { ok: false, error: 'photoError' }

  const db = service()
  const path = `${user.id}/${groupId}-${randomBytes(6).toString('hex')}.${types[file.type]}`
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false, error: 'photoError' }
  const { data: old, error } = await supabase.rpc('convivio_set_photo', { p_group: groupId, p_path: path })
  if (error) {
    await db.storage.from(BUCKET).remove([path])
    return { ok: false, error: code(error.message) }
  }
  if (typeof old === 'string' && old) await db.storage.from(BUCKET).remove([old])
  updateTag(SHOWCASE_CACHE_TAG)
  return { ok: true, path }
}

export async function removeConvivioPhoto(groupId: string): Promise<string> {
  if (!ID_RE.test(groupId)) return 'saveError'
  const supabase = await createClient()
  const { data: old, error } = await supabase.rpc('convivio_set_photo', { p_group: groupId, p_path: null })
  if (error) return code(error.message)
  if (typeof old === 'string' && old) await service().storage.from(BUCKET).remove([old])
  updateTag(SHOWCASE_CACHE_TAG)
  return 'ok'
}

export async function requestShowcase(groupId: string): Promise<string> {
  if (!ID_RE.test(groupId)) return 'saveError'
  const supabase = await createClient()
  const { error } = await supabase.rpc('convivio_request_showcase', { p_group: groupId })
  return error ? code(error.message) : 'ok'
}

export async function cancelShowcase(groupId: string): Promise<string> {
  if (!ID_RE.test(groupId)) return 'saveError'
  const supabase = await createClient()
  const { error } = await supabase.rpc('convivio_cancel_showcase', { p_group: groupId })
  if (error) return code(error.message)
  updateTag(SHOWCASE_CACHE_TAG)
  return 'ok'
}

// ---------- Admin ----------

export type AdminShowcaseItem = {
  id: string
  title: string
  category: string
  city: string | null
  supplier_name: string
  unit_label: string
  retail_price: number | null
  group_price: number
  min_participants: number
  max_participants: number | null
  expires_at: string
  status: string
  people: number
  showcase_status: 'requested' | 'approved' | 'rejected' | 'removed'
  showcase_reason: ShowcaseRejectReason | null
  showcase_requested_at: string | null
  showcase_reviewed_at: string | null
  eligible: boolean
  photo_path: string | null
  description: string
  leader_id: string
  supplier_id: string | null
  leader_email: string | null
  leader_full_name: string
  requested_by_supplier: boolean
}

export async function listShowcaseAdmin(): Promise<{ items: AdminShowcaseItem[]; error: string | null }> {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { items: [], error: 'Non autorizzato' }
  const { data, error } = await service().rpc('convivio_showcase_admin_list')
  if (error) return { items: [], error: error.message }
  return { items: (data ?? []) as AdminShowcaseItem[], error: null }
}

// Approva, rifiuta (con motivo) o toglie dalla vetrina; avvisa capocordata e
// fornitore.
export async function moderateShowcase(
  groupId: string,
  action: 'approve' | 'reject' | 'remove',
  reason?: ShowcaseRejectReason
): Promise<{ success: boolean; error: string | null }> {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!ID_RE.test(groupId)) return { success: false, error: 'Kordata non trovata' }
  if (action !== 'approve' && (!reason || !SHOWCASE_REJECT_REASONS.includes(reason))) return { success: false, error: 'Scegli il motivo' }
  const db = service()
  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'removed'
  const from = action === 'remove' ? ['approved'] : ['requested', 'rejected', 'removed']
  const { data, error } = await db
    .from('convivio_groups')
    .update({ showcase_status: status, showcase_reason: action === 'approve' ? null : reason, showcase_reviewed_at: new Date().toISOString() })
    .eq('id', groupId)
    .in('showcase_status', from)
    .select('leader_id, supplier_id, supplier_status, title')
    .maybeSingle()
  if (error || !data) return { success: false, error: error?.message ?? 'Stato cambiato nel frattempo: ricarica' }
  updateTag(SHOWCASE_CACHE_TAG)

  const people = new Set<string>([data.leader_id as string])
  if (data.supplier_id && data.supplier_status === 'confirmed') people.add(data.supplier_id as string)
  const stamp = new Date().toISOString().slice(0, 16)
  for (const userId of people) {
    await notifyUser(
      userId,
      'staff',
      (t, locale) => {
        const url = localizedPath(locale, `/marketplace/convivio/${groupId}`)
        if (action === 'approve') return { title: t('showcaseApprovedTitle'), body: t('showcaseApprovedBody', { title: data.title as string }), url, tag: `showcase-${groupId}` }
        const why = t(`showcaseReason_${reason}`)
        return action === 'reject'
          ? { title: t('showcaseRejectedTitle'), body: t('showcaseRejectedBody', { title: data.title as string, reason: why }), url, tag: `showcase-${groupId}` }
          : { title: t('showcaseRemovedTitle'), body: t('showcaseRemovedBody', { title: data.title as string, reason: why }), url, tag: `showcase-${groupId}` }
      },
      { kind: `showcase_${status}`, ref: `${groupId}:${stamp}` }
    )
  }
  return { success: true, error: null }
}

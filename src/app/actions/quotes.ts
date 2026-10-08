'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasActivePreventiviAccess } from '@/lib/quotes-server'
import {
  MAX_QUOTE_LAYERS,
  MAX_QUOTE_PRESETS,
  MAX_QUOTE_SECTIONS,
  QUOTE_SECTION_KINDS,
  QUOTE_LAYOUTS,
  QUOTE_LOGO_POSITIONS,
  QUOTE_VAT_MODES,
  computeQuoteTotal,
  computeSectionsTotal,
  type QuoteFormData,
  type QuoteItem,
  type QuoteLayer,
  type QuotePreset,
  type QuoteSection,
  type SavedClientRow,
  type SavedClientFormData,
} from '@/lib/quotes'
import { awardToolPoint } from '@/lib/toolPoints'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Righe ricostruite campo per campo: productId resta solo se è un uuid
function cleanItems(items: QuoteItem[]): QuoteItem[] {
  return (Array.isArray(items) ? items : []).map((item) => {
    const row: QuoteItem = {
      description: String(item?.description ?? ''),
      quantity: Number(item?.quantity) || 0,
      unitPrice: Number(item?.unitPrice) || 0,
    }
    if (typeof item?.productId === 'string' && UUID_RE.test(item.productId)) row.productId = item.productId
    return row
  })
}

const SECTION_KINDS = QUOTE_SECTION_KINDS
const HEX = /^#[0-9a-f]{6}$/i
function cleanLayers(layers: unknown): QuoteLayer[] {
  return (Array.isArray(layers) ? layers : [])
    .slice(0, MAX_QUOTE_LAYERS)
    .map((l) => ({ label: clip((l as QuoteLayer)?.label, 160), color: HEX.test(String((l as QuoteLayer)?.color)) ? String((l as QuoteLayer).color) : '#cfcfcf' }))
    .filter((l) => l.label.trim())
}
const clip = (v: unknown, max: number) => String(v ?? '').slice(0, max)

// Sezioni del preventivo descrittivo ricostruite campo per campo
function cleanSections(sections: QuoteSection[], userId: string): QuoteSection[] {
  return (Array.isArray(sections) ? sections : [])
    .slice(0, MAX_QUOTE_SECTIONS)
    .map((s) => {
      const amount = s?.amount === null || s?.amount === undefined || String(s.amount) === '' ? null : Number(s.amount)
      const kind = SECTION_KINDS.includes(s?.kind) ? s.kind : 'text'
      const section: QuoteSection = {
        title: clip(s?.title, 160),
        kind,
        body: clip(s?.body, 6000),
        amount: amount !== null && Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null,
      }
      // Immagine: solo dalla propria cartella delle immagini dei preventivi
      if (kind === 'image' && typeof s.image === 'string' && s.image.startsWith(`${userId}/quote-images/`) && /^[0-9a-f-]{36}\/quote-images\/[A-Za-z0-9._-]{1,80}$/i.test(s.image)) section.image = s.image
      if (kind === 'layers') section.layers = cleanLayers(s.layers)
      return section
    })
    .filter((s) => s.title.trim() || s.body.trim() || s.amount !== null || s.image || (s.layers?.length ?? 0) > 0)
}

// Campi comuni di salvataggio (le due modalità)
function quoteFields(form: QuoteFormData, userId: string) {
  const layout = QUOTE_LAYOUTS.includes(form.layout) ? form.layout : 'table'
  const items = layout === 'table' ? cleanItems(form.items) : []
  const sections = layout === 'descriptive' ? cleanSections(form.sections, userId) : []
  return {
    layout,
    logo_position: QUOTE_LOGO_POSITIONS.includes(form.logoPosition) ? form.logoPosition : 'left',
    subject: clip(form.subject, 300) || null,
    intro: clip(form.intro, 3000) || null,
    closing: clip(form.closing, 1000) || null,
    sections,
    show_total: form.showTotal !== false,
    vat_mode: QUOTE_VAT_MODES.includes(form.vatMode) ? form.vatMode : 'plus',
    signature: form.signature !== false,
    client_name: form.clientName,
    client_email: form.clientEmail || null,
    client_phone: form.clientPhone || null,
    client_address: form.clientAddress || null,
    client_city: form.clientCity || null,
    client_postal_code: form.clientPostalCode || null,
    client_pec: form.clientPec || null,
    client_vat: form.clientVat || null,
    issue_date: form.issueDate,
    valid_until: form.validUntil || null,
    items,
    payment_info: form.paymentInfo || null,
    notes: form.notes || null,
    total: layout === 'descriptive' ? computeSectionsTotal(sections) : computeQuoteTotal(items),
  }
}

// Ricorda l'ultima posizione del logo scelta (proposta nei preventivi nuovi)
async function rememberLogoPosition(supabase: SupabaseClient, userId: string, position: string) {
  try {
    await supabase.from('quote_issuer_profiles').update({ quote_logo_position: position }).eq('user_id', userId)
  } catch {
    // facoltativo
  }
}

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }

async function requireActivePreventiviAccess(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'notLoggedIn' }
  }

  const hasAccess = await hasActivePreventiviAccess(supabase, user.id)
  if (!hasAccess) {
    return { ok: false, message: 'subscriptionRequired' }
  }

  return { ok: true, userId: user.id }
}

/**
 * "Fill once, reuse" for clients, same idea as the issuer's Business
 * Profile: every quote save also remembers the client (matched by name,
 * case-insensitive) so it can be picked again on a future quote instead of
 * retyped. Best-effort — a failure here must not fail the quote save that
 * already succeeded.
 */
async function upsertSavedClient(supabase: SupabaseClient, userId: string, form: QuoteFormData) {
  const name = form.clientName.trim()
  if (!name) return
  try {
    const payload = {
      user_id: userId,
      name,
      vat: form.clientVat || null,
      address: form.clientAddress || null,
      city: form.clientCity || null,
      postal_code: form.clientPostalCode || null,
      pec: form.clientPec || null,
      email: form.clientEmail || null,
      phone: form.clientPhone || null,
      updated_at: new Date().toISOString(),
    }
    const { data: existing } = await supabase
      .from('quote_clients')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', name)
      .maybeSingle()

    if (existing) {
      await supabase.from('quote_clients').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('quote_clients').insert(payload)
    }
  } catch (err) {
    console.error('[Quotes] upsertSavedClient failed (non-blocking):', err)
  }
}

export async function listSavedClients(): Promise<ActionResult<SavedClientRow[]>> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quote_clients')
    .select('*')
    .eq('user_id', gate.userId)
    .order('name')

  if (error) {
    console.error('[Quotes] listSavedClients failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: data || [] }
}

/** Quick-edit for a saved client (e.g. fixing a typo spotted while filling a new quote). */
export async function updateSavedClient(id: string, form: SavedClientFormData): Promise<ActionResult<null>> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('quote_clients')
    .update({
      name: form.name.trim(),
      vat: form.vat || null,
      address: form.address || null,
      city: form.city || null,
      postal_code: form.postalCode || null,
      pec: form.pec || null,
      email: form.email || null,
      phone: form.phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[Quotes] updateSavedClient failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
}

export async function createQuote(
  form: QuoteFormData
): Promise<ActionResult<{ id: string; quote_number: number }>> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const fields = quoteFields(form, gate.userId)

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: maxRow } = await supabase
      .from('quotes')
      .select('quote_number')
      .eq('user_id', gate.userId)
      .order('quote_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextNumber = (maxRow?.quote_number || 0) + 1

    const { data, error } = await supabase
      .from('quotes')
      .insert({
        user_id: gate.userId,
        quote_number: nextNumber,
        ...fields,
      })
      .select('id, quote_number')
      .single()

    if (!error && data) {
      await awardToolPoint('preventivi')
      await upsertSavedClient(supabase, gate.userId, form)
      await rememberLogoPosition(supabase, gate.userId, fields.logo_position)
      return { success: true, data: { id: data.id, quote_number: data.quote_number } }
    }

    if (error && error.code !== '23505') {
      console.error('[Quotes] createQuote failed:', error)
      return { success: false, message: 'saveError' }
    }
    // 23505 (unique violation on quote_number): another quote was created
    // concurrently by this same user — retry with a freshly read max.
  }

  return { success: false, message: 'saveError' }
}

export async function updateQuote(id: string, form: QuoteFormData): Promise<ActionResult<null>> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const fields = quoteFields(form, gate.userId)

  const { error } = await supabase
    .from('quotes')
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[Quotes] updateQuote failed:', error)
    return { success: false, message: 'saveError' }
  }

  await upsertSavedClient(supabase, gate.userId, form)
  await rememberLogoPosition(supabase, gate.userId, fields.logo_position)
  return { success: true, data: null }
}

// «Duplica preventivo»: copia completa con un nuovo numero e la data di oggi
export async function duplicateQuote(id: string): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }
  const supabase = await createClient()
  const { data: source } = await supabase.from('quotes').select('*').eq('id', id).eq('user_id', gate.userId).maybeSingle()
  if (!source) return { success: false, message: 'saveError' }
  const copy = { ...source } as Record<string, unknown>
  for (const key of ['id', 'quote_number', 'created_at', 'updated_at', 'stock_unloaded_at']) delete copy[key]
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: maxRow } = await supabase
      .from('quotes')
      .select('quote_number')
      .eq('user_id', gate.userId)
      .order('quote_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data, error } = await supabase
      .from('quotes')
      .insert({ ...copy, quote_number: (maxRow?.quote_number || 0) + 1, issue_date: new Date().toISOString().slice(0, 10) })
      .select('id')
      .single()
    if (!error && data) return { success: true, data: { id: data.id } }
    if (error && error.code !== '23505') {
      console.error('[Quotes] duplicateQuote failed:', error)
      return { success: false, message: 'saveError' }
    }
  }
  return { success: false, message: 'saveError' }
}

// ---- Sezioni pronte (profilo azienda)

function cleanPresets(presets: QuotePreset[]): QuotePreset[] {
  return (Array.isArray(presets) ? presets : [])
    .slice(0, MAX_QUOTE_PRESETS)
    .map((p) => {
      // Le immagini non diventano sezioni pronte (restano nel preventivo)
      const kind = SECTION_KINDS.includes(p?.kind) && p.kind !== 'image' ? p.kind : 'text'
      const preset: QuotePreset = { title: clip(p?.title, 160), kind, body: clip(p?.body, 6000) }
      if (kind === 'layers') preset.layers = cleanLayers(p.layers)
      return preset
    })
    .filter((p) => p.title.trim() || p.body.trim() || (p.layers?.length ?? 0) > 0)
}

export async function listQuotePresets(): Promise<QuotePreset[]> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return []
  const supabase = await createClient()
  const { data } = await supabase.from('quote_issuer_profiles').select('quote_presets').eq('user_id', gate.userId).maybeSingle()
  return cleanPresets((data?.quote_presets ?? []) as QuotePreset[])
}

export async function saveQuotePresets(presets: QuotePreset[]): Promise<ActionResult<QuotePreset[]>> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }
  const supabase = await createClient()
  const clean = cleanPresets(presets)
  const { data: existing } = await supabase.from('quote_issuer_profiles').select('user_id').eq('user_id', gate.userId).maybeSingle()
  const { error } = existing
    ? await supabase.from('quote_issuer_profiles').update({ quote_presets: clean }).eq('user_id', gate.userId)
    : await supabase.from('quote_issuer_profiles').insert({ user_id: gate.userId, quote_presets: clean })
  if (error) {
    console.error('[Quotes] saveQuotePresets failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: clean }
}

export async function deleteQuote(id: string): Promise<ActionResult<null>> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase.from('quotes').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Quotes] deleteQuote failed:', error)
    return { success: false, message: 'deleteError' }
  }

  return { success: true, data: null }
}

export type UnloadQuoteResult =
  | { ok: true; count: number }
  | { ok: false; error: 'not_allowed' | 'not_found' | 'already' | 'no_products' | 'insufficient' | 'failed'; name?: string; stock?: number }

/** Preventivo venduto → toglie dal Magazzino i prodotti collegati alle righe (una volta sola, tutto o niente). */
export async function unloadQuoteStock(quoteId: string): Promise<UnloadQuoteResult> {
  if (!UUID_RE.test(quoteId)) return { ok: false, error: 'not_found' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_allowed' }

  const { data, error } = await supabase.rpc('quote_unload_stock', { p_quote: quoteId })
  if (error || !data) {
    console.error('[Quotes] unloadQuoteStock failed:', error)
    return { ok: false, error: 'failed' }
  }
  const res = data as { ok?: boolean; count?: number; error?: string; name?: string; stock?: number }
  if (res.ok) return { ok: true, count: Number(res.count) || 0 }
  const known = ['not_allowed', 'not_found', 'already', 'no_products', 'insufficient'] as const
  const code = known.find((k) => k === res.error) ?? 'failed'
  return { ok: false, error: code, name: res.name, stock: res.stock !== undefined ? Number(res.stock) : undefined }
}

// Dati completi per PDF e condivisione dall'elenco dei preventivi (che ha solo
// numero, cliente, data e totale): preventivo, profilo azienda e logo
export async function getQuotePdfData(id: string): Promise<
  ActionResult<{ quote: Record<string, unknown>; issuer: Record<string, unknown> | null; logoUrl: string | null }>
> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }
  const supabase = await createClient()
  const [{ data: quote }, { data: issuer }] = await Promise.all([
    supabase.from('quotes').select('*').eq('id', id).eq('user_id', gate.userId).maybeSingle(),
    supabase.from('quote_issuer_profiles').select('*').eq('user_id', gate.userId).maybeSingle(),
  ])
  if (!quote) return { success: false, message: 'saveError' }
  const logoUrl = issuer?.logo_path ? supabase.storage.from('quote-logos-v2').getPublicUrl(issuer.logo_path).data.publicUrl : null
  return { success: true, data: { quote, issuer, logoUrl } }
}

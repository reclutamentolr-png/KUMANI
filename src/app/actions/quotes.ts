'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasActivePreventiviAccess } from '@/lib/quotes-server'
import {
  computeQuoteTotal,
  type QuoteFormData,
  type QuoteItem,
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
  const items = cleanItems(form.items)
  const total = computeQuoteTotal(items)

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
        total,
      })
      .select('id, quote_number')
      .single()

    if (!error && data) {
      await awardToolPoint('preventivi')
      await upsertSavedClient(supabase, gate.userId, form)
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
  const items = cleanItems(form.items)
  const total = computeQuoteTotal(items)

  const { error } = await supabase
    .from('quotes')
    .update({
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
      total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[Quotes] updateQuote failed:', error)
    return { success: false, message: 'saveError' }
  }

  await upsertSavedClient(supabase, gate.userId, form)
  return { success: true, data: null }
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

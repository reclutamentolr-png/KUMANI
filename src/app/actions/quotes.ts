'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasActivePreventiviAccess } from '@/lib/quotes-server'
import {
  computeQuoteTotal,
  type QuoteFormData,
  type IssuerProfileFormData,
  type IssuerProfileRow,
  type SavedClientRow,
  type SavedClientFormData,
} from '@/lib/quotes'
import { awardToolPoint } from '@/lib/toolPoints'

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

export async function getIssuerProfile(): Promise<ActionResult<IssuerProfileRow | null>> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data } = await supabase.from('quote_issuer_profiles').select('*').eq('user_id', gate.userId).maybeSingle()

  return { success: true, data: data || null }
}

export async function saveIssuerProfile(
  form: IssuerProfileFormData,
  logoPath: string | null
): Promise<ActionResult<null>> {
  const gate = await requireActivePreventiviAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()

  const payload: Partial<IssuerProfileRow> = {
    user_id: gate.userId,
    company_name: form.companyName || null,
    vat_number: form.vatNumber || null,
    address: form.address || null,
    city: form.city || null,
    postal_code: form.postalCode || null,
    province: form.province || null,
    pec: form.pec || null,
    email: form.email || null,
    phone: form.phone || null,
    updated_at: new Date().toISOString(),
  }
  // Only overwrite logo_path when a new logo was actually uploaded in this
  // save — passing null here would wipe a previously saved logo every time
  // the profile is edited without touching the logo field.
  // Solo percorsi nella cartella dell'utente (come saveMenuItem)
  if (logoPath && logoPath.startsWith(`${gate.userId}/`) && !logoPath.includes('..')) payload.logo_path = logoPath

  const { error } = await supabase.from('quote_issuer_profiles').upsert(payload, { onConflict: 'user_id' })

  if (error) {
    console.error('[Quotes] saveIssuerProfile failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
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
  const total = computeQuoteTotal(form.items)

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
        items: form.items,
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
  const total = computeQuoteTotal(form.items)

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
      items: form.items,
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

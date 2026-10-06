'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import type { MyDonations } from '@/lib/donationTypes'
import { refreshDonationSummary } from '@/lib/donationsPublic'

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const refresh = () => {
  refreshDonationSummary()
  revalidatePath('/', 'layout')
}

// ---------------------------------------------------------------------------
// Pubblico e Kumano
// ---------------------------------------------------------------------------

export async function getMyDonations(): Promise<MyDonations | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_donations')
  if (error || !data) return null
  return data as MyDonations
}

export async function donateNetworkPoints(points: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('donate_network_points', { p_points: Math.round(points) })
    .maybeSingle<{ success: boolean; reason: string | null; amount_cents: number; new_network_points: number }>()
  if (error || !data) return { success: false as const, reason: 'error' }
  if (!data.success) return { success: false as const, reason: data.reason ?? 'error' }
  refresh()
  return { success: true as const, amountCents: data.amount_cents, points: data.new_network_points }
}

// ---------------------------------------------------------------------------
// Admin → Donazioni
// ---------------------------------------------------------------------------

export type AdminAssociation = {
  id: string
  name: string
  tax_code: string | null
  description: string | null
  mission: string | null
  website: string | null
  logo_url: string | null
  is_active: boolean
  accrued_cents: number
  paid_cents: number
}

export type AdminPayout = {
  id: string
  association_id: string
  association: string
  amount_cents: number
  paid_on: string
  reference: string | null
  receipt_url: string | null
  notes: string | null
}

export async function adminGetDonations() {
  if (!(await verifyAdmin('settings.read'))) return { error: 'Non autorizzato' as const }
  const service = db()
  const [{ data: associations }, { data: entries }, { data: payouts }, { data: settings }] = await Promise.all([
    service.from('donation_associations').select('*').order('is_active', { ascending: false }).order('created_at', { ascending: false }),
    service.from('donation_entries').select('association_id, amount_cents, source, reversed_at'),
    service.from('donation_payouts').select('*').order('paid_on', { ascending: false }),
    service.from('system_settings').select('key, value').in('key', ['donation_percent_bp', 'donation_point_value_cents']),
  ])
  const accrued = new Map<string, number>()
  let subscriptionCents = 0
  let pointsCents = 0
  for (const e of entries ?? []) {
    if (e.reversed_at) continue
    accrued.set(e.association_id, (accrued.get(e.association_id) ?? 0) + e.amount_cents)
    if (e.source === 'points') pointsCents += e.amount_cents
    else subscriptionCents += e.amount_cents
  }
  const paid = new Map<string, number>()
  for (const p of payouts ?? []) paid.set(p.association_id, (paid.get(p.association_id) ?? 0) + p.amount_cents)
  const names = new Map((associations ?? []).map((a) => [a.id, a.name as string]))
  const setting = (key: string, fallback: number) =>
    Number(String((settings ?? []).find((s) => s.key === key)?.value ?? fallback).replace(/"/g, '')) || 0
  return {
    error: null,
    associations: (associations ?? []).map((a) => ({ ...a, accrued_cents: accrued.get(a.id) ?? 0, paid_cents: paid.get(a.id) ?? 0 })) as AdminAssociation[],
    payouts: (payouts ?? []).map((p) => ({ ...p, association: names.get(p.association_id) ?? '—' })) as AdminPayout[],
    settings: {
      // Percentuale di ogni abbonamento, in centesimi di punto (500 = 5%)
      percentBp: setting('donation_percent_bp', 500),
      pointValueCents: setting('donation_point_value_cents', 10),
    },
    totals: { subscriptionCents, pointsCents },
  }
}

const clean = (value: string | null | undefined, max: number) => {
  const v = String(value ?? '').trim().slice(0, max)
  return v || null
}
const cleanUrl = (value: string | null | undefined) => {
  const v = clean(value, 600)
  if (!v) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

export async function adminSaveAssociation(input: {
  id?: string
  name: string
  tax_code?: string
  description?: string
  mission?: string
  website?: string
  logo_url?: string
}) {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const name = clean(input.name, 160)
  if (!name || name.length < 2) return { success: false, error: "Indica il nome dell'associazione." }
  const row = {
    name,
    tax_code: clean(input.tax_code, 32),
    description: clean(input.description, 2000),
    mission: clean(input.mission, 300),
    website: cleanUrl(input.website),
    logo_url: cleanUrl(input.logo_url),
    updated_at: new Date().toISOString(),
  }
  const service = db()
  const { error } = input.id
    ? await service.from('donation_associations').update(row).eq('id', input.id)
    : await service.from('donation_associations').insert(row)
  if (error) return { success: false, error: error.message }
  refresh()
  return { success: true }
}

// Una sola associazione attiva: le nuove donazioni vanno a lei (null = nessuna)
export async function adminSetActiveAssociation(id: string | null) {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const service = db()
  const { error: offError } = await service.from('donation_associations').update({ is_active: false }).eq('is_active', true)
  if (offError) return { success: false, error: offError.message }
  if (id) {
    const { error } = await service.from('donation_associations').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return { success: false, error: error.message }
  }
  refresh()
  return { success: true }
}

export async function adminAddPayout(input: { association_id: string; amount_eur: number; paid_on: string; reference?: string; receipt_url?: string; notes?: string }) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const cents = Math.round(Number(input.amount_eur) * 100)
  if (!Number.isFinite(cents) || cents <= 0) return { success: false, error: 'Importo non valido.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paid_on)) return { success: false, error: 'Data non valida.' }
  const { error } = await db().from('donation_payouts').insert({
    association_id: input.association_id,
    amount_cents: cents,
    paid_on: input.paid_on,
    reference: clean(input.reference, 200),
    receipt_url: cleanUrl(input.receipt_url),
    notes: clean(input.notes, 1000),
    created_by: admin.id,
  })
  if (error) return { success: false, error: error.message }
  refresh()
  return { success: true }
}

export async function adminDeletePayout(id: string) {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const { error } = await db().from('donation_payouts').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  refresh()
  return { success: true }
}

export async function adminSaveDonationSettings(input: { percentBp: number; pointValueCents: number }) {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  if (!Number.isInteger(input.percentBp) || input.percentBp < 0 || input.percentBp > 5000) return { success: false, error: 'Percentuale non valida (da 0 a 50%).' }
  if (!Number.isInteger(input.pointValueCents) || input.pointValueCents < 0 || input.pointValueCents > 100000) return { success: false, error: 'Valore del punto non valido.' }
  const { error } = await db()
    .from('system_settings')
    .upsert(
      [
        { key: 'donation_percent_bp', value: String(input.percentBp) },
        { key: 'donation_point_value_cents', value: String(input.pointValueCents) },
      ],
      { onConflict: 'key' }
    )
  if (error) return { success: false, error: error.message }
  refresh()
  return { success: true }
}

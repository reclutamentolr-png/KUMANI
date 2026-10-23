'use server'

import { randomBytes } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'

// Admin → «Codici omaggio»: abbonamenti di un anno (Plus o Pro) regalati
// dallo Staff per promuovere KUMANI. Sono voucher KVA- come quelli di
// «Voucher» (stessa attivazione, una sola volta), con purpose = 'promo', il
// nome di chi li riceve e una campagna facoltativa.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Stesso formato dei codici dello Staff in actions/admin.ts: alfabeto senza
// caratteri ambigui (0/O, 1/I), 14 caratteri casuali crittografici
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LENGTH = 14
const newCode = () => 'KVA-' + [...randomBytes(LENGTH)].map((b) => ALPHABET[b % ALPHABET.length]).join('')

const MAX_PROMO_PER_BATCH = 500

export type PromoCode = {
  id: string
  code: string
  plan: 'base' | 'pro'
  status: 'active' | 'redeemed' | 'revoked'
  recipientName: string | null
  campaign: string | null
  createdAt: string
  redeemedAt: string | null
  redeemer: { name: string; email: string | null } | null
}

const cleanName = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || null
const cleanCampaign = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || null

export async function listPromoCodes(): Promise<{ codes: PromoCode[] } | { error: string }> {
  if (!(await verifyAdmin('vouchers.read'))) return { error: 'Non autorizzato' }
  const service = db()
  const { data, error } = await service
    .from('subscription_vouchers')
    .select('id, code, plan, status, recipient_name, campaign, created_at, redeemed_at, redeemed_by')
    .eq('purpose', 'promo')
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) return { error: error.message }
  const rows = data ?? []
  // redeemed_by punta ad auth.users: i profili si leggono a parte
  const ids = [...new Set(rows.map((r) => r.redeemed_by).filter(Boolean))] as string[]
  const people = new Map<string, { name: string; email: string | null }>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data: profiles } = await service.from('profiles').select('id, first_name, last_name, email').in('id', ids.slice(i, i + 200))
    for (const p of profiles ?? []) people.set(p.id, { name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—', email: p.email ?? null })
  }
  return {
    codes: rows.map((r) => ({
      id: r.id,
      code: r.code,
      plan: r.plan === 'pro' ? 'pro' : 'base',
      status: r.status,
      recipientName: r.recipient_name,
      campaign: r.campaign,
      createdAt: r.created_at,
      redeemedAt: r.redeemed_at,
      redeemer: r.redeemed_by ? (people.get(r.redeemed_by) ?? { name: 'Account cancellato', email: null }) : null,
    })),
  }
}

// Un codice per ogni nome; senza nomi, «quantity» codici da assegnare dopo
export async function createPromoCodes(input: {
  plan: 'base' | 'pro'
  names: string[]
  quantity: number
  campaign: string
}): Promise<{ success: true; created: { code: string; recipientName: string | null }[] } | { success: false; error: string }> {
  const admin = await verifyAdmin('vouchers.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const plan = input.plan === 'pro' ? 'pro' : 'base'
  const names = input.names.map(cleanName).filter((n): n is string => !!n)
  const quantity = names.length || Math.floor(Number(input.quantity) || 0)
  if (quantity < 1) return { success: false, error: 'Scrivi almeno un nome oppure quanti codici vuoi.' }
  if (quantity > MAX_PROMO_PER_BATCH) return { success: false, error: `Al massimo ${MAX_PROMO_PER_BATCH} codici alla volta.` }
  const campaign = cleanCampaign(input.campaign)

  const service = db()
  const created: { code: string; recipientName: string | null }[] = []
  // Righe in blocchi; se un codice esistesse già (quasi impossibile), si
  // rigenera solo quel blocco
  for (let start = 0; start < quantity; start += 100) {
    const size = Math.min(100, quantity - start)
    let done = false
    for (let attempt = 0; attempt < 5 && !done; attempt++) {
      const rows = Array.from({ length: size }, (_, i) => ({
        code: newCode(),
        created_by: admin.id,
        status: 'active',
        plan,
        purpose: 'promo',
        recipient_name: names[start + i] ?? null,
        campaign,
      }))
      const { error } = await service.from('subscription_vouchers').insert(rows)
      if (!error) {
        created.push(...rows.map((r) => ({ code: r.code, recipientName: r.recipient_name })))
        done = true
      } else if (error.code !== '23505') {
        return created.length ? { success: true, created } : { success: false, error: error.message }
      }
    }
    if (!done) return created.length ? { success: true, created } : { success: false, error: 'Impossibile generare codici univoci. Riprova.' }
  }
  return { success: true, created }
}

// Nome e campagna si possono correggere anche dopo (pure se già attivato)
export async function updatePromoCode(id: string, input: { recipientName: string; campaign: string }): Promise<{ success: boolean; error?: string }> {
  if (!(await verifyAdmin('vouchers.write'))) return { success: false, error: 'Non autorizzato' }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false, error: 'Codice non valido' }
  const { error } = await db()
    .from('subscription_vouchers')
    .update({ recipient_name: cleanName(input.recipientName), campaign: cleanCampaign(input.campaign) })
    .eq('id', id)
    .eq('purpose', 'promo')
  return error ? { success: false, error: error.message } : { success: true }
}

// Solo un codice non ancora attivato si può revocare
export async function revokePromoCode(id: string): Promise<{ success: boolean; error?: string }> {
  if (!(await verifyAdmin('vouchers.write'))) return { success: false, error: 'Non autorizzato' }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false, error: 'Codice non valido' }
  const { data, error } = await db()
    .from('subscription_vouchers')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('purpose', 'promo')
    .eq('status', 'active')
    .select('id')
  if (error) return { success: false, error: error.message }
  return data?.length ? { success: true } : { success: false, error: 'Il codice è già stato attivato o revocato.' }
}

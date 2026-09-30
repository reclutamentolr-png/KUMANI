'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { findStripeSubscriptionForUser } from '@/lib/stripeCustomer'
import { isBusinessPurchase, proportionalRefund, withdrawableInvoices } from '@/lib/withdrawal'

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// ---------------------------------------------------------------------------
// Cliente: richiesta di recesso da /billing
// ---------------------------------------------------------------------------

export async function requestWithdrawal(reason: string): Promise<{ success: boolean; reason?: 'not_logged' | 'not_stripe' | 'business' | 'expired' | 'already' | 'error' }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, reason: 'not_logged' }

  const service = db()
  const { data: profile } = await service.from('profiles').select('subscription_status, subscription_source').eq('id', user.id).maybeSingle()
  if (profile?.subscription_status !== 'active' || profile.subscription_source !== 'stripe') return { success: false, reason: 'not_stripe' }

  try {
    const found = await findStripeSubscriptionForUser(user.id, user.email)
    const subscription = found?.subscription
    if (!subscription) return { success: false, reason: 'not_stripe' }
    if (isBusinessPurchase(subscription)) return { success: false, reason: 'business' }
    const invoices = await withdrawableInvoices(subscription.id)
    if (invoices.length === 0) return { success: false, reason: 'expired' }

    // Consenso all'avvio immediato dato per questi pagamenti (fino a un
    // giorno prima del più vecchio): decide il rimborso proporzionale.
    const earliest = Math.min(...invoices.map((inv) => inv.paidAt))
    const { data: consent } = await service
      .from('subscription_consents')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date((earliest - 86_400) * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await service.from('withdrawal_requests').insert({
      user_id: user.id,
      reason: reason.trim().slice(0, 1000) || null,
      stripe_subscription_id: subscription.id,
      invoice_ids: invoices.map((inv) => inv.id),
      amount_cents: invoices.reduce((sum, inv) => sum + inv.amountCents, 0),
      consent_at: consent?.created_at ?? null,
    })
    if (error) {
      if (error.code === '23505') return { success: false, reason: 'already' }
      console.error('❌ Richiesta di recesso non salvata:', error.message)
      return { success: false, reason: 'error' }
    }
    revalidatePath('/billing')
    return { success: true }
  } catch (err) {
    console.error('❌ Errore richiesta di recesso:', err)
    return { success: false, reason: 'error' }
  }
}

// ---------------------------------------------------------------------------
// Admin → Recessi
// ---------------------------------------------------------------------------

export type AdminWithdrawal = {
  id: string
  status: 'pending' | 'refunded' | 'rejected'
  reason: string | null
  requested_at: string
  handled_at: string | null
  amount_cents: number
  consent_at: string | null
  refund_mode: 'full' | 'proportional' | null
  refunded_cents: number | null
  admin_note: string | null
  stripe_subscription_id: string
  user: { first_name: string | null; last_name: string | null; email: string | null; subscription_plan: string | null } | null
  // Solo per le richieste in attesa: importi calcolati dalle fatture Stripe
  refundFullCents?: number
  refundProportionalCents?: number
}

export async function adminListWithdrawals(tab: 'pending' | 'handled'): Promise<{ items: AdminWithdrawal[]; error: string | null }> {
  if (!(await verifyAdmin('users.write'))) return { items: [], error: 'Permesso negato' }
  const query = db()
    .from('withdrawal_requests')
    .select(
      'id, status, reason, requested_at, handled_at, amount_cents, consent_at, refund_mode, refunded_cents, admin_note, stripe_subscription_id, invoice_ids, user:profiles!withdrawal_requests_user_id_fkey(first_name, last_name, email, subscription_plan)'
    )
    .order('requested_at', { ascending: tab === 'pending' })
    .limit(100)
  const { data, error } = tab === 'pending' ? await query.eq('status', 'pending') : await query.neq('status', 'pending')
  if (error) return { items: [], error: error.message }

  type Row = Omit<AdminWithdrawal, 'user'> & { invoice_ids: string[]; user: AdminWithdrawal['user'] | AdminWithdrawal['user'][] }
  const rows = (data ?? []) as unknown as Row[]
  const items = await Promise.all(
    rows.map(async ({ invoice_ids, user, ...row }) => {
      const item: AdminWithdrawal = { ...row, user: Array.isArray(user) ? (user[0] ?? null) : user }
      if (row.status !== 'pending') return item
      try {
        const amounts = await refundAmounts(invoice_ids, Math.floor(new Date(row.requested_at).getTime() / 1000))
        item.refundFullCents = amounts.reduce((sum, a) => sum + a.full, 0)
        item.refundProportionalCents = amounts.reduce((sum, a) => sum + a.proportional, 0)
      } catch (err) {
        console.error('Importi recesso non calcolati:', err)
      }
      return item
    })
  )
  return { items, error: null }
}

// Per ogni fattura: pagamento da rimborsare, importo totale e proporzionale
// (parte non usata dal momento della richiesta).
async function refundAmounts(invoiceIds: string[], requestedAt: number) {
  const stripe = getStripe()
  return Promise.all(
    invoiceIds.map(async (id) => {
      const invoice = (await stripe.invoices.retrieve(id)) as Awaited<ReturnType<typeof stripe.invoices.retrieve>> & {
        payment_intent?: string | { id: string } | null
      }
      const main = invoice.lines.data.reduce<(typeof invoice.lines.data)[number] | undefined>(
        (best, line) => (!best || line.amount > best.amount ? line : best),
        undefined
      )
      const paidAt = invoice.status_transitions?.paid_at ?? invoice.created
      const full = invoice.amount_paid
      const proportional = proportionalRefund(
        { amountCents: full, periodStart: main?.period?.start ?? paidAt, periodEnd: main?.period?.end ?? paidAt },
        requestedAt
      )
      const pi = invoice.payment_intent
      return { id, paymentIntent: typeof pi === 'string' ? pi : (pi?.id ?? null), full, proportional }
    })
  )
}

// Accetta il recesso: rimborsa su Stripe (totale o parte non usata), chiude
// subito l'abbonamento e riporta il profilo al piano gratuito. Il webhook
// charge.refunded annulla anche l'eventuale provvigione dell'agente.
export async function adminRefundWithdrawal(id: string, mode: 'full' | 'proportional', note: string): Promise<{ success: boolean; error?: string }> {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false, error: 'Permesso negato' }
  const service = db()
  const { data: request } = await service
    .from('withdrawal_requests')
    .select('id, user_id, status, invoice_ids, requested_at, stripe_subscription_id')
    .eq('id', id)
    .maybeSingle()
  if (!request || request.status !== 'pending') return { success: false, error: 'Richiesta non trovata o già gestita' }

  const stripe = getStripe()
  const refundIds: string[] = []
  let refunded = 0
  try {
    const amounts = await refundAmounts(request.invoice_ids, Math.floor(new Date(request.requested_at).getTime() / 1000))
    for (const item of amounts) {
      const amount = mode === 'full' ? item.full : item.proportional
      if (!item.paymentIntent || amount <= 0) continue
      // Chiave di idempotenza: un doppio clic non rimborsa due volte
      const refund = await stripe.refunds.create(
        { payment_intent: item.paymentIntent, amount, reason: 'requested_by_customer', metadata: { withdrawal_request: id, invoice: item.id } },
        { idempotencyKey: `withdrawal-${id}-${item.id}-${mode}` }
      )
      refundIds.push(refund.id)
      refunded += amount
    }
  } catch (err) {
    console.error('❌ Rimborso recesso non riuscito:', err)
    return { success: false, error: `Rimborso non riuscito su Stripe: ${err instanceof Error ? err.message : 'errore'}` }
  }

  try {
    await stripe.subscriptions.cancel(request.stripe_subscription_id, { prorate: false })
  } catch (err) {
    // Già annullato: nessun problema
    console.error('Chiusura abbonamento dopo recesso:', err instanceof Error ? err.message : err)
  }
  await service.from('profiles').update({ subscription_status: 'free', subscription_source: null }).eq('id', request.user_id).eq('subscription_source', 'stripe')

  const { error } = await service
    .from('withdrawal_requests')
    .update({
      status: 'refunded',
      handled_at: new Date().toISOString(),
      handled_by: admin.id,
      refund_mode: mode,
      refunded_cents: refunded,
      refund_ids: refundIds,
      admin_note: note.trim().slice(0, 1000) || null,
    })
    .eq('id', id)
  if (error) return { success: false, error: `Rimborso eseguito, ma stato non salvato: ${error.message}` }
  return { success: true }
}

export async function adminRejectWithdrawal(id: string, note: string): Promise<{ success: boolean; error?: string }> {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false, error: 'Permesso negato' }
  if (!note.trim()) return { success: false, error: 'Scrivi il motivo del rifiuto: il cliente lo vedrà.' }
  const { data, error } = await db()
    .from('withdrawal_requests')
    .update({ status: 'rejected', handled_at: new Date().toISOString(), handled_by: admin.id, admin_note: note.trim().slice(0, 1000) })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Richiesta non trovata o già gestita' }
  return { success: true }
}

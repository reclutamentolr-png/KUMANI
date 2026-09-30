import type Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

// Provvigioni degli Agenti venditori, create dal webhook di Stripe:
// - invoice.paid: una provvigione per fattura di abbonamento pagata da un
//   cliente arrivato dal link di un agente (prima vendita o rinnovo);
// - charge.refunded: il rimborso annulla la provvigione (o, se era già
//   stata pagata all'agente, crea una rettifica negativa).
// La percentuale si applica all'imponibile (senza IVA).

function db() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Campi della fattura nella versione API usata (2024-06-20): alcuni non sono
// più nei tipi della libreria, quindi si leggono in modo prudente
type InvoiceLike = Stripe.Invoice & {
  subscription?: string | { id: string } | null
  payment_intent?: string | { id: string } | null
  subscription_details?: { metadata?: Record<string, string> | null } | null
  tax?: number | null
  total_excluding_tax?: number | null
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

async function vatRate(): Promise<number> {
  const { data } = await db().from('system_settings').select('value').eq('key', 'agent_commission_vat_rate').maybeSingle()
  const rate = Number(String(data?.value ?? '22').replace(/"/g, ''))
  return Number.isFinite(rate) && rate >= 0 && rate < 100 ? rate : 22
}

async function userIdOf(invoice: InvoiceLike): Promise<string | null> {
  const fromDetails = invoice.subscription_details?.metadata?.userId
  if (fromDetails) return fromDetails
  const subscriptionId = idOf(invoice.subscription)
  if (!subscriptionId) return null
  try {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId)
    return sub.metadata?.userId ?? null
  } catch {
    return null
  }
}

export async function recordAgentCommission(invoice: InvoiceLike): Promise<void> {
  if (!invoice.id || (invoice.amount_paid ?? 0) <= 0) return
  const reason = invoice.billing_reason
  // Prima vendita (anche il passaggio a Pro del cliente) o rinnovo annuale
  const kind = reason === 'subscription_create' || reason === 'subscription_update' ? 'first' : reason === 'subscription_cycle' ? 'renewal' : null
  if (!kind) return

  const userId = await userIdOf(invoice)
  if (!userId) return
  const client = db()
  const { data: customer } = await client.from('profiles').select('agent_id').eq('id', userId).maybeSingle()
  if (!customer?.agent_id) return
  const { data: agent } = await client
    .from('agents')
    .select('user_id, commission_first_pct, commission_renewal_pct')
    .eq('user_id', customer.agent_id)
    .maybeSingle()
  if (!agent) return

  const gross = invoice.amount_paid
  // Imponibile: da Stripe se c'è l'IVA in fattura, altrimenti scorporata
  // dall'aliquota impostata (prezzi IVA inclusa)
  const net =
    (invoice.tax ?? 0) > 0 && typeof invoice.total_excluding_tax === 'number'
      ? Math.round(invoice.total_excluding_tax * (gross / Math.max(invoice.total ?? gross, 1)))
      : Math.round(gross / (1 + (await vatRate()) / 100))
  const pct = Number(kind === 'first' ? agent.commission_first_pct : agent.commission_renewal_pct)
  const priceId = invoice.lines?.data?.[0]?.pricing?.price_details?.price ?? (invoice.lines?.data?.[0] as { price?: { id?: string } } | undefined)?.price?.id
  const plan = typeof priceId === 'string' && priceId === process.env.STRIPE_PRICE_ID_PRO ? 'pro' : 'base'

  const { error } = await client.from('agent_commissions').insert({
    agent_id: agent.user_id,
    customer_id: userId,
    kind,
    plan,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent: idOf(invoice.payment_intent),
    gross_cents: gross,
    net_cents: net,
    pct,
    commission_cents: Math.round((net * pct) / 100),
  })
  // Fattura già registrata (Stripe ripete gli eventi): nessun doppione
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function reverseAgentCommission(charge: Stripe.Charge): Promise<void> {
  const paymentIntent = idOf(charge.payment_intent as string | { id: string } | null)
  if (!paymentIntent || !charge.amount_refunded) return
  const client = db()
  const { data: rows } = await client
    .from('agent_commissions')
    .select('id, agent_id, customer_id, plan, status, commission_cents, gross_cents, stripe_invoice_id')
    .eq('stripe_payment_intent', paymentIntent)
    .neq('kind', 'adjustment')
  for (const row of rows ?? []) {
    const refundedShare = Math.min(1, charge.amount_refunded / Math.max(row.gross_cents, 1))
    if (row.status === 'pending') {
      if (refundedShare >= 1) {
        await client.from('agent_commissions').update({ status: 'cancelled', note: 'Rimborsato al cliente' }).eq('id', row.id)
      } else {
        const reduced = Math.round(row.commission_cents * (1 - refundedShare))
        await client.from('agent_commissions').update({ commission_cents: reduced, note: 'Rimborso parziale al cliente' }).eq('id', row.id)
      }
    } else if (row.status === 'paid') {
      // Già pagata all'agente: rettifica negativa, da scalare al prossimo pagamento
      const { data: existing } = await client
        .from('agent_commissions')
        .select('id')
        .eq('kind', 'adjustment')
        .eq('stripe_payment_intent', paymentIntent)
        .maybeSingle()
      if (!existing) {
        await client.from('agent_commissions').insert({
          agent_id: row.agent_id,
          customer_id: row.customer_id,
          kind: 'adjustment',
          plan: row.plan,
          stripe_payment_intent: paymentIntent,
          commission_cents: -Math.round(row.commission_cents * refundedShare),
          matures_at: new Date().toISOString(),
          note: `Rimborso al cliente (fattura ${row.stripe_invoice_id ?? ''})`.trim(),
        })
      }
    }
  }
}

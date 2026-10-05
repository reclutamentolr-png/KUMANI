import type Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { userIdOf } from '@/lib/agentCommissions'
import { isProInvoice } from '@/lib/networkPoints'
import { refreshDonationSummary } from '@/lib/donationsPublic'

// Donazioni KUMANI per i pagamenti con carta (webhook invoice.paid): una
// percentuale di quanto incassato a ogni primo pagamento, rinnovo e
// passaggio a Pro, all'associazione attiva. Un rimborso annulla la donazione
// (charge.refunded). Percentuale nelle impostazioni (Admin → Donazioni).

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export async function accrueSubscriptionDonation(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id || (invoice.amount_paid ?? 0) <= 0) return
  const pro = isProInvoice(invoice)
  const kind =
    invoice.billing_reason === 'subscription_create'
      ? pro ? 'activation_pro' : 'activation_base'
      : invoice.billing_reason === 'subscription_cycle'
        ? pro ? 'renewal_pro' : 'renewal_base'
        : invoice.billing_reason === 'subscription_update' && pro
          ? 'upgrade_pro'
          : null
  if (!kind) return
  const userId = await userIdOf(invoice)
  const { error } = await db().rpc('accrue_subscription_donation', {
    p_invoice_id: invoice.id,
    p_user: userId,
    p_kind: kind,
    p_amount_paid_cents: invoice.amount_paid ?? 0,
  })
  if (error) throw new Error(`Donazione non registrata: ${error.message}`)
  refreshDonationSummary()
}

export async function reverseSubscriptionDonation(charge: Stripe.Charge): Promise<void> {
  // Campo della versione API usata (2024-06-20), non più nei tipi
  const raw = (charge as Stripe.Charge & { invoice?: string | { id: string } | null }).invoice
  const invoiceId = typeof raw === 'string' ? raw : raw?.id
  if (!invoiceId || !charge.amount_refunded) return
  const { error } = await db().rpc('reverse_subscription_donation', { p_invoice_id: invoiceId })
  if (error) throw new Error(`Donazione non annullata: ${error.message}`)
  refreshDonationSummary()
}

import type Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { userIdOf } from '@/lib/agentCommissions'

// Punti Rete per le attivazioni pagate con carta (webhook invoice.paid):
// allo sponsor diretto del cliente, una volta per fattura, con i valori
// delle impostazioni (Base 49, Pro 122, passaggio a Pro 60). Rinnovi e
// voucher non danno punti; un rimborso li toglie (charge.refunded).

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Piano della riga principale (nel passaggio a Pro la prima è lo storno del Base)
export function isProInvoice(invoice: Stripe.Invoice): boolean {
  const main = invoice.lines?.data?.reduce<(typeof invoice.lines.data)[number] | undefined>(
    (best, line) => (!best || line.amount > best.amount ? line : best),
    undefined
  )
  const priceId = main?.pricing?.price_details?.price ?? (main as { price?: { id?: string } } | undefined)?.price?.id
  return typeof priceId === 'string' && priceId === process.env.STRIPE_PRICE_ID_PRO
}

export async function awardActivationPoints(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id || (invoice.amount_paid ?? 0) <= 0) return
  const pro = isProInvoice(invoice)
  const kind =
    invoice.billing_reason === 'subscription_create'
      ? pro
        ? 'activation_pro'
        : 'activation_base'
      : invoice.billing_reason === 'subscription_update' && pro
        ? 'upgrade_pro'
        : null
  if (!kind) return

  const customer = await userIdOf(invoice)
  if (!customer) return
  const { error } = await db().rpc('award_activation_points', { p_invoice_id: invoice.id, p_customer: customer, p_kind: kind })
  if (error) throw new Error(`Punti Rete non assegnati: ${error.message}`)
}

export async function reverseActivationPoints(charge: Stripe.Charge): Promise<void> {
  // Campo della versione API usata (2024-06-20), non più nei tipi
  const raw = (charge as Stripe.Charge & { invoice?: string | { id: string } | null }).invoice
  const invoiceId = typeof raw === 'string' ? raw : raw?.id
  if (!invoiceId || !charge.amount_refunded) return
  const { error } = await db().rpc('reverse_activation_points', { p_invoice_id: invoiceId })
  if (error) throw new Error(`Punti Rete non tolti: ${error.message}`)
}

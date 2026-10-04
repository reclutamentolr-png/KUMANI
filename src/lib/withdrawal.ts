import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { getStripe } from '@/lib/stripe'

// Diritto di recesso (Codice del Consumo, artt. 52 e segg.): 14 giorni da
// ogni pagamento dell'abbonamento. Chi al pagamento ha chiesto l'avvio
// immediato riceve, se recede, il rimborso della sola parte non ancora usata
// (art. 57); senza quel consenso il rimborso è totale.

export const WITHDRAWAL_DAYS = 14
const WINDOW_SECONDS = WITHDRAWAL_DAYS * 24 * 60 * 60

// Versione del testo del consenso: va cambiata quando cambia il testo in
// messages/*.json (withdrawal.consentLabel e consentHint), così resta chiaro cosa ha
// accettato ogni utente.
export const CONSENT_VERSION = '2026-10-04-v3'

// Campi della fattura nella versione API usata (2024-06-20), non più nei tipi
type InvoiceLike = Stripe.Invoice & { payment_intent?: string | { id: string } | null }

export type WithdrawableInvoice = {
  id: string
  amountCents: number
  paidAt: number
  periodStart: number
  periodEnd: number
  paymentIntent: string | null
}

// Abbonamento acquistato come azienda/professionista (P.IVA): niente recesso
export function isBusinessPurchase(subscription: Pick<Stripe.Subscription, 'metadata'>): boolean {
  return subscription.metadata?.buyer_type === 'business'
}

// Fatture dell'abbonamento pagate negli ultimi 14 giorni (quelle per cui si
// può ancora recedere), dalla più recente.
export async function withdrawableInvoices(subscriptionId: string, now = Math.floor(Date.now() / 1000)): Promise<WithdrawableInvoice[]> {
  const list = await getStripe().invoices.list({ subscription: subscriptionId, status: 'paid', limit: 10 })
  return list.data
    .map((raw) => {
      const invoice = raw as InvoiceLike
      const paidAt = invoice.status_transitions?.paid_at ?? invoice.created
      // Periodo pagato: quello della riga principale (nel passaggio a Pro la
      // prima riga è lo storno del Base)
      const main = invoice.lines.data.reduce<(typeof invoice.lines.data)[number] | undefined>(
        (best, line) => (!best || line.amount > best.amount ? line : best),
        undefined
      )
      const pi = invoice.payment_intent
      return {
        id: invoice.id ?? '',
        amountCents: invoice.amount_paid,
        paidAt,
        periodStart: main?.period?.start ?? paidAt,
        periodEnd: main?.period?.end ?? paidAt,
        paymentIntent: typeof pi === 'string' ? pi : (pi?.id ?? null),
      }
    })
    .filter((inv) => inv.id && inv.amountCents > 0 && inv.paymentIntent && now - inv.paidAt < WINDOW_SECONDS)
}

// Ultimo giorno utile per recedere (dal pagamento più recente)
export function withdrawalDeadline(invoices: WithdrawableInvoice[]): Date | null {
  if (invoices.length === 0) return null
  return new Date((Math.max(...invoices.map((inv) => inv.paidAt)) + WINDOW_SECONDS) * 1000)
}

// Rimborso della parte non usata: dal momento della richiesta di recesso
// alla fine del periodo pagato con quella fattura.
export function proportionalRefund(inv: Pick<WithdrawableInvoice, 'amountCents' | 'periodStart' | 'periodEnd'>, atSeconds: number): number {
  const length = inv.periodEnd - inv.periodStart
  if (length <= 0) return inv.amountCents
  const unused = Math.min(Math.max((inv.periodEnd - atSeconds) / length, 0), 1)
  return Math.round(inv.amountCents * unused)
}

// Registra il consenso all'avvio immediato (privato) o la dichiarazione di
// acquisto per l'attività (azienda/professionista, con P.IVA) con il testo
// esatto mostrato all'utente nella sua lingua (prova in caso di contestazione).
export async function recordConsent(
  service: SupabaseClient,
  input: {
    userId: string
    kind: 'checkout' | 'upgrade' | 'pass'
    plan: 'base' | 'pro' | null
    tool?: string | null
    stripeRef: string | null
    locale: string
    business?: { name: string; vat: string } | null
    // Testo del rinnovo automatico mostrato accanto al pulsante (abbonamenti)
    renewalNote?: string | null
    // Termini e Privacy accettati nel modulo di pagamento
    termsAccepted?: boolean
  }
): Promise<void> {
  const t = await getTranslations({ locale: input.locale, namespace: 'withdrawal' })
  const main = input.business ? t('businessDeclaration') : `${t('consentLabel')} ${t('consentHint')}`
  const terms = input.termsAccepted ? String(t.raw('termsAccept')).replace(/<\/?[a-z]+>/g, '') : ''
  const { error } = await service.from('subscription_consents').insert({
    user_id: input.userId,
    kind: input.kind,
    plan: input.plan,
    tool: input.tool ?? null,
    terms_accepted: !!input.termsAccepted,
    stripe_ref: input.stripeRef,
    locale: input.locale,
    text_version: CONSENT_VERSION,
    consent_text: [main, terms, input.renewalNote ?? ''].filter(Boolean).join(' | '),
    buyer_type: input.business ? 'business' : 'consumer',
    business_name: input.business?.name ?? null,
    vat_number: input.business?.vat ?? null,
  })
  if (error) console.error('❌ Consenso avvio immediato non salvato:', error.message)
}

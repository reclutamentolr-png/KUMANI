import Stripe from 'stripe'

// Client Stripe creato solo alla prima richiesta, non al caricamento del
// modulo: durante `next build` Next importa le route per raccoglierne la
// configurazione, e se STRIPE_SECRET_KEY non è disponibile in quella fase
// (es. su Vercel) un `new Stripe(...)` a livello di modulo fa fallire
// l'intero deploy con "Neither apiKey nor config.authenticator provided".
let client: Stripe | null = null

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiVersion: '2024-06-20' as any, // versione API fissata come prima del refactor
    })
  }
  return client
}

// Stripe Managed Payments (Stripe venditore ufficiale: IVA e ricevute in
// tutti i paesi). Si accende solo con STRIPE_MANAGED_PAYMENTS=on in Vercel,
// prima in test e poi in produzione; spento, i pagamenti restano come prima.
// Richiede una versione API recente solo per queste richieste (il resto
// dell'integrazione e i webhook restano sulla versione fissata sopra).
export const MANAGED_PAYMENTS_ON = process.env.STRIPE_MANAGED_PAYMENTS === 'on'
const MANAGED_API_VERSION = '2025-03-31.basil'

export function managedPayments(): {
  // Da aggiungere ai parametri della Checkout Session
  params: Record<string, unknown>
  // Opzioni della richiesta (versione API)
  options: Stripe.RequestOptions | undefined
  // Codice fiscale del prodotto per i prezzi creati al momento (Pass, regali)
  productTaxCode: string | undefined
} {
  if (!MANAGED_PAYMENTS_ON) return { params: {}, options: undefined, productTaxCode: undefined }
  return {
    params: { managed_payments: { enabled: true } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: { apiVersion: MANAGED_API_VERSION as any },
    productTaxCode: process.env.STRIPE_PRODUCT_TAX_CODE || undefined,
  }
}

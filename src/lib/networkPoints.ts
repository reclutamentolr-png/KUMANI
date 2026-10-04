import type Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { userIdOf } from '@/lib/agentCommissions'
import { localizedPath, notifyUser } from '@/lib/push'
import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { locales } from '../../i18n'

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
  // Punti in proporzione a quanto è stato pagato davvero: con il credito dei
  // Pass (o un altro sconto) il cliente paga meno del prezzo pieno
  const full = invoice.subtotal ?? 0
  const scale = full > 0 ? Math.min(Math.max(invoice.amount_paid / full, 0), 1) : 1
  const { data, error } = await db().rpc('award_activation_points', { p_invoice_id: invoice.id, p_customer: customer, p_kind: kind, p_scale: scale })
  if (error) throw new Error(`Punti Rete non assegnati: ${error.message}`)

  // Notifica push a chi ha invitato (solo quando i punti sono stati assegnati ora)
  const row = (Array.isArray(data) ? data[0] : data) as {
    awarded?: boolean
    sponsor_id?: string | null
    points?: number
    welcome_user?: string | null
    welcome_points?: number
  } | null
  // Bonus Accoglienza a chi ha accolto la persona nella propria stella
  if (row?.awarded && row.welcome_user && (row.welcome_points ?? 0) > 0) {
    const { data: person } = await db().from('profiles').select('first_name').eq('id', customer).maybeSingle()
    const name = person?.first_name || 'Kumano'
    const points = row.welcome_points ?? 0
    await notifyUser(row.welcome_user, 'network', (t, locale) => ({
      title: t('welcomeTitle'),
      body: t('welcomeBody', { name, points }),
      url: localizedPath(locale, '/dashboard/rete'),
      tag: `welcome-${invoice.id}`,
    }))
  }
  if (row?.awarded && row.sponsor_id) {
    const { data: person } = await db().from('profiles').select('first_name').eq('id', customer).maybeSingle()
    const name = person?.first_name || 'Kumano'
    const points = row.points ?? 0
    await notifyUser(row.sponsor_id, 'network', (t, locale) => ({
      title: t(kind === 'upgrade_pro' ? 'upgradeTitle' : 'activationTitle'),
      body: t(kind === 'upgrade_pro' ? 'upgradeBody' : 'activationBody', { name, points }),
      url: localizedPath(locale, '/dashboard/rete'),
      tag: `activation-${invoice.id}`,
    }))
  }
}

export async function reverseActivationPoints(charge: Stripe.Charge): Promise<void> {
  // Campo della versione API usata (2024-06-20), non più nei tipi
  const raw = (charge as Stripe.Charge & { invoice?: string | { id: string } | null }).invoice
  const invoiceId = typeof raw === 'string' ? raw : raw?.id
  if (!charge.amount_refunded) return
  // Pass di un servizio: punti registrati con il riferimento del pagamento
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (pi) {
    const { error: passError } = await db().rpc('reverse_activation_points', { p_invoice_id: `pass:${pi}` })
    if (passError) throw new Error(`KU Points del pass non tolti: ${passError.message}`)
  }
  if (!invoiceId) return
  const { error } = await db().rpc('reverse_activation_points', { p_invoice_id: invoiceId })
  if (error) throw new Error(`Punti Rete non tolti: ${error.message}`)
  // Bonus Accoglienza nato dalla stessa attivazione
  const { error: welcomeError } = await db().rpc('reverse_activation_points', { p_invoice_id: `welcome:${invoiceId}` })
  if (welcomeError) throw new Error(`Bonus Accoglienza non tolto: ${welcomeError.message}`)
}

// KU Points per il Pass di un singolo servizio (punti decisi dall'Admin per
// quel servizio): allo sponsor diretto, solo al primo Pass di quel servizio.
export async function awardPassPoints(session: Stripe.Checkout.Session): Promise<void> {
  const meta = session.metadata ?? {}
  const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!meta.userId || !meta.tool || !pi || (session.amount_total ?? 0) <= 0) return
  const { data, error } = await db().rpc('award_pass_points', { p_ref: `pass:${pi}`, p_customer: meta.userId, p_tool: meta.tool })
  if (error) throw new Error(`KU Points del pass non assegnati: ${error.message}`)

  const row = (Array.isArray(data) ? data[0] : data) as { awarded?: boolean; sponsor_id?: string | null; points?: number } | null
  if (row?.awarded && row.sponsor_id) {
    const { data: person } = await db().from('profiles').select('first_name').eq('id', meta.userId).maybeSingle()
    const name = person?.first_name || 'Kumano'
    const points = row.points ?? 0
    // Nome del servizio in ogni lingua (la notifica parte nella lingua del dispositivo)
    const names = new Map<string, string>()
    for (const locale of locales) {
      const tm = await getTranslations({ locale, namespace: 'marketplace' })
      names.set(locale, getMarketplaceTools((key) => tm(key)).find((tool) => tool.toolName === meta.tool)?.title ?? meta.tool)
    }
    await notifyUser(row.sponsor_id, 'network', (t, locale) => ({
      title: t('passTitle'),
      body: t('passBody', { name, service: names.get(locale) ?? meta.tool, points }),
      url: localizedPath(locale, '/dashboard/rete'),
      tag: `pass-${pi}`,
    }))
  }
}

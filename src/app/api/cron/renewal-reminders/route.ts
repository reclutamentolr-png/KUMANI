import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { escapeHtml, sendEmail } from '@/lib/email'
import { findStripeSubscriptionForUser } from '@/lib/stripeCustomer'
import { getPlanPrices } from '@/lib/planPrices'
import { SITE_URL } from '@/lib/siteUrl'
import { localizedPath, notifyUser } from '@/lib/push'
import { locales, defaultLocale } from '../../../../../i18n'

// Ogni mattina (Vercel Cron, vedi vercel.json): qualifiche raggiunte con i
// KU Points appena confermati (in fondo) e promemoria del rinnovo automatico: a chi
// paga con carta, tra 30 e 15 giorni prima del rinnovo annuale, un'email con
// data, importo e link per disattivare il rinnovo con un clic. Una sola
// email per periodo (renewal_reminders). Chi ha già disdetto non la riceve.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAY = 86_400_000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now = Date.now()
  const { data: due } = await db
    .from('profiles')
    .select('id, email, subscription_plan, subscription_expires_at')
    .eq('subscription_status', 'active')
    .eq('subscription_source', 'stripe')
    .gt('subscription_expires_at', new Date(now + 15 * DAY).toISOString())
    .lte('subscription_expires_at', new Date(now + 30 * DAY).toISOString())
    .limit(500)

  const prices = await getPlanPrices()
  let sent = 0
  for (const p of due ?? []) {
    try {
      const found = await findStripeSubscriptionForUser(p.id as string, p.email as string | null)
      const sub = found?.subscription
      if (!sub || sub.status !== 'active' || sub.cancel_at_period_end || sub.cancel_at) continue
      const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
      if (!periodEnd) continue
      const renewsAt = new Date(periodEnd * 1000)
      if (renewsAt.getTime() - now < 15 * DAY || renewsAt.getTime() - now > 31 * DAY) continue

      // Una volta sola per questo rinnovo
      const { error: markError } = await db.from('renewal_reminders').insert({ subscription_id: sub.id, period_end: renewsAt.toISOString(), user_id: p.id })
      if (markError) continue

      const locale = sub.metadata?.locale && locales.includes(sub.metadata.locale) ? sub.metadata.locale : defaultLocale
      const t = await getTranslations({ locale, namespace: 'renewalEmail' })
      const plan = p.subscription_plan === 'pro' ? 'KUMANI Pro' : 'KUMANI Base'
      const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(renewsAt)
      const amount = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(p.subscription_plan === 'pro' ? prices.pro : prices.base)
      const billingUrl = `${SITE_URL}/billing`
      const lines = [t('greeting'), t('intro', { plan, date, amount }), t('keep'), t('stop')]
      const text = [...lines, billingUrl, '', t('signature')].join('\n\n')
      const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#111;color:#e8c872;font-weight:bold;font-size:20px;padding:16px 20px;border-radius:12px 12px 0 0">KUMANI</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;line-height:1.5;font-size:15px">
${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')}
<p><a href="${escapeHtml(billingUrl)}" style="display:inline-block;background:#111;color:#e8c872;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t('cta'))}</a></p>
<p>${escapeHtml(t('signature'))}</p>
</div></div></body></html>`
      const result = await sendEmail({ to: p.email as string, subject: t('subject', { date }), html, text, idempotencyKey: `renewal-${sub.id}-${periodEnd}` })
      if (result.sent) sent++
      else await db.from('renewal_reminders').delete().eq('subscription_id', sub.id).eq('period_end', renewsAt.toISOString())
    } catch (err) {
      console.error('⚠️ Promemoria rinnovo:', err instanceof Error ? err.message : err)
    }
  }
  const qualifications = await evaluateQualifications(db)
  return NextResponse.json({ checked: due?.length ?? 0, sent, qualifications })
}

// Qualifiche: chi ha KU Points appena confermati (passati i giorni del
// recesso) viene ricontrollato; a chi raggiunge una qualifica arriva una
// notifica (il festeggiamento lo vede alla prossima apertura della dashboard)
const RANK_NAMES: Record<string, string> = { rising_star: 'Kuman Green', shining_star: 'Kuman Star', diamond_star: 'Kuman Black' }

async function evaluateQualifications(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc('evaluate_due_qualifications')
  if (error) {
    console.error('⚠️ Qualifiche:', error.message)
    return 0
  }
  const prizes = (data ?? []) as { user_id: string; prize_key: string; rank_key: string; vouchers: number }[]
  for (const prize of prizes) {
    const rank = RANK_NAMES[prize.rank_key] ?? 'Kuman'
    const continuing = prize.prize_key.startsWith('black_plus_')
    await notifyUser(
      prize.user_id,
      'network',
      (t, locale) => ({
        title: continuing ? t('qualificationBlackPlusTitle') : t('qualificationTitle', { rank }),
        body: t('qualificationBody', { count: prize.vouchers }),
        url: localizedPath(locale, continuing ? '/wallet#voucher' : '/dashboard'),
        tag: `qualification-${prize.prize_key}`,
      }),
      { kind: 'qualification', ref: `${prize.user_id}:${prize.prize_key}` }
    )
  }
  return prizes.length
}

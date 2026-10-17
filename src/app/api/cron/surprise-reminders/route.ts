import { NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@supabase/supabase-js'
import { locales, defaultLocale } from '../../../../../i18n'
import { escapeHtml, sendEmail } from '@/lib/email'
import { localizedPath, notifyUser } from '@/lib/push'
import { SITE_URL } from '@/lib/siteUrl'
import { surprisePath, surpriseWhatsAppUrl } from '@/lib/surprise'

// Promemoria per l'invio delle sorprese: lo chiama il database ogni 5 minuti
// (pg_cron + pg_net, migrazione 20270327100000) solo quando c'è un promemoria
// scaduto. A chi regala: notifica (apre la sorpresa con «Invia ora su
// WhatsApp») ed email con lo stesso pulsante. Ogni promemoria parte una volta.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Due = { id: string; user_id: string; recipient_name: string; public_token: string; locale: string; remind_phone: string | null }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await db
    .from('surprise_gifts')
    .select('id, user_id, recipient_name, public_token, locale, remind_phone')
    .eq('status', 'active')
    .is('refunded_at', null)
    .is('remind_sent_at', null)
    .not('public_token', 'is', null)
    .lte('remind_at', new Date().toISOString())
    .limit(50)
  if (error) {
    console.error('[surprise-reminders] lettura non riuscita:', error.message)
    return NextResponse.json({ error: 'read_failed' }, { status: 500 })
  }

  let sent = 0
  for (const gift of (data ?? []) as Due[]) {
    // Prima si segna come inviato: se la chiamata si ripete non parte due volte
    const { data: marked } = await db.from('surprise_gifts').update({ remind_sent_at: new Date().toISOString() }).eq('id', gift.id).is('remind_sent_at', null).select('id')
    if (!marked?.length) continue
    const name = gift.recipient_name || '—'
    await notifyUser(
      gift.user_id,
      'messages',
      (t, locale) => ({
        title: t('surpriseRemindTitle', { name }),
        body: t('surpriseRemindBody'),
        url: localizedPath(locale, `/sorprese/${gift.id}?invia=1`),
        tag: `surprise-remind-${gift.id}`,
      }),
      { kind: 'surprise_remind', ref: gift.id }
    )

    // Email: nella lingua della sorpresa, con WhatsApp già pronto
    const { data: profile } = await db.from('profiles').select('email').eq('id', gift.user_id).maybeSingle()
    if (profile?.email) {
      const locale = locales.includes(gift.locale) ? gift.locale : defaultLocale
      const t = await getTranslations({ locale, namespace: 'surprise' })
      const prefix = locale === defaultLocale ? '' : `/${locale}`
      const url = `${SITE_URL}${prefix}${surprisePath(gift.public_token)}`
      const whatsapp = surpriseWhatsAppUrl(t('shareMessage', { name: gift.recipient_name || '', url }), gift.remind_phone)
      const lines = [t('reminderEmailIntro', { name }), t('reminderEmailHow')]
      const text = [...lines, whatsapp, '', `${t('reminderEmailLink')} ${url}`].join('\n\n')
      const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#111;color:#e8c872;font-weight:bold;font-size:20px;padding:16px 20px;border-radius:12px 12px 0 0">KUMANI · 🎁</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;line-height:1.5;font-size:15px">
${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')}
<p><a href="${escapeHtml(whatsapp)}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t('reminderNowCta'))}</a></p>
<p style="font-size:13px;color:#666">${escapeHtml(t('reminderEmailLink'))} <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
</div></div></body></html>`
      await sendEmail({ to: profile.email as string, subject: t('reminderEmailSubject', { name }), html, text, idempotencyKey: `surprise-remind-${gift.id}` })
    }
    sent++
  }
  return NextResponse.json({ ok: true, sent })
}

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { escapeHtml, sendEmail } from '@/lib/email'
import { localizedPath, notifyUser } from '@/lib/push'
import { SITE_URL } from '@/lib/siteUrl'
import { getPlansGate } from '@/lib/plansGate'

// Avviso «i piani sono aperti» a chi aveva chiesto «Avvisami» (plan_waitlist):
// notifica nell'app (e sul telefono, se attive) ed email nella sua lingua, una
// volta sola (notified_at). Parte solo se i piani sono aperti: dal cron della
// mattina dopo la data di apertura, o da Admin → Apertura piani.
export async function notifyPlanWaitlist(limit = 300): Promise<{ notified: number; emails: number }> {
  if ((await getPlansGate()).closed) return { notified: 0, emails: 0 }
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: rows } = await db.from('plan_waitlist').select('user_id, plan, locale').is('notified_at', null).order('created_at').limit(limit)
  if (!rows?.length) return { notified: 0, emails: 0 }
  const ids = rows.map((r) => r.user_id as string)
  const { data: profiles } = await db.from('profiles').select('id, email, first_name, subscription_status').in('id', ids)
  let notified = 0
  let emails = 0
  for (const row of rows) {
    const p = profiles?.find((x) => x.id === row.user_id)
    // Chi nel frattempo si è già abbonato (o non c'è più) non riceve nulla
    if (p && p.subscription_status !== 'active') {
      // /billing è fuori dalle lingue, /pro no
      const url = row.plan === 'pro' ? localizedPath(row.locale, '/pro') : '/billing'
      await notifyUser(row.user_id, 'staff', (t) => ({ title: t('plansOpenTitle'), body: t('plansOpenBody'), url, tag: 'plans-open' }), { kind: 'plans_open', ref: 'launch' })
      if (p.email) {
        const t = await getTranslations({ locale: row.locale, namespace: 'plansSoon' })
        const link = `${SITE_URL}${url}`
        const lines = [t('emailHello', { name: p.first_name || 'Kumano' }), t('emailText'), t('emailWhy')]
        const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#111;color:#e8c872;font-weight:bold;font-size:20px;padding:16px 20px;border-radius:12px 12px 0 0">KUMANI</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;line-height:1.5;font-size:15px">
${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')}
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#e8c872;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t('emailCta'))}</a></p>
<p>${escapeHtml(t('emailSignature'))}</p>
</div></div></body></html>`
        const text = [...lines, link, '', t('emailSignature')].join('\n\n')
        const result = await sendEmail({ to: p.email, subject: t('emailSubject'), html, text, idempotencyKey: `plans-open-${row.user_id}` })
        if (result.sent) emails++
      }
      notified++
    }
    await db.from('plan_waitlist').update({ notified_at: new Date().toISOString() }).eq('user_id', row.user_id)
  }
  return { notified, emails }
}

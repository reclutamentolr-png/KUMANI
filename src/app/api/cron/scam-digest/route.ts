import { NextResponse } from 'next/server'
import { localizedPath, notifyUser, pushDb } from '@/lib/push'

// «Le truffe della settimana» (Vercel Cron, lunedì mattina): solo a chi l'ha
// accesa (push_preferences.alerts), con le categorie più segnalate e
// confermate negli ultimi 7 giorni. Se non c'è niente di nuovo non parte.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAY = 86_400_000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const db = pushDb()
  const since = new Date(Date.now() - 7 * DAY).toISOString()
  const { data: reports } = await db.from('scam_reports').select('category, scam_targets!inner(status)').gte('created_at', since).eq('scam_targets.status', 'confirmed').limit(10000)
  const counts = new Map<string, number>()
  for (const r of reports ?? []) counts.set(r.category as string, (counts.get(r.category as string) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  if (!total) return NextResponse.json({ sent: 0, reason: 'nothing new' })

  const { data: users } = await db.from('push_preferences').select('user_id').eq('alerts', true).limit(50000)
  const week = new Date().toISOString().slice(0, 10)
  let sent = 0
  for (const u of users ?? []) {
    await notifyUser(
      u.user_id as string,
      'alerts',
      (t, locale) => ({
        title: t('scamDigestTitle'),
        body: t('scamDigestBody', { count: total, top: top.map(([c]) => t(`scamCategory_${c}`)).join(', ') }),
        url: localizedPath(locale, '/app/rete-antitruffa'),
        tag: 'scam-digest',
      }),
      { kind: 'scam_digest', ref: week }
    )
    sent++
  }
  return NextResponse.json({ sent, total })
}

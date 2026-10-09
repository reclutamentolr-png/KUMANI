import { notifyUser } from '@/lib/push'
import { recordSecurityEvent, securityDb, type SecurityEventInput } from '@/lib/securityCore'

export { clientIp } from '@/lib/securityCore'

// Registro di sicurezza con le notifiche: per gli avvisi nuovi medi o gravi
// parte subito una push agli admin. Le scansioni dei bot e le pagine
// inesistenti (continue su qualsiasi sito) restano solo in Admin e nel
// riepilogo giornaliero.
const QUIET_KINDS = new Set(['probe', 'not_found'])

export async function logSecurityEvent(event: SecurityEventInput): Promise<void> {
  const alerts = await recordSecurityEvent(event)
  const important = alerts.filter((a) => (a.severity === 'medium' || a.severity === 'high') && !QUIET_KINDS.has(event.kind))
  if (!important.length) return
  try {
    await notifyAdminsOfAlerts(important)
  } catch (error) {
    console.error('[security] notifica non inviata:', error)
  }
}

// Admin completi (profiles.is_admin): ricevono le notifiche di sicurezza
async function fullAdminIds(): Promise<string[]> {
  const { data } = await securityDb().from('profiles').select('id').eq('is_admin', true)
  return (data ?? []).map((r) => r.id as string)
}

export async function notifyAdminsOfAlerts(alerts: { alert_id: string; title: string }[]): Promise<void> {
  const admins = await fullAdminIds()
  for (const alert of alerts) {
    for (const adminId of admins) {
      await notifyUser(
        adminId,
        'staff',
        (t) => ({ title: t('securityAlertTitle'), body: alert.title, url: '/admin?section=security', tag: `security-${alert.alert_id}` }),
        { kind: 'security_alert', ref: alert.alert_id }
      )
    }
  }
  if (alerts.length) {
    await securityDb()
      .from('security_alerts')
      .update({ notified_at: new Date().toISOString() })
      .in('id', alerts.map((a) => a.alert_id))
  }
}

// Riepilogo degli avvisi non ancora notificati (cron giornaliero)
export async function notifyAdminsDigest(): Promise<number> {
  const db = securityDb()
  const { data } = await db.from('security_alerts').select('id').eq('status', 'open').is('notified_at', null)
  const ids = (data ?? []).map((r) => r.id as string)
  if (!ids.length) return 0
  const day = new Date().toISOString().slice(0, 10)
  for (const adminId of await fullAdminIds()) {
    await notifyUser(
      adminId,
      'staff',
      (t) => ({ title: t('securityAlertTitle'), body: t('securityDigestBody', { count: ids.length }), url: '/admin?section=security', tag: 'security-digest' }),
      { kind: 'security_digest', ref: day }
    )
  }
  await db.from('security_alerts').update({ notified_at: new Date().toISOString() }).in('id', ids)
  return ids.length
}


'use server'

import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import {
  PUSH_CATEGORIES,
  localizedPath,
  notifyUser,
  pushConfigured,
  pushDb,
  pushLocale,
  sendToSubscriptions,
  usersWithCategoryOff,
  type PushCategory,
} from '@/lib/push'

// Notifiche push: il Kumano le attiva sul suo dispositivo e sceglie quali
// ricevere; lo Staff invia avvisi da Admin → Comunicazioni → Notifiche push.

async function currentUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// Solo i servizi di notifica dei browser (il server invierà richieste lì)
function isPushServiceEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:') return false
    const host = url.hostname
    return (
      host === 'fcm.googleapis.com' ||
      host === 'updates.push.services.mozilla.com' ||
      host === 'web.push.apple.com' ||
      host.endsWith('.push.apple.com') ||
      host.endsWith('.notify.windows.com')
    )
  } catch {
    return false
  }
}

type BrowserSubscription = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }

export async function savePushSubscription(sub: BrowserSubscription, locale: string, userAgent: string) {
  const userId = await currentUserId()
  if (!userId) return { success: false }
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : ''
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : ''
  if (!isPushServiceEndpoint(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return { success: false }
  }
  const { error } = await pushDb()
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, endpoint, p256dh, auth, locale: pushLocale(locale), user_agent: String(userAgent ?? '').slice(0, 300) },
      { onConflict: 'endpoint' }
    )
  if (error) console.error('[push] dispositivo non salvato:', error.message)
  return { success: !error }
}

export async function removePushSubscription(endpoint: string) {
  const userId = await currentUserId()
  if (!userId || typeof endpoint !== 'string') return { success: false }
  await pushDb().from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint)
  return { success: true }
}

export type PushPreferences = Record<PushCategory, boolean>

export async function getPushPreferences(): Promise<PushPreferences | null> {
  const userId = await currentUserId()
  if (!userId) return null
  const { data } = await pushDb().from('push_preferences').select('network, expiry, events, staff, messages').eq('user_id', userId).maybeSingle()
  return { network: data?.network ?? true, expiry: data?.expiry ?? true, events: data?.events ?? true, staff: data?.staff ?? true, messages: data?.messages ?? true }
}

export async function setPushPreference(category: PushCategory, enabled: boolean) {
  const userId = await currentUserId()
  if (!userId || !PUSH_CATEGORIES.includes(category)) return { success: false }
  const { error } = await pushDb()
    .from('push_preferences')
    .upsert({ user_id: userId, [category]: Boolean(enabled), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return { success: !error }
}

// Notifica di prova ai propri dispositivi
export async function sendTestPush() {
  const userId = await currentUserId()
  if (!userId) return { success: false }
  if (!pushConfigured()) return { success: false }
  await notifyUser(userId, 'staff', (t, locale) => ({ title: t('testTitle'), body: t('testBody'), url: localizedPath(locale, '/dashboard'), tag: 'test' }))
  return { success: true }
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export type PushAudience = 'all' | 'active' | 'inactive' | 'user'

export type PushCampaignRow = {
  id: string
  title: string
  body: string
  url: string | null
  audience: PushAudience
  locale: string | null
  recipients: number
  sent: number
  failed: number
  created_at: string
  target_name: string | null
}

const fullName = (p: { first_name?: string | null; last_name?: string | null; referral_code?: string | null } | undefined) =>
  p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() + (p.referral_code ? ` (${p.referral_code})` : '') : null

export async function adminPushOverview() {
  if (!(await verifyAdmin('messages.read'))) return null
  const db = pushDb()
  const [{ data: subs }, { data: campaigns }] = await Promise.all([
    db.from('push_subscriptions').select('user_id, locale'),
    db
      .from('push_campaigns')
      .select('id, title, body, url, audience, locale, recipients, sent, failed, created_at, target_user_id')
      .order('created_at', { ascending: false })
      .limit(30),
  ])
  const byLocale: Record<string, number> = {}
  for (const s of subs ?? []) byLocale[s.locale] = (byLocale[s.locale] ?? 0) + 1
  const targets = [...new Set((campaigns ?? []).map((c) => c.target_user_id).filter(Boolean))] as string[]
  const { data: people } = targets.length
    ? await db.from('profiles').select('id, first_name, last_name, referral_code').in('id', targets)
    : { data: [] }
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]))
  return {
    configured: pushConfigured(),
    devices: subs?.length ?? 0,
    people: new Set((subs ?? []).map((s) => s.user_id)).size,
    byLocale,
    campaigns: (campaigns ?? []).map(({ target_user_id, ...c }) => ({
      ...c,
      target_name: target_user_id ? fullName(byId.get(target_user_id)) : null,
    })) as PushCampaignRow[],
  }
}

// Quanti dispositivi ha una persona e se riceve gli avvisi dello Staff
export async function adminPushUserStatus(userId: string) {
  if (!(await verifyAdmin('messages.read'))) return null
  const db = pushDb()
  const [{ count }, off] = await Promise.all([
    db.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    usersWithCategoryOff('staff', [userId]),
  ])
  return { devices: count ?? 0, staffOff: off.size > 0 }
}

const isActive = (p: { subscription_status: string | null; subscription_expires_at: string | null }) =>
  p.subscription_status === 'active' && (!p.subscription_expires_at || new Date(p.subscription_expires_at).getTime() > Date.now())

export async function adminSendPushCampaign(input: { title: string; body: string; url: string; audience: PushAudience; locale: string; userId?: string }) {
  const admin = await verifyAdmin('messages.write')
  if (!admin) return { success: false, error: 'Non autorizzato.' }
  if (!pushConfigured()) return { success: false, error: 'Notifiche non configurate: mancano le chiavi VAPID.' }
  const title = String(input.title ?? '').trim().slice(0, 80)
  const body = String(input.body ?? '').trim().slice(0, 240)
  if (!title || !body) return { success: false, error: 'Scrivi titolo e testo.' }
  const audience: PushAudience = ['all', 'active', 'inactive', 'user'].includes(input.audience) ? input.audience : 'all'
  const targetUserId = audience === 'user' ? String(input.userId ?? '') : null
  if (audience === 'user' && !/^[0-9a-f-]{36}$/i.test(targetUserId ?? '')) return { success: false, error: 'Scegli la persona.' }
  const locale = audience !== 'user' && input.locale && input.locale !== 'all' ? pushLocale(input.locale) : null
  // Solo pagine di KUMANI: percorso che inizia con "/"
  let url = String(input.url ?? '').trim()
  if (url && (!url.startsWith('/') || url.startsWith('//'))) return { success: false, error: 'Il link deve essere una pagina di KUMANI, es. /dashboard' }
  if (!url) url = '/dashboard'

  const db = pushDb()
  let query = db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, locale')
  if (locale) query = query.eq('locale', locale)
  if (targetUserId) query = query.eq('user_id', targetUserId)
  const { data: subs } = await query
  let rows = subs ?? []
  if (targetUserId && !rows.length) return { success: false, error: 'Questa persona non ha attivato le notifiche su nessun dispositivo.' }
  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const off = await usersWithCategoryOff('staff', userIds)
  rows = rows.filter((r) => !off.has(r.user_id))
  if (targetUserId && !rows.length) return { success: false, error: 'Questa persona ha disattivato gli avvisi di KUMANI.' }
  if ((audience === 'active' || audience === 'inactive') && rows.length) {
    const { data: profiles } = await db.from('profiles').select('id, subscription_status, subscription_expires_at').in('id', [...new Set(rows.map((r) => r.user_id))])
    const active = new Set((profiles ?? []).filter(isActive).map((p) => p.id as string))
    rows = rows.filter((r) => (audience === 'active' ? active.has(r.user_id) : !active.has(r.user_id)))
  }
  const recipients = new Set(rows.map((r) => r.user_id)).size
  const { sent, failed } = await sendToSubscriptions(rows, (row) => ({
    title,
    body,
    url: localizedPath(pushLocale(row.locale), url),
  }))
  await db
    .from('push_campaigns')
    .insert({ title, body, url, audience, locale, recipients, sent, failed, created_by: admin.id, target_user_id: targetUserId })
  return { success: true, recipients, sent, failed }
}

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { locales, defaultLocale } from '../../i18n'

// Invio delle notifiche push (Web Push con chiavi VAPID).
// Variabili d'ambiente: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
// Se mancano, le notifiche non partono (log) e il resto funziona.

export type PushCategory = 'network' | 'expiry' | 'events' | 'staff'
export const PUSH_CATEGORIES: PushCategory[] = ['network', 'expiry', 'events', 'staff']

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

type SubscriptionRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; locale: string }

export const pushDb = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

let configured: boolean | null = null
export function pushConfigured() {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  configured = Boolean(publicKey && privateKey)
  if (configured) webpush.setVapidDetails('mailto:support@kumani.io', publicKey!, privateKey!)
  else console.warn('🔕 Notifiche push non configurate (chiavi VAPID mancanti)')
  return configured
}

export const pushLocale = (value: string | null | undefined) => (value && locales.includes(value) ? value : defaultLocale)

// Percorso con la lingua (l'italiano è senza prefisso)
export const localizedPath = (locale: string, path: string) => (locale === defaultLocale ? path : `/${locale}${path}`)

// Invia a un elenco di dispositivi; quelli che non esistono più vengono tolti
export async function sendToSubscriptions(rows: SubscriptionRow[], payloadFor: (row: SubscriptionRow) => PushPayload) {
  if (!pushConfigured() || rows.length === 0) return { sent: 0, failed: 0 }
  const db = pushDb()
  let sent = 0
  let failed = 0
  const gone: string[] = []
  const ok: string[] = []
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const results = await Promise.allSettled(
      batch.map((row) =>
        webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payloadFor(row)),
          { TTL: 60 * 60 * 24, timeout: 10_000 }
        )
      )
    )
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent++
        ok.push(batch[index].id)
        return
      }
      failed++
      const status = (result.reason as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) gone.push(batch[index].id)
      else console.error('[push] invio non riuscito:', status, (result.reason as Error)?.message)
    })
  }
  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone)
  if (ok.length) await db.from('push_subscriptions').update({ last_success_at: new Date().toISOString() }).in('id', ok)
  return { sent, failed }
}

// Utenti che hanno disattivato una categoria
export async function usersWithCategoryOff(category: PushCategory, userIds: string[]) {
  if (!userIds.length) return new Set<string>()
  const { data } = await pushDb().from('push_preferences').select('user_id').eq(category, false).in('user_id', userIds)
  return new Set((data ?? []).map((row) => row.user_id as string))
}

type Translator = Awaited<ReturnType<typeof getTranslations<'pushNotifications'>>>

/**
 * Notifica a una persona, nella lingua di ogni suo dispositivo.
 * once: { kind, ref } per non mandarla due volte (registro push_log).
 */
export async function notifyUser(
  userId: string,
  category: PushCategory,
  build: (t: Translator, locale: string) => PushPayload,
  once?: { kind: string; ref: string }
) {
  try {
    if (!pushConfigured()) return
    const db = pushDb()
    const { data: subs } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, locale').eq('user_id', userId)
    if (!subs?.length) return
    if ((await usersWithCategoryOff(category, [userId])).size) return
    if (once) {
      const { data: logged } = await db
        .from('push_log')
        .upsert({ user_id: userId, kind: once.kind, ref: once.ref }, { onConflict: 'user_id,kind,ref', ignoreDuplicates: true })
        .select('user_id')
      if (!logged?.length) return
    }
    const payloads = new Map<string, PushPayload>()
    for (const locale of new Set(subs.map((s) => pushLocale(s.locale)))) {
      const t = await getTranslations({ locale, namespace: 'pushNotifications' })
      payloads.set(locale, build(t, locale))
    }
    await sendToSubscriptions(subs as SubscriptionRow[], (row) => payloads.get(pushLocale(row.locale))!)
  } catch (error) {
    console.error('[push] notifica non inviata:', error)
  }
}

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { locales, defaultLocale } from '../../i18n'

// Invio delle notifiche push (Web Push con chiavi VAPID).
// Variabili d'ambiente: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
// Se mancano, le notifiche non partono (log) e il resto funziona.

export type PushCategory = 'network' | 'expiry' | 'events' | 'staff' | 'messages' | 'alerts'
export const PUSH_CATEGORIES: PushCategory[] = ['network', 'expiry', 'events', 'staff', 'messages', 'alerts']

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
  // A gruppi di 100: con tanti dispositivi l'elenco non sta in un'unica richiesta
  for (let i = 0; i < gone.length; i += 100) await db.from('push_subscriptions').delete().in('id', gone.slice(i, i + 100))
  const now = new Date().toISOString()
  for (let i = 0; i < ok.length; i += 100) await db.from('push_subscriptions').update({ last_success_at: now }).in('id', ok.slice(i, i + 100))
  return { sent, failed }
}

// Utenti che hanno disattivato una categoria
// A gruppi di 100 persone (un elenco lungo non sta in una richiesta); se la
// lettura fallisce si ferma tutto, invece di avvisare anche chi ha detto no
export async function usersWithCategoryOff(category: PushCategory, userIds: string[]) {
  const off = new Set<string>()
  const db = pushDb()
  for (let i = 0; i < userIds.length; i += 100) {
    const { data, error } = await db.from('push_preferences').select('user_id').eq(category, false).in('user_id', userIds.slice(i, i + 100))
    if (error) throw new Error(`push_preferences: ${error.message}`)
    for (const row of data ?? []) off.add(row.user_id as string)
  }
  return off
}

type Translator = Awaited<ReturnType<typeof getTranslations<'pushNotifications'>>>

/**
 * Notifica a una persona: resta nel Centro avvisi dell'app (campanella e
 * «Novità per te», testi in tutte le lingue) e, se ha attivato le notifiche,
 * arriva anche sul telefono nella lingua di ogni suo dispositivo.
 * once: { kind, ref } per non mandarla due volte (registro push_log).
 */
export async function notifyUser(
  userId: string,
  category: PushCategory,
  build: (t: Translator, locale: string) => PushPayload,
  once?: { kind: string; ref: string }
) {
  try {
    const db = pushDb()
    if (once) {
      const { data: logged } = await db
        .from('push_log')
        .upsert({ user_id: userId, kind: once.kind, ref: once.ref }, { onConflict: 'user_id,kind,ref', ignoreDuplicates: true })
        .select('user_id')
      if (!logged?.length) return
    }
    const payloads = new Map<string, PushPayload>()
    for (const locale of locales) {
      const t = await getTranslations({ locale, namespace: 'pushNotifications' })
      payloads.set(locale, build(t, locale))
    }

    // 1. Centro avvisi (anche senza notifiche sul telefono)
    const texts = Object.fromEntries([...payloads].map(([locale, p]) => [locale, { title: p.title, body: p.body, url: p.url ?? null }]))
    const kind = once?.kind ?? payloads.get(defaultLocale)?.tag ?? null
    const { error: inboxError } = await db.from('user_notifications').insert({ user_id: userId, category, kind, texts })
    if (inboxError) console.error('[avvisi] avviso non salvato:', inboxError.message)

    // 2. Notifica sul telefono
    if (!pushConfigured()) return
    const { data: subs } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, locale').eq('user_id', userId)
    if (!subs?.length) return
    if ((await usersWithCategoryOff(category, [userId])).size) return
    await sendToSubscriptions(subs as SubscriptionRow[], (row) => payloads.get(pushLocale(row.locale))!)
  } catch (error) {
    console.error('[push] notifica non inviata:', error)
  }
}

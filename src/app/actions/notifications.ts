'use server'

import { getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { localizedPath, notifyUser, pushDb, type PushCategory } from '@/lib/push'
import { defaultLocale } from '../../../i18n'

// Centro avvisi (campanella in alto e «Novità per te» in dashboard): gli
// avvisi della persona collegata, nella lingua della pagina. Li scrive solo
// il server con notifyUser (lib/push); qui si leggono e si segnano letti.

export type NotificationItem = {
  id: string
  category: PushCategory
  kind: string | null
  title: string
  body: string
  url: string | null
  createdAt: string
  read: boolean
}

type Row = { id: string; category: PushCategory; kind: string | null; texts: Record<string, { title: string; body: string; url: string | null }>; created_at: string; read_at: string | null }

const CATEGORIES: PushCategory[] = ['network', 'expiry', 'events', 'staff', 'messages']

export async function getNotifications(options: { limit?: number; unreadOnly?: boolean; category?: PushCategory | 'all'; before?: string } = {}): Promise<{
  items: NotificationItem[]
  unread: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { items: [], unread: 0 }
  const locale = await getLocale()
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50)
  let query = supabase.from('user_notifications').select('id, category, kind, texts, created_at, read_at').order('created_at', { ascending: false }).limit(limit)
  if (options.unreadOnly) query = query.is('read_at', null)
  if (options.category && options.category !== 'all' && CATEGORIES.includes(options.category)) query = query.eq('category', options.category)
  if (options.before && !Number.isNaN(Date.parse(options.before))) query = query.lt('created_at', options.before)
  const [{ data }, unread] = await Promise.all([query, countUnread()])
  const items = ((data ?? []) as Row[]).map((row) => {
    const text = row.texts[locale] ?? row.texts[defaultLocale] ?? Object.values(row.texts)[0] ?? { title: '', body: '', url: null }
    return { id: row.id, category: row.category, kind: row.kind, title: text.title, body: text.body, url: text.url, createdAt: row.created_at, read: !!row.read_at }
  })
  return { items, unread }
}

async function countUnread(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase.from('user_notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  return count ?? 0
}

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    return await countUnread()
  } catch {
    return 0
  }
}

// ids assenti = tutti
export async function markNotificationsRead(ids?: string[]): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const clean = ids?.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100)
  if (ids && !clean?.length) return { success: true }
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: clean ?? null })
  return { success: !error }
}

// Appena completata l'iscrizione: avviso a chi ha invitato («si è iscritto
// con il tuo invito»). Una volta sola per iscritto; mai all'account KUMANI.
export async function notifyInviterOfSignup(): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const db = pushDb()
    const [{ data: profile }, { data: house }] = await Promise.all([
      db.from('profiles').select('sponsor_id, first_name').eq('id', user.id).maybeSingle(),
      db.from('system_settings').select('value').eq('key', 'house_account_id').maybeSingle(),
    ])
    const sponsor = profile?.sponsor_id as string | null | undefined
    const houseId = String(house?.value ?? '').replace(/"/g, '')
    if (!sponsor || sponsor === houseId || sponsor === user.id) return
    const name = (profile?.first_name as string | null)?.trim() || '—'
    await notifyUser(
      sponsor,
      'network',
      (t, locale) => ({ title: t('signupTitle'), body: t('signupBody', { name }), url: localizedPath(locale, '/dashboard/rete'), tag: 'signup' }),
      { kind: 'signup', ref: user.id }
    )
  } catch (error) {
    console.error('[avvisi] avviso di iscrizione non inviato:', error instanceof Error ? error.message : error)
  }
}

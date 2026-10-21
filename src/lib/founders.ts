import { revalidateTag, unstable_cache } from 'next/cache'
import { localizedPath, notifyUser, pushDb } from '@/lib/push'

// Promozione di lancio «Early Bird»: sconto commerciale del 100% sul Piano
// Base per 12 mesi ai primi 50 utenti in ordine cronologico di registrazione
// (art. 6 c.1 lett. c DPR 430/2001). Il posto e l'attivazione del Base li fa
// il database all'iscrizione (founders_on_signup); qui il contatore e
// l'avviso alla persona (una volta sola).
export const FOUNDERS_CACHE_TAG = 'founders'

const setting = (rows: { key: string; value: string }[] | null, key: string) => String(rows?.find((r) => r.key === key)?.value ?? '').replace(/"/g, '')

export type FoundersStatus = { enabled: boolean; limit: number; taken: number; left: number }

export const getFoundersStatus = unstable_cache(
  async (): Promise<FoundersStatus> => {
    const db = pushDb()
    const [{ data: rows }, { count }] = await Promise.all([
      db.from('system_settings').select('key, value').in('key', ['founders_enabled', 'founders_limit']),
      db.from('founder_members').select('user_id', { count: 'exact', head: true }).eq('counted', true),
    ])
    const limit = parseInt(setting(rows, 'founders_limit'), 10) || 50
    const taken = count ?? 0
    return { enabled: setting(rows, 'founders_enabled') === 'true' && taken < limit, limit, taken, left: Math.max(0, limit - taken) }
  },
  ['founders-status'],
  { tags: [FOUNDERS_CACHE_TAG], revalidate: 300 }
)

// Avviso «Sei tra i primi 50» a chi ha appena avuto lo sconto (una volta)
export async function notifyFounder(userId: string, number: number | null) {
  const db = pushDb()
  const { data: updated } = await db
    .from('founder_members')
    .update({ notified_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('notified_at', null)
    .select('user_id')
  if (!updated?.length) return
  await notifyUser(
    userId,
    'alerts',
    (t, locale) => ({
      title: t('founderTitle', { n: number ?? 0 }),
      body: t('founderBody'),
      url: localizedPath(locale, '/dashboard'),
      tag: `founder-${userId}`,
    }),
    { kind: 'founder', ref: userId }
  )
}

// Dalla Home: se la persona ha avuto lo sconto all'iscrizione e non è ancora
// stata avvisata, l'avviso parte adesso; il contatore si aggiorna.
export async function grantFounderIfEligible(userId: string) {
  const db = pushDb()
  const { data: f } = await db.from('founder_members').select('number, notified_at').eq('user_id', userId).maybeSingle()
  if (!f || f.notified_at) return
  await notifyFounder(userId, (f.number as number | null) ?? null)
  revalidateTag(FOUNDERS_CACHE_TAG, { expire: 0 })
}

// Admin: gli iscritti di prima senza abbonamento attivo entrano nei 50 in
// ordine di iscrizione (il Base si attiva subito) e ricevono l'avviso.
export async function includeExistingFounders(): Promise<{ included: number }> {
  const db = pushDb()
  const { data: included } = await db.rpc('founders_include_existing')
  const { data: rows } = await db.from('founder_members').select('user_id, number').is('notified_at', null)
  for (const r of rows ?? []) await notifyFounder(r.user_id as string, (r.number as number | null) ?? null)
  revalidateTag(FOUNDERS_CACHE_TAG, { expire: 0 })
  return { included: (included as number | null) ?? 0 }
}

'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'

// «Scrivi cosa ti serve»: le richieste senza risultato (solo il testo e la
// lingua, nessun dato della persona) e il loro elenco per lo Staff.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']

export async function logNeedMiss(query: string, locale: string): Promise<void> {
  const q = String(query ?? '').replace(/\s+/g, ' ').trim().slice(0, 160)
  if (q.length < 2) return
  // Solo da chi ha un account (niente scritture anonime)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const s = db()
  // Pulizia leggera: oltre 180 giorni si cancella
  await s.from('need_search_misses').delete().lt('created_at', new Date(Date.now() - 180 * 86_400_000).toISOString())
  await s.from('need_search_misses').insert({ query: q, locale: LOCALES.includes(locale) ? locale : null })
}

export type NeedMissRow = { query: string; count: number; last: string; locales: string[] }

// Ultimi 90 giorni, raggruppate per testo (maiuscole e spazi a parte)
export async function adminNeedMisses(): Promise<{ rows: NeedMissRow[]; total: number; error?: string }> {
  if (!(await verifyAdmin('stats.read'))) return { rows: [], total: 0, error: 'Non autorizzato' }
  const { data, error } = await db()
    .from('need_search_misses')
    .select('query, locale, created_at')
    .gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) return { rows: [], total: 0, error: error.message }
  const groups = new Map<string, NeedMissRow>()
  for (const r of data ?? []) {
    const key = (r.query as string).toLowerCase().replace(/\s+/g, ' ').trim()
    const g = groups.get(key)
    if (g) {
      g.count++
      if (r.locale && !g.locales.includes(r.locale as string)) g.locales.push(r.locale as string)
    } else groups.set(key, { query: r.query as string, count: 1, last: r.created_at as string, locales: r.locale ? [r.locale as string] : [] })
  }
  return { rows: [...groups.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)), total: data?.length ?? 0 }
}

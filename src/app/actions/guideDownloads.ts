'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'

// Admin → Manuale Antitruffa: quante volte è stato scaricato o stampato
// (guide_downloads, scritta da /api/antitruffa/manuale).

export type GuideDownloadStats = {
  total: number
  pdf: number
  print: number
  people: number
  today: number
  last7: number
  last30: number
  byLocale: { locale: string; n: number }[]
  byDay: { day: string; n: number }[]
  recent: { created_at: string; locale: string; mode: 'pdf' | 'print'; name: string | null }[]
  error?: string
}

const EMPTY: GuideDownloadStats = { total: 0, pdf: 0, print: 0, people: 0, today: 0, last7: 0, last30: 0, byLocale: [], byDay: [], recent: [] }

const romeDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d)

export async function adminGuideDownloads(): Promise<GuideDownloadStats> {
  if (!(await verifyAdmin('stats.read'))) return { ...EMPTY, error: 'Non autorizzato' }
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await db
    .from('guide_downloads')
    .select('created_at, user_id, locale, mode')
    .order('created_at', { ascending: false })
    .limit(20000)
  if (error) return { ...EMPTY, error: error.message }
  const rows = (data ?? []) as { created_at: string; user_id: string | null; locale: string; mode: 'pdf' | 'print' }[]

  const now = Date.now()
  const today = romeDay(new Date())
  const within = (days: number) => rows.filter((r) => now - new Date(r.created_at).getTime() < days * 86_400_000).length
  const locales = new Map<string, number>()
  for (const r of rows) locales.set(r.locale, (locales.get(r.locale) ?? 0) + 1)
  // Ultimi 30 giorni, uno per giorno (anche quelli a zero)
  const perDay = new Map<string, number>()
  for (let i = 29; i >= 0; i--) perDay.set(romeDay(new Date(now - i * 86_400_000)), 0)
  for (const r of rows) {
    const d = romeDay(new Date(r.created_at))
    if (perDay.has(d)) perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }

  // Ultimi 20, con il nome di chi l'ha scaricato
  const last = rows.slice(0, 20)
  const ids = [...new Set(last.map((r) => r.user_id).filter((id): id is string => !!id))]
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: profiles } = await db.from('profiles').select('id, first_name, last_name').in('id', ids)
    for (const p of (profiles ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ')
      if (name) names.set(p.id, name)
    }
  }

  return {
    total: rows.length,
    pdf: rows.filter((r) => r.mode === 'pdf').length,
    print: rows.filter((r) => r.mode === 'print').length,
    people: new Set(rows.map((r) => r.user_id).filter(Boolean)).size,
    today: rows.filter((r) => romeDay(new Date(r.created_at)) === today).length,
    last7: within(7),
    last30: within(30),
    byLocale: [...locales].map(([locale, n]) => ({ locale, n })).sort((a, b) => b.n - a.n),
    byDay: [...perDay].map(([day, n]) => ({ day, n })),
    recent: last.map((r) => ({ created_at: r.created_at, locale: r.locale, mode: r.mode, name: r.user_id ? names.get(r.user_id) ?? null : null })),
  }
}

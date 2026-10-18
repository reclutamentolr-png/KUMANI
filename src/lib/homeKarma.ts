import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { LISTING_COST } from '@/lib/listings'
import type { KuRenewalConfig, KuShowcaseConfig } from '@/lib/ku'

// Home, sezione KU Karma: quanto si guadagna e cosa si può prendere, con i
// valori decisi dall'Admin (Gestione KU, Sorprese) e solo i vantaggi accesi.
// Letto con la chiave di servizio e tenuto in memoria un'ora.
export type HomeKarma = {
  dailyLogin: number
  toolMin: number
  toolMax: number
  fincheck: number | null
  renewal: { cost: number; discount: number } | null
  surprise: number | null
  listing: number
  showcase: number | null
  theme: number | null
}

const FALLBACK: HomeKarma = { dailyLogin: 1, toolMin: 1, toolMax: 1, fincheck: null, renewal: null, surprise: null, listing: LISTING_COST, showcase: null, theme: null }

export const getHomeKarma = unstable_cache(
  async (): Promise<HomeKarma> => {
    try {
      const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const [{ data: points }, { data: features }, { data: unlocks }, surprise] = await Promise.all([
        db.from('ku_activity_points').select('key, points'),
        db.from('ku_features').select('key, enabled, config'),
        db.from('ku_unlocks').select('cost_ku, enabled'),
        db.rpc('surprise_points_costs'),
      ])
      const byKey = new Map((points ?? []).map((p) => [p.key as string, Number(p.points) || 0]))
      const tools = [...byKey].filter(([key, value]) => key !== 'daily_login' && key !== 'fincheck' && value > 0).map(([, value]) => value)
      const feature = <T,>(key: string) => {
        const row = (features ?? []).find((f) => f.key === key)
        return row?.enabled ? (row.config as T) : null
      }
      const renewal = feature<KuRenewalConfig>('renewal_discount')
      const showcase = feature<KuShowcaseConfig>('showcase')
      const themeCosts = (unlocks ?? []).filter((u) => u.enabled && Number(u.cost_ku) > 0).map((u) => Number(u.cost_ku))
      const karma = (surprise.data as { karma?: { voucher?: number } } | null)?.karma?.voucher
      return {
        dailyLogin: byKey.get('daily_login') ?? 1,
        toolMin: tools.length ? Math.min(...tools) : 1,
        toolMax: tools.length ? Math.max(...tools) : 1,
        fincheck: byKey.get('fincheck') || null,
        renewal: renewal && renewal.cost_ku > 0 ? { cost: renewal.cost_ku, discount: renewal.discount_eur } : null,
        surprise: typeof karma === 'number' && karma > 0 ? karma : null,
        listing: LISTING_COST,
        showcase: showcase && showcase.cost_7d > 0 ? showcase.cost_7d : null,
        theme: themeCosts.length ? Math.min(...themeCosts) : null,
      }
    } catch {
      return FALLBACK
    }
  },
  ['home-karma'],
  { tags: ['home-karma'], revalidate: 3600 }
)

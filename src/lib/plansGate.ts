import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { romeDate } from '@/lib/christmasShared'

// «Piani in arrivo» (Admin → Apertura piani): prima del lancio dei piani a
// pagamento si usa KUMANI gratis; chi prova ad abbonarsi (Plus, Pro o un anno
// da regalare) vede la data di apertura e può chiedere «Avvisami». Il giorno
// della data i piani si aprono da soli e parte l'avviso (cron plans-open).
// Anche la prova gratuita del Pro parte solo dall'apertura; Pass dei singoli
// servizi e KUMANI Sorpresa restano acquistabili.
// Salvato in system_settings.plans_gate.
export const PLANS_GATE_CACHE_TAG = 'plans-gate'

export type PlansGateSettings = { enabled: boolean; openDate: string }
export type PlansGate = { closed: boolean; openDate: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const DEFAULT_PLANS_GATE: PlansGateSettings = { enabled: false, openDate: '2026-11-24' }

export function parsePlansGate(value: unknown): PlansGateSettings {
  let raw: unknown = value
  try {
    raw = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return DEFAULT_PLANS_GATE
  }
  if (!raw || typeof raw !== 'object') return DEFAULT_PLANS_GATE
  const r = raw as Record<string, unknown>
  return {
    enabled: r.enabled === true,
    openDate: typeof r.openDate === 'string' && DATE_RE.test(r.openDate) ? r.openDate : DEFAULT_PLANS_GATE.openDate,
  }
}

// Chiusi solo se l'interruttore è acceso e la data (ora italiana) non è arrivata
export const plansGateState = (s: PlansGateSettings, today: string): PlansGate => ({ closed: s.enabled && today < s.openDate, openDate: s.openDate })

const getSettings = unstable_cache(
  async (): Promise<PlansGateSettings> => {
    try {
      const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await service.from('system_settings').select('value').eq('key', 'plans_gate').maybeSingle()
      return data ? parsePlansGate(data.value) : DEFAULT_PLANS_GATE
    } catch {
      return DEFAULT_PLANS_GATE
    }
  },
  ['plans-gate'],
  { tags: [PLANS_GATE_CACHE_TAG], revalidate: 600 }
)

export async function getPlansGate(): Promise<PlansGate> {
  return plansGateState(await getSettings(), romeDate(new Date()))
}

// In italiano con il giorno della settimana («I piani si aprono domenica 8
// novembre»): così non serve l'articolo, che con 8 e 11 sarebbe «l'»
export const formatOpenDate = (locale: string, date: string) =>
  new Intl.DateTimeFormat(locale, { ...(locale === 'it' ? { weekday: 'long' as const } : {}), day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'))

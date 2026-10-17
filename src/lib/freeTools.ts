import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { LEGACY_PAID_TOOLS, type RequiredPlan } from '@/lib/plans'

// Servizi gratuiti (piano richiesto "free", deciso dall'Admin in
// marketplace_settings): vengono mostrati per primi in ogni categoria.
// Letto con la chiave di servizio (le pagine pubbliche non hanno sessione)
// e tenuto in memoria un'ora (svuotata quando l'Admin cambia un piano).
export const TOOL_PLANS_CACHE_TAG = 'tool-plans'
export type ToolPlans = Record<string, string>
type ToolSettings = { plans: ToolPlans; disabled: string[] }

const fetchToolPlans = unstable_cache(
  async (): Promise<ToolSettings> => {
    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await service.from('marketplace_settings').select('tool_name, required_plan, is_enabled')
    if (error || !data) return { plans: {}, disabled: [] }
    return {
      plans: Object.fromEntries(data.map((row) => [row.tool_name as string, (row.required_plan as string) ?? ''])),
      disabled: data.filter((row) => row.is_enabled === false).map((row) => row.tool_name as string),
    }
  },
  ['tool-settings'],
  { revalidate: 3600, tags: [TOOL_PLANS_CACHE_TAG] }
)

// Nomi dei servizi gratuiti tra quelli indicati. Stessa regola di
// requiredPlan() in marketplaceAccess.ts: senza riga (o senza piano) è
// gratuito, tranne i vecchi strumenti a pagamento.
export async function getFreeToolNames(toolNames: string[]): Promise<string[]> {
  let plans: ToolPlans = {}
  try {
    plans = (await fetchToolPlans()).plans
  } catch {
    return []
  }
  return toolNames.filter((name) => (plans[name] || (LEGACY_PAID_TOOLS.includes(name) ? 'base' : 'free')) === 'free')
}

// Piano richiesto da ogni strumento indicato (stessa regola di sopra). Vuoto se
// la lettura non riesce: allora non si mostra nessun piano.
export async function getToolPlanOf(toolNames: string[]): Promise<Record<string, RequiredPlan>> {
  let plans: ToolPlans
  try {
    plans = (await fetchToolPlans()).plans
  } catch {
    return {}
  }
  return Object.fromEntries(toolNames.map((name) => [name, (plans[name] || (LEGACY_PAID_TOOLS.includes(name) ? 'base' : 'free')) as RequiredPlan]))
}

// Strumenti spenti dall'Admin (spariscono dalle schede dei servizi uniti e dai
// bisogni della Home). Vuoto se la lettura non riesce.
export async function getDisabledTools(): Promise<string[]> {
  try {
    return (await fetchToolPlans()).disabled
  } catch {
    return []
  }
}

// Quanti tra i servizi indicati sono accesi (spenti dall'Admin = esclusi):
// il numero dei servizi nella Home. Null se la lettura non riesce.
export async function countEnabledTools(toolNames: string[]): Promise<number | null> {
  try {
    const { disabled } = await fetchToolPlans()
    return toolNames.filter((name) => !disabled.includes(name)).length
  } catch {
    return null
  }
}

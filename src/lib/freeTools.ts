import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { LEGACY_PAID_TOOLS, type RequiredPlan } from '@/lib/plans'
import { getSessionIsAdmin, getSessionUser } from '@/lib/session'

// Servizi gratuiti (piano richiesto "free", deciso dall'Admin in
// marketplace_settings): vengono mostrati per primi in ogni categoria.
// Letto con la chiave di servizio (le pagine pubbliche non hanno sessione)
// e tenuto in memoria un minuto (svuotata anche quando l'Admin cambia un piano).
export const TOOL_PLANS_CACHE_TAG = 'tool-plans'
export type ToolPlans = Record<string, string>
// preview: spenti per gli iscritti ma aperti allo Staff («Solo Staff»)
type ToolSettings = { plans: ToolPlans; disabled: string[]; preview: string[] }

const fetchToolPlans = unstable_cache(
  async (): Promise<ToolSettings> => {
    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await service.from('marketplace_settings').select('tool_name, required_plan, is_enabled, staff_preview')
    if (error || !data) return { plans: {}, disabled: [], preview: [] }
    return {
      plans: Object.fromEntries(data.map((row) => [row.tool_name as string, (row.required_plan as string) ?? ''])),
      disabled: data.filter((row) => row.is_enabled === false).map((row) => row.tool_name as string),
      preview: data.filter((row) => row.is_enabled === false && row.staff_preview === true).map((row) => row.tool_name as string),
    }
  },
  ['tool-settings-preview'],
  // Un minuto al massimo: sul sito pubblicato lo svuotamento a ogni cambio
  // dall'Admin non sempre arriva, e un servizio spento restava visibile per un'ora
  { revalidate: 60, tags: [TOOL_PLANS_CACHE_TAG] }
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

// Servizi «Solo Staff» per chi guarda: tutti per lo Staff, nessuno per gli
// iscritti. Legge la sessione: solo nelle pagine dinamiche.
export const getStaffPreviewTools = cache(async (): Promise<string[]> => {
  try {
    const preview = (await fetchToolPlans()).preview ?? []
    if (!preview.length) return []
    const user = await getSessionUser()
    if (!user || !(await getSessionIsAdmin(user.id))) return []
    return preview
  } catch {
    return []
  }
})

// Spenti per chi guarda: come getDisabledTools, ma lo Staff vede anche quelli
// in anteprima. Solo nelle pagine dinamiche (legge la sessione).
export async function getHiddenTools(): Promise<string[]> {
  const [disabled, preview] = await Promise.all([getDisabledTools(), getStaffPreviewTools()])
  return disabled.filter((tool) => !preview.includes(tool))
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

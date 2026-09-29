import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { LEGACY_PAID_TOOLS } from '@/lib/plans'

// Servizi gratuiti (piano richiesto "free", deciso dall'Admin in
// marketplace_settings): vengono mostrati per primi in ogni categoria.
// Letto con la chiave di servizio (le pagine pubbliche non hanno sessione)
// e tenuto in memoria 5 minuti.
export type ToolPlans = Record<string, string>

const fetchToolPlans = unstable_cache(
  async (): Promise<ToolPlans> => {
    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await service.from('marketplace_settings').select('tool_name, required_plan')
    if (error || !data) return {}
    return Object.fromEntries(data.map((row) => [row.tool_name as string, (row.required_plan as string) ?? '']))
  },
  ['tool-plans'],
  { revalidate: 300 }
)

// Nomi dei servizi gratuiti tra quelli indicati. Stessa regola di
// requiredPlan() in marketplaceAccess.ts: senza riga (o senza piano) è
// gratuito, tranne i vecchi strumenti a pagamento.
export async function getFreeToolNames(toolNames: string[]): Promise<string[]> {
  let plans: ToolPlans = {}
  try {
    plans = await fetchToolPlans()
  } catch {
    return []
  }
  return toolNames.filter((name) => (plans[name] || (LEGACY_PAID_TOOLS.includes(name) ? 'base' : 'free')) === 'free')
}

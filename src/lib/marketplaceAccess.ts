import type { SupabaseClient } from '@supabase/supabase-js'
import { LEGACY_PAID_TOOLS, planCovers, type RequiredPlan, type UserPlan } from '@/lib/plans'

export type ToolDisabledReason = 'offline' | 'subscription' | 'pro'

export interface MarketplaceAccessState {
  userPlan: UserPlan
  // Solo prova Pro, senza abbonamento pagato: aperti Pro e Free, non il Base
  trialOnly: boolean
  isSettingEnabled: (toolName: string) => boolean
  isToolEnabled: (toolName: string) => boolean
  requiredPlan: (toolName: string) => RequiredPlan
  disabledReason: (toolName: string) => ToolDisabledReason | undefined
}

// Strumenti che si aprono per tutti i registrati anche senza il piano: il
// piano serve solo per alcune azioni, controllate lato database (es. Travel:
// chi è invitato vede i viaggi condivisi con lui, solo creare richiede il
// piano, vedi trip_create).
export const OPEN_TO_ALL_MEMBERS = ['travel']

type SettingRow = { tool_name: string; is_enabled: boolean; required_plan?: RequiredPlan }

/**
 * Stato d'accesso per le schede del Marketplace e della dashboard: piano
 * dell'utente (my_plan) e, per ogni strumento, acceso/spento e piano
 * richiesto (marketplace_settings, deciso dall'admin). Il controllo vero
 * resta can_use_tool() lato database/middleware: qui è solo presentazione.
 */
export async function getMarketplaceAccessState(supabase: SupabaseClient, userId: string): Promise<MarketplaceAccessState> {
  let settings: SettingRow[] = []
  const withPlan = await supabase.from('marketplace_settings').select('tool_name, is_enabled, required_plan')
  if (!withPlan.error) {
    settings = (withPlan.data ?? []) as SettingRow[]
  } else {
    const legacy = await supabase.from('marketplace_settings').select('tool_name, is_enabled')
    settings = (legacy.data ?? []) as SettingRow[]
  }
  const byTool = new Map(settings.map((row) => [row.tool_name, row]))

  let userPlan: UserPlan = 'none'
  const planResult = await supabase.rpc('my_plan')
  if (!planResult.error && typeof planResult.data === 'string') {
    userPlan = planResult.data as UserPlan
  } else {
    // Migrazione dei piani non ancora applicata: abbonamento attivo = Base.
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_expires_at')
      .eq('id', userId)
      .maybeSingle()
    const expires = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).getTime() : null
    if (profile?.subscription_status === 'active' && (expires === null || expires > new Date().getTime())) userPlan = 'base'
  }

  // Prova Pro gratuita: apre gli strumenti Pro, non quelli del piano Base
  // (stessa regola di tool_access nel database).
  let trialOnly = false
  const trialResult = await supabase.rpc('my_trial_only')
  if (!trialResult.error) trialOnly = trialResult.data === true

  const isSettingEnabled = (toolName: string) => byTool.get(toolName)?.is_enabled !== false
  const requiredPlan = (toolName: string): RequiredPlan =>
    byTool.get(toolName)?.required_plan ?? (LEGACY_PAID_TOOLS.includes(toolName) ? 'base' : 'free')
  const isToolEnabled = (toolName: string) =>
    isSettingEnabled(toolName) &&
    (OPEN_TO_ALL_MEMBERS.includes(toolName) ||
      (planCovers(userPlan, requiredPlan(toolName)) && !(trialOnly && requiredPlan(toolName) === 'base')))
  const disabledReason = (toolName: string): ToolDisabledReason | undefined => {
    if (!isSettingEnabled(toolName)) return 'offline'
    if (isToolEnabled(toolName)) return undefined
    return requiredPlan(toolName) === 'pro' ? 'pro' : 'subscription'
  }

  return { userPlan, trialOnly, isSettingEnabled, isToolEnabled, requiredPlan, disabledReason }
}

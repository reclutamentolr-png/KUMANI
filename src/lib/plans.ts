// Piani KUMANI: Base (49 €/anno) e Pro (149 €/anno, include il Base).
// Il piano richiesto da ogni strumento lo decide l'admin
// (marketplace_settings.required_plan); il controllo vero è can_use_tool()
// nel database — questi helper servono all'interfaccia.

export type UserPlan = 'none' | 'base' | 'pro'
export type RequiredPlan = 'free' | 'base' | 'pro'

export function planCovers(plan: UserPlan, required: RequiredPlan): boolean {
  if (required === 'free') return true
  if (required === 'base') return plan === 'base' || plan === 'pro'
  return plan === 'pro'
}

// Strumenti a pagamento prima dei piani (fallback se la migrazione dei piani
// non è ancora applicata o uno strumento non è censito in marketplace_settings).
export const LEGACY_PAID_TOOLS = [
  'link-in-bio', 'memolife', 'neurobalance', 'svat', 'offermaker', 'qr-code-pro', 'life-calendar',
  'findo', 'digital-receipt', 'aureya', 'preventivi', 'kumani-cv', 'spendly', 'fidelity',
]

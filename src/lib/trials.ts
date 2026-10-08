// Prove temporanee dei servizi (codici di prova): elenco dei servizi
// provabili, durate e limiti. Usato dal server e dai componenti.

export const TRIAL_TOOLS = {
  pro: ['fidelity', 'digital-receipt', 'preventivi', 'magazzino', 'calcolatrici', 'landing-page', 'menu'],
  base: ['link-in-bio', 'memolife', 'life-calendar', 'garage', 'casa', 'findo', 'spendly', 'kumani-cv'],
} as const

export type TrialTool = (typeof TRIAL_TOOLS)['pro'][number] | (typeof TRIAL_TOOLS)['base'][number]

export const ALL_TRIAL_TOOLS: readonly string[] = [...TRIAL_TOOLS.pro, ...TRIAL_TOOLS.base]

export function isTrialTool(tool: string): tool is TrialTool {
  return ALL_TRIAL_TOOLS.includes(tool)
}

// Durate proposte, in minuti: 1 ora, 24 ore, 3 giorni, 7 giorni
export const TRIAL_DURATIONS = [60, 1440, 4320, 10080] as const
export type TrialDuration = (typeof TRIAL_DURATIONS)[number]

// Codici attivi (non ancora usati, non cancellati, non scaduti) per Kumano o agente
export const MAX_ACTIVE_TRIAL_CODES = 10
// Giorni entro cui il codice va attivato
export const TRIAL_ACTIVATE_DAYS = 7

// Indirizzo della pagina del servizio (Travel e Kordata stanno fuori da /marketplace)
export function trialToolPath(tool: string): string {
  return `/marketplace/${tool}`
}

type MaybeUser = { app_metadata?: Record<string, unknown> | null } | null | undefined

// Ospite in prova: ruolo scritto dal server nell'account (non modificabile dall'utente)
export function isGuestUser(user: MaybeUser): boolean {
  return user?.app_metadata?.role === 'guest'
}

export function guestTrial(user: MaybeUser): { tool: string; until: string } | null {
  if (!isGuestUser(user)) return null
  const tool = user?.app_metadata?.trial_tool
  const until = user?.app_metadata?.trial_until
  return typeof tool === 'string' && typeof until === 'string' ? { tool, until } : null
}

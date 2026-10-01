// Gestione KU: tipi e regole condivisi (server action, admin, wallet,
// dashboard). Le impostazioni vivono in public.ku_features, modificabili
// dal pannello admin "Gestione KU" — vedi 20260927100000_ku_management.sql.

// Ordine di visualizzazione (Admin → Gestione KU e Portafoglio)
export const KU_FEATURE_KEYS = ['showcase', 'unlocks', 'badges', 'renewal_discount', 'conversion'] as const
export type KuFeatureKey = (typeof KU_FEATURE_KEYS)[number]

export interface KuShowcaseConfig { cost_7d: number; cost_15d: number }
export interface KuBadgeLevel { key: string; threshold: number }
export interface KuBadgesConfig { levels: KuBadgeLevel[] }
export interface KuRenewalConfig { cost_ku: number; discount_eur: number; max_per_year: number }
export interface KuConversionConfig { ku_per_point: number; max_points_per_month: number }

export interface KuFeatureRow {
  key: KuFeatureKey
  enabled: boolean
  config: Record<string, unknown>
  updated_at?: string
}

export interface KuUnlockRow {
  key: string
  tool: string
  cost_ku: number
  enabled: boolean
}

// Sblocchi implementati nel codice. Per aggiungerne uno nuovo: voce in
// ku_unlocks (migrazione) + controllo nello strumento + testi "unlock_<key>".
// Vecchio pacchetto con tutti e tre i temi (disattivato: chi l'ha comprato
// li conserva tutti); oggi ogni tema speciale si sblocca a parte.
export const KU_UNLOCK_LINKINBIO_THEMES = 'linkinbio_premium_themes'
export const linkInBioThemeUnlockKey = (theme: string) => `linkinbio_theme_${theme}`

// Badge raggiunto più alto (livelli ordinati per soglia), null se nessuno.
export function currentKuBadge(levels: KuBadgeLevel[] | undefined, earnedTotal: number): KuBadgeLevel | null {
  const sorted = [...(levels ?? [])].sort((a, b) => a.threshold - b.threshold)
  let reached: KuBadgeLevel | null = null
  for (const level of sorted) if (earnedTotal >= level.threshold) reached = level
  return reached
}

export function nextKuBadge(levels: KuBadgeLevel[] | undefined, earnedTotal: number): KuBadgeLevel | null {
  return [...(levels ?? [])].sort((a, b) => a.threshold - b.threshold).find((level) => earnedTotal < level.threshold) ?? null
}

export function featureConfig<T>(features: KuFeatureRow[], key: KuFeatureKey): (T & { enabled: boolean }) | null {
  const row = features.find((feature) => feature.key === key)
  return row ? ({ ...(row.config as T), enabled: row.enabled }) : null
}

export interface RankDefinition {
  key: string
  threshold: number
  labelKey: string
  descriptionKey: string
  icon: 'Star' | 'Sparkles' | 'Crown'
}

// Qualifiche Kuman Green / Star / Black: solo badge, senza premi. Si
// raggiungono con i Punti Community guadagnati in totale
// (profiles.network_points_earned_total), non con il saldo: spendere punti
// per i pacchetti voucher non fa perdere il badge. Le soglie sono quelle dei
// pacchetti voucher (system_settings.voucher_packs, di default 294 / 1800 /
// 5500): la data di raggiungimento la registra il database
// (record_network_badges in 20261203100000_network_points_v2.sql).
export const DEFAULT_RANK_THRESHOLDS = [294, 1800, 5500]

const RANK_SHAPES: Omit<RankDefinition, 'threshold'>[] = [
  { key: 'rising_star', labelKey: 'risingStar', descriptionKey: 'risingStarDesc', icon: 'Star' },
  { key: 'shining_star', labelKey: 'shiningStar', descriptionKey: 'shiningStarDesc', icon: 'Sparkles' },
  { key: 'diamond_star', labelKey: 'diamondStar', descriptionKey: 'diamondStarDesc', icon: 'Crown' },
]

// Qualifiche con le soglie correnti (dai pacchetti voucher); ordinate in
// modo crescente, getCurrentRank si basa su questo.
export function buildRanks(thresholds: number[] = DEFAULT_RANK_THRESHOLDS): RankDefinition[] {
  return RANK_SHAPES.map((shape, i) => ({ ...shape, threshold: thresholds[i] ?? DEFAULT_RANK_THRESHOLDS[i] }))
}

export const RANKS: RankDefinition[] = buildRanks()

// Soglie dai pacchetti voucher letti dal database ([{points, credit_eur}])
export function thresholdsFromPacks(packs: unknown): number[] {
  if (!Array.isArray(packs)) return DEFAULT_RANK_THRESHOLDS
  const points = packs.map((p) => Number((p as { points?: unknown })?.points)).filter((n) => Number.isFinite(n) && n > 0)
  return points.length >= 3 ? points.slice(0, 3) : DEFAULT_RANK_THRESHOLDS
}

/** Highest rank whose threshold has been reached, or null. */
export function getCurrentRank(earnedPoints: number, ranks: RankDefinition[] = RANKS): RankDefinition | null {
  let current: RankDefinition | null = null
  for (const rank of ranks) {
    if (earnedPoints >= rank.threshold) current = rank
  }
  return current
}

/**
 * The highest achieved rank that isn't in `seenKeys` yet — the one the
 * congrats popup should show. If someone jumps past an intermediate rank,
 * only the highest newly-achieved one is shown.
 */
export function getNewlyAchievedRank(earnedPoints: number, seenKeys: string[], ranks: RankDefinition[] = RANKS): RankDefinition | null {
  const achieved = ranks.filter((r) => earnedPoints >= r.threshold && !seenKeys.includes(r.key))
  return achieved.length > 0 ? achieved[achieved.length - 1] : null
}

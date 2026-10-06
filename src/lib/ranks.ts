export interface RankDefinition {
  key: string
  labelKey: string
  descriptionKey: string
  icon: 'Star' | 'Sparkles' | 'Crown'
  // Colore della stella del festeggiamento
  color: 'green' | 'gold' | 'black'
  // Requisiti: attivazioni Base/Pro pagate delle persone invitate e KU
  // Points guadagnati in totale (compresi quelli ricevuti dalla struttura)
  activations: number
  points: number
  // Voucher Base di premio
  vouchers: number
}

// Qualifiche Kuman Green / Star / Black: le decide il database
// (evaluate_qualifications in 20270113100000_ku_points_qualifications_v3.sql),
// che registra la data in rank_achievements e mette i voucher premio nel
// Wallet. Qui solo regole (da system_settings.qualifications) e avanzamento.
export type QualificationRule = { key: string; activations: number; points: number; vouchers: number }

export const DEFAULT_QUALIFICATIONS: QualificationRule[] = [
  { key: 'rising_star', activations: 6, points: 60, vouchers: 1 },
  { key: 'shining_star', activations: 36, points: 360, vouchers: 6 },
  { key: 'diamond_star', activations: 108, points: 1080, vouchers: 18 },
]

const RANK_SHAPES: Omit<RankDefinition, 'activations' | 'points' | 'vouchers'>[] = [
  { key: 'rising_star', labelKey: 'risingStar', descriptionKey: 'risingStarDesc', icon: 'Star', color: 'green' },
  { key: 'shining_star', labelKey: 'shiningStar', descriptionKey: 'shiningStarDesc', icon: 'Sparkles', color: 'gold' },
  { key: 'diamond_star', labelKey: 'diamondStar', descriptionKey: 'diamondStarDesc', icon: 'Crown', color: 'black' },
]

// Qualifiche con le regole correnti, in ordine crescente
export function buildRanks(rules: unknown = DEFAULT_QUALIFICATIONS): RankDefinition[] {
  const list = Array.isArray(rules) ? (rules as QualificationRule[]) : DEFAULT_QUALIFICATIONS
  return RANK_SHAPES.map((shape, i) => {
    const rule = list.find((r) => r?.key === shape.key) ?? DEFAULT_QUALIFICATIONS[i]
    return { ...shape, activations: Number(rule.activations) || 0, points: Number(rule.points) || 0, vouchers: Number(rule.vouchers) || 0 }
  })
}

export const RANKS: RankDefinition[] = buildRanks()

/** Qualifica più alta tra quelle raggiunte (registrate dal database), o null. */
export function getCurrentRank(achievedKeys: string[], ranks: RankDefinition[] = RANKS): RankDefinition | null {
  let current: RankDefinition | null = null
  for (const rank of ranks) if (achievedKeys.includes(rank.key)) current = rank
  return current
}

/**
 * La qualifica raggiunta più alta non ancora vista: quella del popup di
 * festeggiamento. Se si salta una qualifica intermedia, si festeggia solo
 * la più alta.
 */
export function getNewlyAchievedRank(achievedKeys: string[], seenKeys: string[], ranks: RankDefinition[] = RANKS): RankDefinition | null {
  const fresh = ranks.filter((r) => achievedKeys.includes(r.key) && !seenKeys.includes(r.key))
  return fresh.length > 0 ? fresh[fresh.length - 1] : null
}

/** Avanzamento verso una qualifica (0–100): conta il requisito più indietro. */
export function rankProgress(rank: RankDefinition, activations: number, points: number): number {
  const a = rank.activations > 0 ? activations / rank.activations : 1
  const p = rank.points > 0 ? points / rank.points : 1
  return Math.round(Math.min(a, p, 1) * 100)
}

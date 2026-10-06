import { getTranslations } from 'next-intl/server'
import type { RankDefinition } from '@/lib/ranks'

// Cosa manca per una qualifica: attivazioni e KU Points (servono entrambi)
export async function rankMissingText(rank: RankDefinition, activations: number, points: number): Promise<string | null> {
  const t = await getTranslations('dashboard')
  const acts = Math.max(rank.activations - activations, 0)
  const pts = Math.max(rank.points - points, 0)
  const name = t(rank.labelKey)
  if (acts > 0 && pts > 0) return t('missingBoth', { acts, points: pts, rank: name })
  if (acts > 0) return t('missingActivations', { acts, rank: name })
  if (pts > 0) return t('missingPoints', { points: pts, rank: name })
  return null
}

// Riga "3/6 attivazioni · 40/60 KU Points"
export default async function RankRequirements({ rank, activations, points, className = '' }: { rank: RankDefinition; activations: number; points: number; className?: string }) {
  const t = await getTranslations('dashboard')
  return (
    <span className={className}>
      {t('rankRequirementLine', {
        acts: Math.min(activations, rank.activations),
        actsTarget: rank.activations,
        points: Math.min(points, rank.points),
        pointsTarget: rank.points,
      })}
    </span>
  )
}

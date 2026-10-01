import { getTranslations } from 'next-intl/server'
import { Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { currentKuBadge, nextKuBadge, type KuBadgesConfig } from '@/lib/ku'

// Badge di costanza (Gestione KU → 3): compare solo se il metodo è attivo.
// Mostra il badge raggiunto e, sotto, quanto manca al prossimo.
export default async function KuBadge({ earnedTotal }: { earnedTotal: number }) {
  const supabase = await createClient()
  const { data } = await supabase.from('ku_features').select('enabled, config').eq('key', 'badges').maybeSingle()
  if (!data?.enabled) return null
  const levels = (data.config as KuBadgesConfig).levels
  const badge = currentKuBadge(levels, earnedTotal)
  const next = nextKuBadge(levels, earnedTotal)
  if (!badge && !next) return null
  const t = await getTranslations('kuRewards')
  const name = (key: string) => (t.has(`badge_${key}`) ? t(`badge_${key}`) : key)

  return (
    <div className="space-y-1.5">
      {badge && (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
          <Award className="h-3.5 w-3.5 text-[var(--gold)]" />
          {name(badge.key)}
        </span>
      )}
      {next && (
        <div>
          <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
            {!badge && <Award className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" />}
            {t('dashboardBadgeProgress', { name: name(next.key), current: earnedTotal, target: next.threshold })}
          </p>
          <div className="mt-1 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-[var(--gold)]/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]"
              style={{ width: `${Math.min(100, Math.round((earnedTotal / next.threshold) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

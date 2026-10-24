'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, HeartHandshake } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getAffinityBadge } from '@/app/actions/affinityFriends'
import { useAffinityRealtime } from '@/lib/useAffinityRealtime'

type Badge = { unread: number; pending: number }

// Avviso in dashboard: nuovi messaggi o presentazioni da guardare in
// Affinity Amicizie. La connessione in tempo reale si apre solo per chi
// partecipa ad Amicizie (LiveBadge), non per tutti gli utenti.
export default function AffinityBadge() {
  const [initial, setInitial] = useState<(Badge & { active: boolean }) | null>(null)

  useEffect(() => {
    getAffinityBadge()
      .then(setInitial)
      .catch(() => setInitial(null))
  }, [])

  if (!initial?.active) return null
  return <LiveBadge initial={initial} />
}

function LiveBadge({ initial }: { initial: Badge }) {
  const t = useTranslations('affinity')
  const [badge, setBadge] = useState<Badge>(initial)

  const refresh = useCallback(async () => {
    const next = await getAffinityBadge().catch(() => null)
    if (next) setBadge(next)
  }, [])

  useAffinityRealtime(refresh)

  if (badge.unread === 0 && badge.pending === 0) return null

  const parts = [
    badge.unread > 0 ? t('badgeMessages', { count: badge.unread }) : null,
    badge.pending > 0 ? t('badgeIntros', { count: badge.pending }) : null,
  ].filter(Boolean)

  return (
    <Link
      href="/app/affinity"
      className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/40 bg-white px-5 py-4 shadow-sm transition-colors hover:border-[var(--gold)]"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
          <HeartHandshake className="h-4.5 w-4.5" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-orange-500" />
        </span>
        <div>
          <p className="font-semibold text-[var(--ink)]">Affinity</p>
          <p className="text-xs text-[var(--muted)]">{parts.join(' · ')}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-[var(--ink)] transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

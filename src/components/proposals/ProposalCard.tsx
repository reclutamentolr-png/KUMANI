'use client'

import { useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { MessageSquareText } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { STATUS_STYLES, VOTABLE_STATUSES, type Proposal } from '@/lib/proposals'
import VoteButton from './VoteButton'

const noop = () => () => {}

// Tempo trascorso leggibile («3 giorni fa»). Server e primo disegno nel browser
// mostrano la data (uguale ovunque, ora italiana); il «fa» arriva subito dopo,
// così l'orologio del server e quello del telefono non entrano in conflitto.
export function useTimeAgo() {
  const locale = useLocale()
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' })
  return (iso: string) => {
    if (!mounted) return date.format(new Date(iso))
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000
    const steps: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]
    for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
    return rtf.format(0, 'minute')
  }
}

export default function ProposalCard({ proposal: p, serviceName }: { proposal: Proposal; serviceName?: string | null }) {
  const t = useTranslations('proposals')
  const ago = useTimeAgo()
  const votable = VOTABLE_STATUSES.includes(p.status) && !p.is_mine
  const topic = p.topic === 'existing' && serviceName ? serviceName : t(`topics.${p.topic}`)
  return (
    <article className="flex gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {p.is_mine ? (
        <div className="flex min-h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--background)] text-[var(--muted)]" aria-label={t('votesCount', { count: p.votes_count })}>
          <span className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{p.votes_count}</span>
          <span className="text-[10px] font-bold uppercase tracking-wide">{t('votesShort')}</span>
        </div>
      ) : (
        <VoteButton id={p.id} title={p.title} votes={p.votes_count} voted={p.my_vote} disabled={!votable} />
      )}
      <Link href={`/community/proposte/${p.id}`} className="flex min-w-0 flex-1 flex-col gap-1.5 text-[var(--ink)]">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${STATUS_STYLES[p.status]}`}>{t(`status.${p.status}`)}</span>
          <span className="text-xs text-[var(--muted)]">
            {topic} · {ago(p.published_at ?? p.created_at)}
          </span>
        </span>
        <span className="break-words text-base font-extrabold leading-snug">{p.title}</span>
        <span className="line-clamp-2 break-words text-sm leading-relaxed text-[var(--muted)]">{p.body}</span>
        {p.staff_reply && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7a5a14]">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
            {t('staffReplied')}
          </span>
        )}
      </Link>
    </article>
  )
}

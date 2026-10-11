'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Flag, ShieldAlert } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { contestScam, scamLookup, type ScamMatch } from '@/app/actions/scamNet'
import { reportHref, type ScamKind } from '@/lib/scamNet'

// Avviso della Rete Anti-Truffa dentro un controllo (SVAT, QR, Verifica IBAN,
// CheckMail): compare solo se il dato è stato segnalato e confermato. Sotto,
// sempre, il collegamento per segnalarlo.

export function useTimeAgoShort() {
  const locale = useLocale()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  return (iso: string) => {
    const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
    if (days === 0) {
      const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000)
      return rtf.format(hours, 'hour')
    }
    return Math.abs(days) < 30 ? rtf.format(days, 'day') : rtf.format(Math.round(days / 30), 'month')
  }
}

export function MatchCard({ match }: { match: ScamMatch }) {
  const t = useTranslations('scamNet')
  const ago = useTimeAgoShort()
  const [contestOpen, setContestOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contest, setContest] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const send = async () => {
    setContest('sending')
    setContest((await contestScam(match.targetId, message)) ? 'sent' : 'error')
  }
  return (
    <section className="space-y-3 rounded-2xl bg-[#A12A2A] p-4 text-white sm:p-5" role="alert">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#FFD9D3]">{t('warning.eyebrow')}</p>
          <p className="text-xl font-extrabold leading-tight">{t('warning.title', { count: match.reports })}</p>
        </div>
      </div>
      <p className="break-all text-sm font-semibold text-white">{match.value}</p>
      <p className="text-sm text-[#FFE9E5]">{t('warning.last', { when: ago(match.lastReportAt) })}</p>
      {match.category && <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{t(`categories.${match.category}`)}</span>}
      {match.quotes.length > 0 && (
        <ul className="space-y-2">
          {match.quotes.map((q, i) => (
            <li key={i} className="rounded-xl bg-white/10 p-3 text-sm">
              <p className="leading-snug">«{q.text}»</p>
              <p className="mt-1 text-xs text-[#FFD9D3]">{q.city ? t('warning.quoteCity', { city: q.city, when: ago(q.at) }) : t('warning.quote', { when: ago(q.at) })}</p>
            </li>
          ))}
        </ul>
      )}
      {match.kind === 'phone' && <p className="text-xs leading-relaxed text-[#FFE9E5]">{t('warning.spoof')}</p>}
      <p className="text-xs leading-relaxed text-[#FFE9E5]">{t('warning.what')}</p>
      {contest === 'sent' ? (
        <p className="text-xs font-semibold text-white" role="status">
          {t('warning.contestSent')}
        </p>
      ) : contestOpen ? (
        <div className="space-y-2 rounded-xl bg-white p-3 text-[var(--ink)]">
          <label className="block text-xs font-semibold text-[var(--muted)]">
            {t('warning.contestLabel')}
            <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1000))} rows={3} className="mt-1 block w-full rounded-lg border border-[var(--gold)]/35 p-2 text-sm" />
          </label>
          {contest === 'error' && <p className="text-xs font-semibold text-[#A12A2A]">{t('warning.contestError')}</p>}
          <button type="button" disabled={message.trim().length < 10 || contest === 'sending'} onClick={send} className="min-h-10 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-40">
            {t('warning.contestSend')}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setContestOpen(true)} className="min-h-9 text-xs font-semibold text-white/85 underline underline-offset-2 hover:text-white">
          {t('warning.contest')}
        </button>
      )}
    </section>
  )
}

export default function CommunityWarning({ items, report }: { items: { kind: ScamKind; value: string }[]; report?: { kind: ScamKind; value: string } | null }) {
  const t = useTranslations('scamNet')
  const [matches, setMatches] = useState<ScamMatch[]>([])
  const key = JSON.stringify(items)

  useEffect(() => {
    let cancelled = false
    const list = JSON.parse(key) as { kind: ScamKind; value: string }[]
    if (!list.length) return
    scamLookup(list)
      .then((found) => {
        if (!cancelled) setMatches(found)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [key])

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <MatchCard key={m.targetId} match={m} />
      ))}
      {report && report.value && (
        <Link href={reportHref(report.kind, report.value)} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[#7a5a14] hover:underline">
          <Flag className="h-4 w-4" aria-hidden="true" /> {matches.length ? t('warning.reportToo') : t('warning.report')}
        </Link>
      )}
    </div>
  )
}

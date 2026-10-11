'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Lightbulb, LoaderCircle, Plus } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { listProposals } from '@/app/actions/proposals'
import { PROPOSAL_SORTS, type Proposal, type ProposalSort } from '@/lib/proposals'
import ProposalCard from './ProposalCard'

export default function ProposalsBoard({
  initial,
  access,
  services,
}: {
  initial: Proposal[]
  access: { canPropose: boolean; reason: 'plan' | 'week' | null }
  services: Record<string, string>
}) {
  const t = useTranslations('proposals')
  const [sort, setSort] = useState<ProposalSort>('top')
  const [items, setItems] = useState(initial)
  const [loading, start] = useTransition()

  const pick = (next: ProposalSort) => {
    if (next === sort) return
    setSort(next)
    start(async () => setItems(await listProposals(next)))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('sortLabel')}>
          {PROPOSAL_SORTS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sort === s}
              onClick={() => pick(s)}
              className={`min-h-10 rounded-full px-4 text-sm font-bold transition-colors ${
                sort === s ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--gold)]/35 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]'
              }`}
            >
              {t(`sorts.${s}`)}
            </button>
          ))}
        </div>
        {access.canPropose ? (
          <Link
            href="/community/proposte/nuova"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-5 text-base font-bold text-[var(--gold-bright)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            {t('newProposal')}
          </Link>
        ) : (
          <p className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/50 px-4 py-2.5 text-sm text-[var(--ink)]">
            {access.reason === 'week' ? t('weekLimit') : t('planNeeded')}{' '}
            {access.reason === 'plan' && (
              <Link href="/billing" className="font-bold underline-offset-2 hover:underline">
                {t('planCta')}
              </Link>
            )}
          </p>
        )}
      </div>

      <div aria-busy={loading} aria-live="polite" className="relative">
        {loading && (
          <div className="absolute inset-x-0 top-2 z-10 flex justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" aria-label={t('loading')} />
          </div>
        )}
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-[var(--gold)]/40 bg-white/60 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--gold-pale)] text-[#7a5a14]">
              <Lightbulb className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="font-bold text-[var(--ink)]">{t(`empty.${sort}`)}</p>
            <p className="max-w-sm text-sm text-[var(--muted)]">{t('emptyText')}</p>
          </div>
        ) : (
          <ul className={`grid gap-3 transition-opacity md:grid-cols-2 ${loading ? 'opacity-50' : ''}`}>
            {items.map((p) => (
              <li key={p.id}>
                <ProposalCard proposal={p} serviceName={p.tool_name ? (services[p.tool_name] ?? null) : null} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="rounded-3xl border border-[var(--gold)]/25 bg-white p-5">
        <h2 className="text-base font-extrabold text-[var(--ink)]">{t('howTitle')}</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <li key={n} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-extrabold text-[var(--gold-bright)]">{n}</span>
              <span className="text-sm text-[var(--muted)]">
                <b className="block text-[var(--ink)]">{t(`how${n}Title`)}</b>
                {t(`how${n}Text`)}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-[var(--muted)]">{t('rulesShort')}</p>
      </section>
    </div>
  )
}

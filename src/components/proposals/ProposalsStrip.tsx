import { getTranslations } from 'next-intl/server'
import { ArrowRight, Lightbulb } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { topProposals } from '@/app/actions/proposals'
import ProposalCard from './ProposalCard'

// Pagina Community: le proposte più sostenute, con il sostegno a portata di tocco
export default async function ProposalsStrip() {
  const [t, items] = await Promise.all([getTranslations('proposals'), topProposals(3)])
  return (
    <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)]" aria-labelledby="proposals-strip">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
            <Lightbulb className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="proposals-strip" className="text-lg font-extrabold text-[var(--ink)]">
              {t('stripTitle')}
            </h2>
            <p className="text-sm text-[var(--muted)]">{t('stripText')}</p>
          </div>
        </div>
        <Link href="/community/proposte" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--gold)]/40 px-4 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
          {t('seeAll')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[var(--background)] p-4 text-sm text-[var(--muted)]">
          {t('stripEmpty')}{' '}
          <Link href="/community/proposte" className="font-bold text-[#7a5a14] underline-offset-2 hover:underline">
            {t('stripEmptyCta')}
          </Link>
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 lg:grid-cols-3">
          {items.map((p) => (
            <li key={p.id}>
              <ProposalCard proposal={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

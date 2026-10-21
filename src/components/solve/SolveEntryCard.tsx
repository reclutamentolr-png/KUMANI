import { getTranslations } from 'next-intl/server'
import { ArrowRight, LifeBuoy } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { canSeeSolve } from '@/lib/solve/server'

// «Hai un problema? Risolviamolo insieme»: ingresso a KUMANI Risolvi (pagina
// Servizi). Compare solo quando le guide sono visibili a chi guarda.
export default async function SolveEntryCard() {
  if (!(await canSeeSolve())) return null
  const t = await getTranslations('solve')
  return (
    <Link
      href="/risolvi"
      className="flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-br from-[#2a2418] to-[var(--ink)] p-4 text-white shadow-sm transition-colors hover:border-[var(--gold)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
        <LifeBuoy className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-[var(--gold-bright)]">{t('entryTitle')}</span>
        <span className="block text-sm text-white/75">{t('entryText')}</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
    </Link>
  )
}

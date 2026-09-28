import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Warehouse } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import MagazzinoApp from '@/components/magazzino/MagazzinoApp'
import { getDashboard, listCategories, listProducts } from '@/app/actions/magazzino'

// Magazzino PRO (piano Pro): la pagina è protetta dal proxy come gli altri strumenti.
export default async function MagazzinoPage() {
  const t = await getTranslations('magazzino')
  const tc = await getTranslations('common')
  const [products, dashboard, categories] = await Promise.all([listProducts(true), getDashboard(), listCategories()])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToDashboard')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {t('back')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <Warehouse className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="mt-3 text-base text-white/70 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>
        <MagazzinoApp initialProducts={products} initialDashboard={dashboard} initialCategories={categories} />
      </main>
    </div>
  )
}

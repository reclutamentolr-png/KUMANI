import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, BookMarked } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AppHeader from '@/components/nav/AppHeader'
import { pageMetadata } from '@/lib/seo'
import { getCatalog } from '@/lib/catalog-server'
import CatalogBrowser from '@/components/catalog/CatalogBrowser'
import CatalogPdfButton from '@/components/catalog/CatalogPdfButton'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('catalog')
  return pageMetadata('/catalogo', { title: t('pageTitle'), description: t('intro') })
}

// Catalogo dei servizi, pubblico: come un manuale, per categorie, con
// l'essenziale di ogni servizio e il PDF da scaricare.
export default async function CatalogPage() {
  const locale = await getLocale()
  const t = await getTranslations('catalog')
  const [catalog, appHeader] = await Promise.all([getCatalog(locale), AppHeader({ title: t('pageTitle'), icon: <BookMarked className="h-5 w-5" /> })])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {appHeader ?? (
        <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)]">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
              <ArrowLeft className="h-4 w-4" /> KUMANI
            </Link>
            <span className="flex items-center gap-2 font-semibold text-white">
              <BookMarked className="h-5 w-5 text-[var(--gold-bright)]" /> {t('pageTitle')}
            </span>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <section className="relative overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('eyebrow', { count: catalog.total })}</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t('pageTitle')}</h1>
            <p className="mt-3 max-w-2xl text-white/75">{t('intro')}</p>
            <p className="mt-3 text-sm text-white/60">{t('plansLine', { base: catalog.basePrice, pro: catalog.proPrice })}</p>
            <div className="mt-5">
              <CatalogPdfButton catalog={catalog} />
            </div>
          </div>
        </section>

        <CatalogBrowser catalog={catalog} />
      </main>
    </div>
  )
}

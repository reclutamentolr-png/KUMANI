import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Grid3x3 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import MosaicArchive from '@/components/mosaic/MosaicArchive'
import { getMosaicArchive } from '@/app/actions/mosaic'

// KUMANI Mosaic: le opere delle stagioni concluse.
export default async function MosaicArchivePage() {
  const t = await getTranslations('mosaic')
  const seasons = await getMosaicArchive()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/marketplace/mosaic" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backToMosaic')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <Grid3x3 className="h-5 w-5 text-[var(--gold-bright)]" />
            KUMANI Mosaic
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-3xl font-bold text-[var(--ink)]">{t('archiveTitle')}</h2>
        <p className="mb-8 mt-2 text-[var(--muted)]">{t('archiveIntro')}</p>
        <MosaicArchive seasons={seasons} />
      </main>
    </div>
  )
}

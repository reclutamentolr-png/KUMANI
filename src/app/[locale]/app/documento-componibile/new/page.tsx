import { getTranslations } from 'next-intl/server'
import { ArrowLeft, FileInput } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import HubBar from '@/components/hubs/HubBar'
import NuovoDocumento from '@/components/documento-componibile/NuovoDocumento'
import { toolMetadata } from '@/lib/toolMetadata'

export const generateMetadata = toolMetadata('documento-componibile')

// Documento nuovo: vuoto o da un modello pronto
export default async function NuovoDocumentoPage() {
  const t = await getTranslations('documentoComponibile')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/app/documento-componibile" className="flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" />
            {t('myDocs')}
          </Link>
          <h1 className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <FileInput className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            {t('newDoc')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <NuovoDocumento />
      </main>
    </div>
  )
}

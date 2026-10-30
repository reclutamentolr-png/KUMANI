import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, FileInput } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import HubBar from '@/components/hubs/HubBar'
import DocumentEditor from '@/components/documento-componibile/DocumentEditor'
import { getComposableDocument } from '@/app/actions/documentoComponibile'
import { localizedRedirect } from '@/lib/localizedRedirect'
import { createClient } from '@/lib/supabase/server'
import { toolMetadata } from '@/lib/toolMetadata'

export const generateMetadata = toolMetadata('documento-componibile')

export default async function EditDocumentoPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  const t = await getTranslations('documentoComponibile')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return localizedRedirect('/login')
  const row = await getComposableDocument(id)
  if (!row) notFound()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/app/documento-componibile" className="flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" />
            {t('myDocs')}
          </Link>
          <h1 className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <FileInput className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            <span className="truncate">{row.title}</span>
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <DocumentEditor key={row.id} id={row.id} initial={{ title: row.title, footer: row.footer, blocks: row.blocks }} />
      </main>
    </div>
  )
}

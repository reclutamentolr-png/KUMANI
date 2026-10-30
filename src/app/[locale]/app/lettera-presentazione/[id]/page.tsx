import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, FilePenLine } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import HubBar from '@/components/hubs/HubBar'
import LetteraForm from '@/components/lettera-presentazione/LetteraForm'
import { getCoverLetter } from '@/app/actions/letteraPresentazione'
import { localizedRedirect } from '@/lib/localizedRedirect'
import { createClient } from '@/lib/supabase/server'
import { toolMetadata } from '@/lib/toolMetadata'
import { rowToForm } from '@/lib/letteraPresentazione'
import { loadLetterSender } from '@/lib/letteraPresentazioneServer'

export const generateMetadata = toolMetadata('lettera-presentazione')

export default async function EditLetteraPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  const t = await getTranslations('letteraPresentazione')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return localizedRedirect('/login')
  const [row, { sender, fromCv }] = await Promise.all([getCoverLetter(id), loadLetterSender(user)])
  if (!row) notFound()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/app/lettera-presentazione" className="flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" />
            {t('myLetters')}
          </Link>
          <h1 className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <FilePenLine className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            <span className="truncate">{row.title}</span>
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <LetteraForm key={row.id} mode="edit" id={row.id} initial={rowToForm(row)} cvSender={fromCv ? sender : null} />
      </main>
    </div>
  )
}

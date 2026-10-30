import { getTranslations } from 'next-intl/server'
import { ArrowLeft, FilePenLine } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import HubBar from '@/components/hubs/HubBar'
import LetteraForm from '@/components/lettera-presentazione/LetteraForm'
import { localizedRedirect } from '@/lib/localizedRedirect'
import { createClient } from '@/lib/supabase/server'
import { toolMetadata } from '@/lib/toolMetadata'
import { newLetterForm } from '@/lib/letteraPresentazione'
import { loadLetterSender } from '@/lib/letteraPresentazioneServer'

export const generateMetadata = toolMetadata('lettera-presentazione')

// Lettera nuova: mittente, lingua e modello presi dal KUMANI CV (o dal profilo)
export default async function NewLetteraPage() {
  const t = await getTranslations('letteraPresentazione')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return localizedRedirect('/login')
  const { sender, fromCv } = await loadLetterSender(user)

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
            {t('newLetter')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {sender && <p className="mb-6 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">{fromCv ? t('prefilledFromCv') : t('prefilledFromProfile')}</p>}
        <LetteraForm mode="create" initial={newLetterForm(sender)} cvSender={fromCv ? sender : null} />
      </main>
    </div>
  )
}

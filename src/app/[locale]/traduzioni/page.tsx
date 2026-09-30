import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTranslator } from '@/app/actions/translations'
import Logo from '@/components/Logo'
import TranslatorWorkspace, { TranslatorLogoutButton } from '@/components/translations/TranslatorWorkspace'

// Area Traduttori: sempre in italiano (si traduce partendo dall'italiano),
// quindi volutamente senza testi next-intl.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Area Traduttori',
  robots: { index: false, follow: false },
}

export default async function TraduzioniPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const translator = await getCurrentTranslator()

  if (!translator) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect(`/${locale}/login`)
    if ((user.app_metadata as { role?: string } | undefined)?.role !== 'translator') redirect(`/${locale}/dashboard`)
    return <SuspendedNotice />
  }

  if (translator.locales.length === 0) return <SuspendedNotice />

  return <TranslatorWorkspace name={translator.name} locales={translator.locales} />
}

function SuspendedNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[var(--gold)]/35 bg-[var(--paper)] p-8 text-center shadow-[0_20px_55px_rgba(23,23,23,0.14)]">
        <div className="mb-4 flex justify-center">
          <Logo size={80} priority />
        </div>
        <h1 className="text-xl font-extrabold text-[var(--ink)]">Area Traduttori</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Account sospeso o senza lingue assegnate: contatta lo Staff.</p>
        <div className="mt-6 flex justify-center">
          <TranslatorLogoutButton variant="light" />
        </div>
      </div>
    </main>
  )
}

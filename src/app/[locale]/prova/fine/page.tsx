import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import Logo from '@/components/Logo'
import TrialEnded from '@/components/trials/TrialEnded'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Fine della prova: invito a creare l'account (con l'invito di chi ha mandato
// il codice) o a scoprire KUMANI. L'accesso da ospite si chiude qui.
export default async function TrialEndPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trials')
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] px-4 py-10">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--gold)]/30 bg-white text-center shadow-xl">
        <div className="bg-[var(--ink)] px-6 py-6">
          <Logo size={56} className="mx-auto h-14 w-14" />
        </div>
        <div className="space-y-4 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-[var(--ink)]">{t('endTitle')}</h1>
          <p className="text-gray-700">{t('endText')}</p>
          <TrialEnded />
        </div>
      </div>
    </div>
  )
}

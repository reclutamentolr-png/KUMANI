'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'

// Errore imprevisto in una pagina: messaggio chiaro, "Riprova" e ritorno
// alla Home invece della schermata bianca di Next.
export default function LocaleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations('errorPages')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ink)] px-4 text-white">
      <div className="w-full max-w-md text-center">
        <Logo size={48} className="mx-auto mb-6 h-12 w-12" />
        <h1 className="text-2xl font-bold">{t('errorTitle')}</h1>
        <p className="mt-3 text-white/70">{t('errorDescription')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)]"
          >
            <RotateCcw className="h-4 w-4" /> {t('retry')}
          </button>
          <Link href="/" className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
            {t('backHome')}
          </Link>
        </div>
        {error.digest && <p className="mt-6 text-xs text-white/30">{error.digest}</p>}
      </div>
    </div>
  )
}

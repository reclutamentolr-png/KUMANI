import { getTranslations } from 'next-intl/server'
import { PauseCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'

// Servizio spento dallo Staff (interruttore in Admin).
// - SuspendedBanner: sola lettura (Travel, Events): si vede ciò che c'è già.
// - ServiceStopped: pagina intera per i servizi fermati del tutto (giochi).

export async function SuspendedBanner({ className = '' }: { className?: string }) {
  const t = await getTranslations('common')
  return (
    <div className={`flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 ${className}`}>
      <PauseCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-bold">{t('serviceSuspendedTitle')}</p>
        <p className="mt-0.5 text-sm">{t('serviceSuspendedReadOnly')}</p>
      </div>
    </div>
  )
}

export async function ServiceStopped() {
  const t = await getTranslations('common')
  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-16 text-center text-white">
      <div className="mx-auto max-w-md">
        <Logo size={48} className="mx-auto h-12 w-12" />
        <PauseCircle className="mx-auto mt-8 h-12 w-12 text-[var(--gold-bright)]" />
        <h1 className="mt-4 text-2xl font-bold">{t('serviceSuspendedTitle')}</h1>
        <p className="mt-2 text-sm leading-6 text-white/70">{t('serviceStoppedText')}</p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)]"
        >
          {t('backToDashboard')}
        </Link>
      </div>
    </div>
  )
}

import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'

// Pagina 404 tradotta, in stile KUMANI.
export default async function LocaleNotFound() {
  const t = await getTranslations('errorPages')
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ink)] px-4 text-white">
      <div className="w-full max-w-md text-center">
        <Logo size={48} className="mx-auto mb-6 h-12 w-12" />
        <p className="text-6xl font-bold text-[var(--gold-bright)]">404</p>
        <h1 className="mt-4 text-2xl font-bold">{t('notFoundTitle')}</h1>
        <p className="mt-3 text-white/70">{t('notFoundDescription')}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)]"
          >
            {t('backHome')}
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
            {t('goDashboard')}
          </Link>
        </div>
      </div>
    </div>
  )
}

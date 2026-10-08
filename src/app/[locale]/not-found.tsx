import { getTranslations } from 'next-intl/server'
import NotFoundActions from '@/components/NotFoundActions'
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
        <NotFoundActions backLabel={t('goBack')} homeLabel={t('backHome')} dashboardLabel={t('goDashboard')} />
      </div>
    </div>
  )
}

import { getLocale, getTranslations } from 'next-intl/server'

// Menù del QR al tavolo che non esiste o non è più attivo (risposta 404)
export default async function MenuNotFound() {
  const t = await getTranslations({ locale: await getLocale(), namespace: 'menuPublic' })
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ink)] px-6 text-center text-white">
      <p className="max-w-sm text-white/80">{t('notAvailable')}</p>
    </div>
  )
}

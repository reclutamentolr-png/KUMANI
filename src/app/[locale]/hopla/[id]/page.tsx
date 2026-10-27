import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import SiteHomeButton from '@/components/nav/SiteHomeButton'
import HoplaSender from '@/components/hopla/HoplaSender'
import { HOPLA_ID_RE } from '@/lib/hopla'

// Pagina aperta dal telefono inquadrando il codice QR di Hoplà sul PC.
// Non serve l'accesso: il codice (casuale, valido solo finché il PC tiene
// aperta la pagina) è la chiave. I file vanno direttamente al PC.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'hopla' })
  return { title: t('phoneTitle'), robots: { index: false, follow: false } }
}

export default async function HoplaPhonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!HOPLA_ID_RE.test(id)) notFound()
  const t = await getTranslations('hopla')
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="bg-[var(--ink)] px-4 pb-6 pt-5 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Logo size={36} className="h-9 w-9" />
          <div>
            <p className="text-xl font-extrabold tracking-wide text-[var(--gold-bright)]">Hoplà</p>
            <p className="text-sm text-white/75">{t('phoneTitle')}</p>
          </div>
          <SiteHomeButton className="ml-auto" />
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">
        <HoplaSender id={id} />
        <p className="mt-8 text-center text-xs leading-5 text-[var(--muted)]">{t('privacyText')}</p>
        <p className="mt-2 text-center text-xs leading-5 text-[var(--muted)]">
          {t('phoneTerms')}{' '}
          <Link href="/terms" className="font-bold text-[#7a5a14] underline-offset-2 hover:underline">
            {t('termsLink')}
          </Link>
        </p>
      </main>
    </div>
  )
}

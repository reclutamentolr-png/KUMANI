import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'
import TermsIt from './TermsIt'
import TermsEn from './TermsEn'

// Pagina uguale per tutti: preparata in anticipo per ogni lingua e rifatta
// in background (al massimo ogni ora; prima se cambiano lingue o traduzioni)
export const revalidate = 3600

type LocaleProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: LocaleProps): Promise<Metadata> {
  setRequestLocale((await params).locale)
  const t = await getTranslations('seo')
  return pageMetadata('/terms', { title: t('termsTitle'), description: t('termsDescription') })
}

const LAST_UPDATE = '27 ottobre 2026'
// Stessa data per la traduzione inglese (da aggiornare insieme a LAST_UPDATE)
const LAST_UPDATE_EN = '27 October 2026'

// Il testo italiano è quello ufficiale; per le altre lingue si mostra la
// traduzione inglese, con la nota che in caso di differenze prevale l'italiano
export default async function TermsPage({ params }: LocaleProps) {
  const { locale } = await params
  setRequestLocale(locale)
  return locale === 'it'
    ? <TermsIt lastUpdate={LAST_UPDATE} />
    : <TermsEn lastUpdate={LAST_UPDATE_EN} />
}

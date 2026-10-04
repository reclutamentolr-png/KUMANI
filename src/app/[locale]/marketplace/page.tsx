import { redirect } from 'next/navigation'
import { defaultLocale } from '../../../../i18n'

// Vecchia griglia dell'Ecosistema (layout Tipo 1): ora tutti i servizi sono
// nella pagina Servizi. L'indirizzo resta per segnalibri e link vecchi.
export default async function MarketplacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`${locale === defaultLocale ? '' : `/${locale}`}/servizi`)
}

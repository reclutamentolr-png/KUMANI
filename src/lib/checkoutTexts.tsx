import { getTranslations } from 'next-intl/server'
import type { CheckoutFormTexts } from '@/components/billing/CheckoutForm'
import { defaultLocale } from '../../i18n'

// Testi del modulo di pagamento (abbonamenti e Pass), nella lingua scelta:
// consenso all'avvio immediato, dati aziendali, accettazione di Termini e
// Privacy e, per gli abbonamenti, data e prezzo del rinnovo automatico
// scritti accanto al pulsante.
export async function getCheckoutTexts(locale: string, renewal?: { priceEuro: number; months?: number }): Promise<CheckoutFormTexts> {
  const tw = await getTranslations({ locale, namespace: 'withdrawal' })
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const link = (href: string) =>
    function TermsLink(chunks: React.ReactNode) {
      return (
        <a href={`${prefix}${href}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
          {chunks}
        </a>
      )
    }
  let renewalNote: string | undefined
  if (renewal) {
    const date = new Date()
    date.setMonth(date.getMonth() + (renewal.months ?? 12))
    renewalNote = tw('renewalNote', {
      date: date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
      price: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(renewal.priceEuro),
    })
  }
  return {
    asConsumer: tw('asConsumer'),
    asBusiness: tw('asBusiness'),
    consentLabel: tw('consentLabel'),
    consentHint: tw('consentHint'),
    businessName: tw('businessName'),
    vatNumber: tw('vatNumber'),
    vatHint: tw('vatHint'),
    businessDeclaration: tw('businessDeclaration'),
    termsLabel: tw.rich('termsAccept', { terms: link('/terms'), privacy: link('/privacy') }),
    renewalNote,
  }
}

import { redirect } from 'next/navigation'

// I dati dell'attività dei Preventivi sono diventati la «Scheda attività»
// unica, ripresa da tutti i servizi
export default async function QuoteBusinessProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/scheda-attivita?from=/marketplace/preventivi`)
}

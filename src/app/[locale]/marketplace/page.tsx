import { redirect } from 'next/navigation'

// Vecchia griglia dell'Ecosistema (layout Tipo 1): gli strumenti sono tutti
// in dashboard. L'indirizzo resta per segnalibri e link vecchi.
export default async function MarketplacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/dashboard`)
}

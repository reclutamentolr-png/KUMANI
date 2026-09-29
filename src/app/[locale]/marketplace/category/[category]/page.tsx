import { redirect } from 'next/navigation'

// Vecchie pagine per categoria (layout Tipo 1): le categorie sono in
// dashboard. L'indirizzo resta per segnalibri e link vecchi.
export default async function MarketplaceCategoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/dashboard`)
}

import { redirect } from 'next/navigation'

// Il test del campo visivo è stato sostituito da acuità visiva e griglia di
// Amsler: i vecchi link portano alla pagina di Aureya.
export default async function AureyaVisualPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/marketplace/aureya`)
}

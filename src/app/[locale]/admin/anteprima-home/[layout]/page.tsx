import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import HomeLanding from '@/components/home/HomeLanding'
import { isHomeLayout } from '@/lib/homeLayouts'

// Anteprima di un aspetto della Home (Admin → Aspetto della Home, pulsante
// "Anteprima"): stessa Home pubblica con l'aspetto scelto. Prima era
// /?layout=…, che obbligava a ricalcolare la Home a ogni visita.
export const dynamic = 'force-dynamic'

// Mai su Google
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function HomeLayoutPreviewPage({ params }: { params: Promise<{ layout: string }> }) {
  const { layout } = await params
  if (!isHomeLayout(layout)) notFound()
  return <HomeLanding layoutKey={layout} />
}

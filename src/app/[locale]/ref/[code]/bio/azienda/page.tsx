import type { Metadata } from 'next'
import { BioPublic, bioMetadata } from '../BioPublic'

// Link in Bio, pagina «azienda» (/ref/<codice>/bio/azienda): solo con il Pro.
// Sempre calcolata a ogni richiesta, come la pagina «privato»
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; code: string }> }): Promise<Metadata> {
  const { locale, code } = await params
  return bioMetadata(locale, code, 'business')
}

export default async function LinkInBioBusinessPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <BioPublic code={code} mode="business" />
}

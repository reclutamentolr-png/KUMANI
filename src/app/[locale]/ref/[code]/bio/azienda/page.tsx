import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BioPublic, bioMetadata, bioSlugFor } from '../BioPublic'

// Link in Bio, pagina «azienda» (/ref/<codice>/bio/azienda): solo con il Pro.
// Sempre calcolata a ogni richiesta, come la pagina «privato»
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; code: string }> }): Promise<Metadata> {
  const { locale, code } = await params
  return bioMetadata(locale, code, 'business')
}

export default async function LinkInBioBusinessPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params
  // Pagina con un nome scelto: si va al suo indirizzo kumani.io/bio/<nome>
  const slug = await bioSlugFor(code, 'business')
  if (slug) redirect(`${locale === 'it' ? '' : `/${locale}`}/bio/${slug}`)
  return <BioPublic code={code} mode="business" />
}

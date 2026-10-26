import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BioPublic, bioMetadata, bioSlugFor } from './BioPublic'

// Link in Bio, pagina «privato» (/ref/<codice>/bio). Dati personali, legati a
// un codice o che cambiano: sempre calcolata a ogni richiesta, mai preparata
// in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; code: string }> }): Promise<Metadata> {
  const { locale, code } = await params
  return bioMetadata(locale, code, 'personal')
}

export default async function LinkInBioPublicPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params
  // Pagina con un nome scelto: si va al suo indirizzo kumani.io/bio/<nome>
  const slug = await bioSlugFor(code, 'personal')
  if (slug) redirect(`${locale === 'it' ? '' : `/${locale}`}/bio/${slug}`)
  return <BioPublic code={code} mode="personal" />
}

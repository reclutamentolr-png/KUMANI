import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BioPublic, bioBySlug, bioMetadata } from '../../ref/[code]/bio/BioPublic'

// Link in Bio con il nome scelto: kumani.io/bio/<nome> (pagina privata o
// azienda, a seconda di quale ha quel nome). Sempre calcolata a ogni richiesta
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const page = await bioBySlug(slug.toLowerCase())
  if (!page) return { title: { absolute: 'KUMANI' } }
  return bioMetadata(locale, page.code, page.mode)
}

export default async function LinkInBioNamedPage({ params }: Props) {
  const { slug } = await params
  const page = await bioBySlug(slug.toLowerCase())
  if (!page) notFound()
  return <BioPublic code={page.code} mode={page.mode} />
}

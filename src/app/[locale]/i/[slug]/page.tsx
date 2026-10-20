import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ReferralPage from '@/app/[locale]/ref/[code]/page'
import ShareLinkOpened from '@/components/share/ShareLinkOpened'
import { INVITE_TOOL } from '@/lib/shareLinksServer'
import { createClient } from '@/lib/supabase/server'

// Dati legati al link: sempre calcolata a ogni richiesta
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Link d'invito corto di un Kumano (kumani.io/i/CODICE): la stessa pagina
// d'invito di /ref/CODICE-INVITO, con l'apertura contata per chi invita
export default async function InviteShortPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params
  if (!/^[A-Za-z2-9]{6}$/.test(slug)) notFound()
  const supabase = await createClient()
  const { data } = await supabase.rpc('share_link_info', { p_slug: slug }).maybeSingle<{ tool: string; referral_code: string }>()
  if (!data || data.tool !== INVITE_TOOL) notFound()
  return (
    <>
      <ShareLinkOpened slug={slug} />
      <ReferralPage params={Promise.resolve({ code: data.referral_code })} />
    </>
  )
}

import { createClient } from '@/lib/supabase/server'
import ToolShareButton from '@/components/ToolShareButton'
import RelatedServices from '@/components/RelatedServices'

// Layout comune del marketplace: aggiunge il pulsante "Condividi" dentro
// ogni strumento e, in fondo alla pagina principale di ogni servizio, la
// riga per scoprire gli altri servizi dello stesso gruppo (i componenti si
// mostrano solo sulle pagine degli strumenti, non su categorie, bacheca o chat).
export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let referralCode: string | null = null
  if (user) {
    const { data } = await supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null }>()
    referralCode = data?.referral_code ?? null
  }

  return (
    <>
      {children}
      {user && <RelatedServices />}
      {user && <ToolShareButton referralCode={referralCode} />}
    </>
  )
}

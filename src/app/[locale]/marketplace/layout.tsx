import { createClient } from '@/lib/supabase/server'
import ToolShareButton from '@/components/ToolShareButton'

// Layout comune del marketplace: aggiunge il pulsante "Condividi" dentro
// ogni strumento (il componente si mostra solo sulle pagine degli
// strumenti, non su categorie, bacheca o chat).
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
      {user && <ToolShareButton referralCode={referralCode} />}
    </>
  )
}

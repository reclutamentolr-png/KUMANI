import { createClient } from '@/lib/supabase/server'
import ToolShareButton from '@/components/ToolShareButton'
import RelatedServices from '@/components/RelatedServices'
import GuestTrialBar from '@/components/trials/GuestTrialBar'
import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { guestTrial } from '@/lib/trials'

// Layout comune del marketplace: aggiunge il pulsante "Condividi" dentro
// ogni strumento e, in fondo alla pagina principale di ogni servizio, la
// riga per scoprire gli altri servizi dello stesso gruppo (i componenti si
// mostrano solo sulle pagine degli strumenti, non su categorie, bacheca o chat).
export default async function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Ospite in prova: solo il servizio, senza condivisione, scaricamenti né
  // link verso il resto del sito (nascosti qui con una regola sola), più la
  // barra con il tempo che resta e «Crea il tuo account»
  const trial = guestTrial(user)
  if (trial) {
    const tm = await getTranslations('marketplace')
    const title = getMarketplaceTools(tm).find((t) => t.toolName === trial.tool)?.title ?? trial.tool
    const tool = trial.tool.replace(/[^a-z0-9-]/g, '')
    const hide = [
      '[data-guest-hide]',
      'a[download]',
      'a[href^="https://wa.me/?"]',
      'a[href$="/dashboard"]',
      'a[href*="/dashboard?"]',
      'a[href$="/wallet"]',
      'a[href$="/servizi"]',
      'a[href$="/community"]',
      'a[href*="/pass/"]',
      'a[href$="/pro"]',
      'a[href*="/pro?"]',
      `a[href*="/marketplace/"]:not([href*="/marketplace/${tool}"])`,
      '[data-tool-share]',
    ].join(',')
    return (
      <>
        <style>{`${hide}{display:none!important}`}</style>
        {children}
        <GuestTrialBar toolTitle={title} until={trial.until} />
      </>
    )
  }

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

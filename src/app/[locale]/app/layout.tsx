import { createClient } from '@/lib/supabase/server'
import ToolShareButton from '@/components/ToolShareButton'
import ToolReviewButton from '@/components/ToolReviewButton'
import RelatedServices from '@/components/RelatedServices'
import GuestTrialBar from '@/components/trials/GuestTrialBar'
import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { guestTrial } from '@/lib/trials'
import { getServiceVideos } from '@/lib/serviceVideos'
import { getStaffPreviewTools } from '@/lib/freeTools'
import StaffPreviewBanner from '@/components/StaffPreviewBanner'
import { getMyReviewOptions } from '@/app/actions/reviews'

// Layout comune del marketplace: aggiunge i pulsanti "Condividi" e
// "Recensisci" dentro ogni strumento e, in fondo alla pagina principale di ogni servizio, la
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
      `a[href*="/app/"]:not([href*="/app/${tool}"])`,
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
  // Servizi con il video ufficiale: dentro il servizio «Invia il video»
  let videoTools: string[] = []
  // Servizi «Solo Staff» aperti da chi è dello Staff: la fascia «Anteprima»
  let preview: { hrefs: string[]; label: string } | null = null
  // Servizi che l'utente può recensire (true = l'ha già recensito)
  const reviewSubjects: Record<string, boolean> = {}
  if (user) {
    const [{ data }, videos, previewTools, reviewOptions] = await Promise.all([
      supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null }>(),
      getServiceVideos(),
      getStaffPreviewTools(),
      getMyReviewOptions(),
    ])
    for (const option of reviewOptions) if (option.purchaseLabel || option.review) reviewSubjects[option.subject] = !!option.review
    referralCode = data?.referral_code ?? null
    videoTools = Object.keys(videos)
    if (previewTools.length) {
      const tm = await getTranslations('marketplace')
      const hrefs = getMarketplaceTools(tm).filter((tool) => previewTools.includes(tool.toolName)).map((tool) => tool.href)
      preview = { hrefs, label: tm('staffPreviewBanner') }
    }
  }

  return (
    <>
      {preview && <StaffPreviewBanner hrefs={preview.hrefs} label={preview.label} />}
      {children}
      {user && <RelatedServices />}
      {user && <ToolShareButton referralCode={referralCode} videoTools={videoTools} />}
      {user && <ToolReviewButton subjects={reviewSubjects} />}
    </>
  )
}

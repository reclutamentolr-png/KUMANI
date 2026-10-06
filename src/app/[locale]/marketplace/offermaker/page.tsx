import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import ToolBackLink from '@/components/ToolBackLink'
import { Wand2, ArrowLeft, Sparkles, ListChecks } from 'lucide-react'
import OfferMakerWizard from '@/components/OfferMakerWizard'
import { hasActiveOfferMakerAccess } from '@/lib/offermaker-server'
import { getMyBusinessProfile } from '@/lib/businessProfile-server'

export default async function OfferMakerPage() {
  const t = await getTranslations('offermaker')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveOfferMakerAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/dashboard')
  }

  const [{ data: profile }, businessProfile] = await Promise.all([
    supabase.rpc('get_my_profile').maybeSingle<{ phone: string | null }>(),
    getMyBusinessProfile(supabase, user.id),
  ])
  // WhatsApp: prima quello della Scheda attività, poi il telefono del profilo
  const initialWhatsapp = (businessProfile.whatsapp || businessProfile.phone || profile?.phone || '').slice(0, 40)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-3">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/marketplace/offermaker/campaigns"
              className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-[var(--gold-bright)] transition-colors"
            >
              <ListChecks className="w-4 h-4" />
              {t('myCampaigns')}
            </Link>
            <h1 className="flex items-center gap-2 font-semibold tracking-wide">
              <Wand2 className="h-5 w-5 text-[var(--gold-bright)]" />
              {t('title')}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-center text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-[var(--gold)]/15 text-[var(--gold-bright)] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              {t('badge')}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t('heroTitle')}</h2>
            <p className="text-white/70 max-w-2xl mx-auto text-base sm:text-lg">{t('heroDescription')}</p>
          </div>
        </div>

        <OfferMakerWizard initialWhatsapp={initialWhatsapp} businessProfile={businessProfile} />
      </main>
    </div>
  )
}

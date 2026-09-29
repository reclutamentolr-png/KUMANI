import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import ToolBackLink from '@/components/ToolBackLink'
import {
  MessageCircle, 
  ArrowLeft, 
  Sparkles,
  Users,
  TrendingUp,
  Send
} from 'lucide-react'
import WhatsAppTemplates from '@/components/WhatsAppTemplates'

// ✅ Aggiunto params per ottenere la lingua corrente
export default async function WhatsAppPage({ params }: { params: Promise<{ locale: string }> }) {
  // ✅ Ottieni la lingua dall'URL (es. 'it', 'en', 'fr')
  const { locale } = await params
  const t = await getTranslations('whatsappPage')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null; first_name: string | null; last_name: string | null }>()

  if (!profile) redirect('/dashboard')

  const baseUrl = SITE_URL
  
  // ✅ URL CORRETTO: include la lingua dinamica (es. /it/ref/CODICE)
  const referralUrl = `${baseUrl}/${locale}/ref/${profile.referral_code}`

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('back')}
          </ToolBackLink>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[var(--gold-bright)]" />
            <h1 className="font-semibold tracking-wide">{t('title')}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--gold-bright)]">
              <Sparkles className="w-4 h-4" />
              {t('badge')}
            </div>
            <h2 className="text-3xl font-bold sm:text-4xl">
              {t('heroTitle')}
            </h2>
            <p className="mt-2 text-white/70 sm:text-lg">
              {t('heroDescription')}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
            <Users className="mb-2 h-8 w-8 text-[var(--gold)]" />
            <h3 className="mb-1 font-semibold text-[var(--ink)]">{t('templatesTitle')}</h3>
            <p className="text-sm text-[var(--muted)]">{t('templatesDescription')}</p>
          </div>
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
            <Send className="mb-2 h-8 w-8 text-[var(--gold)]" />
            <h3 className="mb-1 font-semibold text-[var(--ink)]">{t('sendTitle')}</h3>
            <p className="text-sm text-[var(--muted)]">{t('sendDescription')}</p>
          </div>
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
            <TrendingUp className="mb-2 h-8 w-8 text-[var(--gold)]" />
            <h3 className="mb-1 font-semibold text-[var(--ink)]">{t('linkTitle')}</h3>
            <p className="text-sm text-[var(--muted)]">{t('linkDescription')}</p>
          </div>
        </div>

        {/* Templates Component */}
        <WhatsAppTemplates referralUrl={referralUrl} />

        {/* Tips */}
        <div className="relative mt-8 overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--ink)] to-[#292722] p-6 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full border border-[var(--gold)]/20" />
          <h3 className="relative mb-3 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('tipsTitle')}
          </h3>
          <ul className="relative space-y-2 text-sm text-white/75">
            <li className="flex items-start gap-2">
              <span className="font-bold text-[var(--gold-bright)]">•</span>
              <span>{t('tipOne')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[var(--gold-bright)]">•</span>
              <span>{t('tipTwo')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[var(--gold-bright)]">•</span>
              <span>{t('tipThree')}</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}

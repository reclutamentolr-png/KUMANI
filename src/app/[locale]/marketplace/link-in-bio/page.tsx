import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import ToolBackLink from '@/components/ToolBackLink'
import { getTranslations } from 'next-intl/server'
import LinkInBioEditor from '@/components/LinkInBioEditor'
import CopyLinkButton from '@/components/CopyLinkButton'
import {
  Link2,
  ArrowLeft,
  Sparkles,
  ExternalLink,
  AlertTriangle
} from 'lucide-react'

export default async function LinkInBioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('marketplace')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, referral_code, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  if (!profile.referral_code) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <ToolBackLink
              className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
              dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
            >
              <ArrowLeft className="w-5 h-5" /> {t('backToMarketplace')}
            </ToolBackLink>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-[var(--gold-pale)] border border-[var(--gold)]/40 rounded-2xl p-8 max-w-md text-center">
            <AlertTriangle className="w-12 h-12 text-[var(--gold)] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[var(--ink)] mb-2">{t('referralCodeMissing')}</h2>
            <p className="text-[var(--muted)] mb-6">
              {t('referralCodeNeeded')}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white rounded-lg font-semibold transition-colors"
            >
              {t('goToDashboard')}
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const baseUrl = SITE_URL
  
  const bioUrl = `${baseUrl}/${locale}/ref/${profile.referral_code}/bio`

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[var(--gold-bright)]" />
            <h1 className="font-semibold tracking-wide">{t('linkInBio')}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--gold-bright)]">
              <Sparkles className="w-4 h-4" />
              {t('linkInBioIntro')}
            </div>
            <h2 className="text-3xl font-bold sm:text-4xl">
              {t('linkInBioSubtitle')}
            </h2>
            <p className="mt-2 text-white/70 sm:text-lg">
              {t('linkInBioDesc')}
            </p>
          </div>
        </div>

        {/* Editor reale + anteprima live (la stessa istanza di stato guida
            entrambi i pannelli, quindi resta sincronizzata mentre si scrive
            e dopo il salvataggio — niente più mockup statico scollegato). */}
        <LinkInBioEditor userId={user.id} firstName={profile.first_name} lastName={profile.last_name} />

        {/* URL della Bio con pulsante copia */}
        <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 mb-8">
          <label className="block text-sm font-semibold text-[var(--ink)] mb-2">
            {t('linkInBio')} ({t('savePrompt')})
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={bioUrl}
              className="min-w-0 flex-1 bg-[var(--paper)] border border-[var(--gold)]/25 rounded-lg px-4 py-3 text-sm font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
            />
            <CopyLinkButton url={bioUrl} colorClassName="bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white" />
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-10 text-center">
          <a
            href={bioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <ExternalLink className="w-5 h-5" />
            {t('visitBio')}
          </a>
          <p className="text-sm text-[var(--muted)] mt-3">{t('savePrompt')}</p>
        </div>
      </main>
    </div>
  )
}

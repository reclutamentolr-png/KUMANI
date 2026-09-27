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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <ToolBackLink
              className="flex items-center gap-2 text-white hover:text-[var(--gold-bright)] transition-colors font-medium"
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
            <p className="text-gray-600 mb-6">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[var(--gold-pale)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <ToolBackLink
            className="flex items-center gap-2 text-white hover:text-[var(--gold-bright)] transition-colors font-medium"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[var(--gold-bright)]" />
            <h1 className="text-xl font-bold text-white">{t('linkInBio')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[var(--gold-pale)] text-[var(--ink)] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4 text-[var(--gold)]" />
            {t('linkInBioIntro')}
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-3">
            {t('linkInBioSubtitle')}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            {t('linkInBioDesc')}
          </p>
        </div>

        {/* Editor reale + anteprima live (la stessa istanza di stato guida
            entrambi i pannelli, quindi resta sincronizzata mentre si scrive
            e dopo il salvataggio — niente più mockup statico scollegato). */}
        <LinkInBioEditor userId={user.id} firstName={profile.first_name} lastName={profile.last_name} />

        {/* URL della Bio con pulsante copia */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('linkInBio')} ({t('savePrompt')})
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={bioUrl}
              className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono text-gray-700 focus:outline-none"
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
            className="inline-flex items-center gap-2 bg-[var(--gold)] hover:bg-[var(--gold-bright)] text-[var(--ink)] px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <ExternalLink className="w-5 h-5" />
            {t('visitBio')}
          </a>
          <p className="text-sm text-gray-500 mt-3">{t('savePrompt')}</p>
        </div>
      </main>
    </div>
  )
}

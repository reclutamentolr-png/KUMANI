import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, PanelsTopLeft } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import LandingEditor, { type LandingEditorInitial } from '@/components/landing/LandingEditor'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/siteUrl'
import { getLandingLabels } from '@/lib/landing-server'
import { cleanLandingContent, emptyLandingContent, isLandingLocale, isLandingTemplate, LANDING_LOCALES, slugify, type LandingLocale } from '@/lib/landing'

// Landing Page — editor del titolare (servizio Pro: l'accesso lo controlla
// il proxy con can_use_tool, e ogni azione lo ricontrolla).
export default async function LandingPageEditorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('landingEditor')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [{ data: row }, { data: profile }, { data: menu }] = await Promise.all([
    supabase.from('landing_pages').select('slug, is_published, template, accent, content_locale, content, suspended, suspended_reason').eq('owner_id', user.id).maybeSingle(),
    supabase.rpc('get_my_profile').maybeSingle<{ first_name: string | null; last_name: string | null }>(),
    supabase.from('menus').select('token, is_active').eq('owner_id', user.id).maybeSingle(),
  ])

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  const startLocale: LandingLocale = isLandingLocale(locale) ? locale : 'it'
  const initial: LandingEditorInitial = row
    ? {
        exists: true,
        slug: row.slug,
        isPublished: row.is_published,
        template: isLandingTemplate(row.template) ? row.template : 'scuro',
        accent: row.accent,
        contentLocale: isLandingLocale(row.content_locale) ? row.content_locale : startLocale,
        content: cleanLandingContent(row.content, user.id),
        suspended: row.suspended,
        suspendedReason: row.suspended_reason,
      }
    : {
        exists: false,
        slug: slugify(fullName) || `pagina-${user.id.slice(0, 6)}`,
        isPublished: false,
        template: 'scuro',
        accent: '#c79a3b',
        contentLocale: startLocale,
        content: emptyLandingContent(fullName),
        suspended: false,
        suspendedReason: null,
      }

  const labelsByLocale = Object.fromEntries(await Promise.all(LANDING_LOCALES.map(async (l) => [l, await getLandingLabels(l)])))
  const menuUrl = menu?.is_active ? `${SITE_URL.replace(/\/$/, '')}/m/${menu.token}` : null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <PanelsTopLeft className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">{t('title')}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-gray-600">{t('subtitle')}</p>
        </div>
        <LandingEditor initial={initial} siteUrl={SITE_URL} labelsByLocale={labelsByLocale} menuUrl={menuUrl} />
      </main>
    </div>
  )
}

import { localizedRedirect } from '@/lib/localizedRedirect'
import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft } from 'lucide-react'
import { hasActiveCvAccess } from '@/lib/cv-server'
import { defaultLocale } from '../../../../../../i18n'
import OfferMakerQR from '@/components/OfferMakerQR'
import CopyLinkButton from '@/components/CopyLinkButton'
import CvPdfButton from '@/components/CvPdfButton'
import CvShareButtons from '@/components/CvShareButtons'
import CvToBioButton from '@/components/ecosystem/CvToBioButton'
import CvActions from '@/components/CvActions'
import CvTemplateRenderer from '@/components/cv/CvTemplateRenderer'

export default async function CvDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { locale, id } = await params
  const { from } = await searchParams
  const backSuffix = from === 'dashboard' ? '?from=dashboard' : ''
  const t = await getTranslations('kumaniCv')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return localizedRedirect('/login')

  const hasAccess = await hasActiveCvAccess(supabase, user.id)
  if (!hasAccess) {
    return localizedRedirect('/dashboard')
  }

  const { data: cv } = await supabase.from('cvs').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!cv) notFound()

  const photoUrl = cv.photo_path ? supabase.storage.from('cv-photos').getPublicUrl(cv.photo_path).data.publicUrl : null

  const baseUrl = SITE_URL
  const publicUrl = locale === defaultLocale ? `${baseUrl}/cv/${cv.code}` : `${baseUrl}/${locale}/cv/${cv.code}`

  const previewData = {
    fullName: cv.full_name,
    roleTitle: cv.role_title,
    summary: cv.summary,
    email: cv.email,
    phone: cv.phone,
    location: cv.location,
    photoUrl,
    links: cv.links || [],
    experiences: cv.experiences || [],
    education: cv.education || [],
    skills: cv.skills || [],
    languages: cv.languages || [],
    certifications: cv.certifications || [],
    contentLanguage: cv.content_language,
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href={`/marketplace/kumani-cv${backSuffix}`}
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="font-semibold tracking-wide truncate max-w-[50%] sm:max-w-xs">{cv.title}</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            <div className="sm:col-span-2 space-y-4">
              <div>
                <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wide mb-1">{t('publicLinkLabel')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 bg-[var(--paper)] border border-[var(--gold)]/25 rounded-lg px-3 py-2 text-sm text-[var(--ink)] break-all">
                    {publicUrl}
                  </code>
                  <CopyLinkButton url={publicUrl} />
                </div>
              </div>
              <p className="text-sm text-[var(--muted)]">{t('livingCvHint')}</p>
            </div>

            <div className="flex justify-center">
              <OfferMakerQR
                url={publicUrl}
                fileName={`cv-${cv.code}`}
                generatingLabel={t('generatingQr')}
                downloadLabel={t('downloadQr')}
                accentClassName="bg-[var(--ink)] hover:bg-[var(--ink-soft)]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <CvPdfButton cv={cv} photoUrl={photoUrl} publicUrl={publicUrl} />
            <CvToBioButton publicUrl={publicUrl} />
            <CvActions id={cv.id} />
          </div>
          <CvShareButtons cv={cv} photoUrl={photoUrl} publicUrl={publicUrl} />
        </div>

        <div className="bg-[var(--paper)] rounded-2xl border border-[var(--gold)]/25 shadow-sm overflow-hidden">
          <CvTemplateRenderer template={cv.template} cv={previewData} />
        </div>
      </main>
    </div>
  )
}

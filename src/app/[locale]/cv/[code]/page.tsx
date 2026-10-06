import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { Crown } from 'lucide-react'
import CvTemplateRenderer from '@/components/cv/CvTemplateRenderer'
import type { CvTemplate, CvLink, CvExperience, CvEducation, CvSkill, CvLanguage, CvCertification } from '@/lib/cv'
import PublicPageOffline from '@/components/PublicPageOffline'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

interface PublicCvRow {
  code: string
  title: string
  template: CvTemplate
  content_language: string
  full_name: string
  role_title: string | null
  summary: string | null
  email: string | null
  phone: string | null
  location: string | null
  photo_path: string | null
  links: CvLink[]
  experiences: CvExperience[]
  education: CvEducation[]
  skills: CvSkill[]
  languages: CvLanguage[]
  certifications: CvCertification[]
  updated_at: string
}

export default async function CvPublicPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const t = await getTranslations('kumaniCv')

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_cv_by_code', { p_code: code }).single<PublicCvRow>()

  if (error || !data) {
    // Esiste ma il titolare non ha più il piano: "non disponibile"
    const { data: status } = await supabase.rpc('public_page_status', { p_kind: 'cv', p_code: code })
    if (status === 'offline') return <PublicPageOffline kind="profile" />
    notFound()
  }

  const photoUrl = data.photo_path
    ? supabase.storage.from('cv-photos').getPublicUrl(data.photo_path).data.publicUrl
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-[var(--gold-pale)] py-8 px-4">
      <div className="max-w-3xl mx-auto rounded-2xl shadow-xl border border-gray-200 overflow-hidden bg-white">
        <CvTemplateRenderer
          template={data.template}
          cv={{
            fullName: data.full_name,
            roleTitle: data.role_title,
            summary: data.summary,
            email: data.email,
            phone: data.phone,
            location: data.location,
            photoUrl,
            links: data.links || [],
            experiences: data.experiences || [],
            education: data.education || [],
            skills: data.skills || [],
            languages: data.languages || [],
            certifications: data.certifications || [],
            contentLanguage: data.content_language,
          }}
        />
      </div>

      <div className="max-w-3xl mx-auto mt-4 flex items-center justify-center">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--gold)] transition-colors"
        >
          <Crown className="h-3.5 w-3.5" />
          {t('publicFooterBadge')}
        </Link>
      </div>
    </div>
  )
}

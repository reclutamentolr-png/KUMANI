import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, FileUser } from 'lucide-react'
import { hasActiveCvAccess } from '@/lib/cv-server'
import CvForm from '@/components/CvForm'
import type { CvFormData } from '@/lib/cv'

export default async function EditCvPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const backSuffix = from === 'dashboard' ? '?from=dashboard' : ''
  const t = await getTranslations('kumaniCv')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveCvAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/marketplace')
  }

  const { data: cv } = await supabase.from('cvs').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!cv) notFound()

  const photoUrl = cv.photo_path ? supabase.storage.from('cv-photos').getPublicUrl(cv.photo_path).data.publicUrl : null

  const initialData: CvFormData = {
    title: cv.title,
    template: cv.template,
    contentLanguage: cv.content_language,
    fullName: cv.full_name,
    roleTitle: cv.role_title || '',
    summary: cv.summary || '',
    email: cv.email || '',
    phone: cv.phone || '',
    location: cv.location || '',
    links: cv.links?.length ? cv.links : [],
    experiences: cv.experiences?.length ? cv.experiences : [],
    education: cv.education?.length ? cv.education : [],
    skills: cv.skills?.length ? cv.skills : [],
    languages: cv.languages?.length ? cv.languages : [],
    certifications: cv.certifications?.length ? cv.certifications : [],
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href={`/marketplace/kumani-cv/${id}${backSuffix}`}
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {cv.title}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <FileUser className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('editCv')}
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <CvForm mode="edit" cvId={cv.id} initialData={initialData} initialPhotoUrl={photoUrl} />
      </main>
    </div>
  )
}

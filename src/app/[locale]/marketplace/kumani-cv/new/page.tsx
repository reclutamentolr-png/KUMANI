import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, FileUser } from 'lucide-react'
import { hasActiveCvAccess } from '@/lib/cv-server'
import CvForm from '@/components/CvForm'
import { emptyCvForm } from '@/lib/cv'
import { isGuestUser } from '@/lib/trials'

export default async function NewCvPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const t = await getTranslations('kumaniCv')
  const { from } = await searchParams
  const backSuffix = from === 'dashboard' ? '?from=dashboard' : ''

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveCvAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/dashboard')
  }

  // Un solo CV per persona: chi ce l'ha già va a modificarlo
  const { data: existing } = await supabase.from('cvs').select('id').eq('user_id', user.id).limit(1).maybeSingle()
  if (existing) redirect(`/marketplace/kumani-cv/${existing.id}/edit${backSuffix}`)

  // CV nuovo già compilato con i dati del profilo (non per l'ospite in prova:
  // il suo profilo è tecnico, senza dati veri)
  const guest = isGuestUser(user)
  const { data: profile } = await supabase
    .rpc('get_my_profile')
    .maybeSingle<{ first_name: string | null; last_name: string | null; email: string | null; phone: string | null; city: string | null; province: string | null; occupation: string | null }>()
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  const location = [profile?.city, profile?.province ? `(${profile.province})` : ''].filter(Boolean).join(' ').trim()
  const initialData = guest
    ? emptyCvForm()
    : {
        ...emptyCvForm(),
        fullName,
        roleTitle: profile?.occupation ?? '',
        email: profile?.email ?? user.email ?? '',
        phone: profile?.phone ?? '',
        location,
      }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href={`/marketplace/kumani-cv${backSuffix}`}
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <FileUser className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('newCv')}
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {!guest && (fullName || initialData.email) && (
          <p className="mb-6 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">{t('prefilledFromProfile')}</p>
        )}
        <CvForm mode="create" initialData={initialData} />
      </main>
    </div>
  )
}

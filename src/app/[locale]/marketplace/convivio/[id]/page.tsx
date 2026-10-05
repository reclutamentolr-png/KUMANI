import { SITE_URL } from '@/lib/siteUrl'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, HandPlatter } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ConvivioDetailView from '@/components/convivio/ConvivioDetailView'
import { getConvivio } from '@/app/actions/convivio'
import { getShowcaseInfo } from '@/app/actions/kordataShowcase'
import { createClient } from '@/lib/supabase/server'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

export default async function ConvivioDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const t = await getTranslations('convivio')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const [detail, { data: me }, { data: photo }, showcase] = await Promise.all([
    getConvivio(id),
    supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null }>(),
    supabase.rpc('convivio_photo', { p_group: id }),
    getShowcaseInfo(id),
  ])
  if (!detail) notFound()

  const online = await isToolOnline('convivio')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/marketplace/convivio" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backToList')}
          </Link>
          <div className="flex items-center gap-2">
            <HandPlatter className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">Kordata</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!online && <SuspendedBanner className="mb-6" />}
        <ConvivioDetailView initial={detail} siteUrl={SITE_URL} myReferral={me?.referral_code ?? null} photoPath={(photo as string | null) ?? null} showcase={showcase} />
      </main>
    </div>
  )
}

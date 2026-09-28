import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Plane } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import TravelWorkspace from '@/components/travel/TravelWorkspace'
import { getTripBundle } from '@/app/actions/travel'
import { todayKey } from '@/lib/agenda'
import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// Scheda di un viaggio: solo per i membri (trip_detail restituisce null agli altri).
export default async function TripPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const t = await getTranslations('travel')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const [bundle, { data: me }, { data: lifeCalendar }] = await Promise.all([
    getTripBundle(id),
    supabase.from('profiles').select('referral_code').eq('id', user.id).maybeSingle(),
    supabase.rpc('can_use_tool', { p_tool: 'life-calendar' }).maybeSingle<{ allowed: boolean }>(),
  ])
  if (!bundle) notFound()
  const online = await isToolOnline('travel')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/viaggi" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backToTrips')}
          </Link>
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">KUMANI Travel</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        {!online && <SuspendedBanner className="mb-6" />}
        <TravelWorkspace initial={bundle} today={todayKey()} siteUrl={SITE_URL} myReferral={me?.referral_code ?? null} myUserId={user.id} hasLifeCalendar={!!lifeCalendar?.allowed} />
      </main>
    </div>
  )
}

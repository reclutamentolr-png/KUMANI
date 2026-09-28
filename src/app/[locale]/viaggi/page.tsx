import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Plane } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import TravelHome from '@/components/travel/TravelHome'
import { listTrips } from '@/app/actions/travel'
import { todayKey } from '@/lib/agenda'
import { createClient } from '@/lib/supabase/server'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// KUMANI Travel: i miei viaggi. Fuori da /marketplace di proposito: chi è
// stato invitato entra anche senza abbonamento; solo creare un viaggio
// richiede il piano (controllato da trip_create).
export default async function TravelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('travel')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [trips, { data: access }] = await Promise.all([
    listTrips(),
    supabase.rpc('can_use_tool', { p_tool: 'travel' }).maybeSingle<{ allowed: boolean }>(),
  ])

  const online = await isToolOnline('travel')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">KUMANI Travel</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">{t('title')}</h1>
          <p className="mt-2 text-lg font-semibold text-[var(--gold)]">{t('tagline')}</p>
          <p className="mt-2 text-[var(--muted)]">{t('intro')}</p>
        </div>
        {!online && <SuspendedBanner className="mb-6" />}
        <TravelHome trips={trips} canCreate={online && !!access?.allowed} today={todayKey()} />
      </main>
    </div>
  )
}

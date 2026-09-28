import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, CalendarHeart } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import OrganizerHome from '@/components/events/OrganizerHome'
import { getOrganizerStatus, listMyFees, listMyOrganized, listMyPasses } from '@/app/actions/events'
import { markEventFeesPaid } from '@/lib/eventFees'
import { createClient } from '@/lib/supabase/server'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// KUMANI Events: area personale. Organizzatore (verifica, commissioni, i miei
// eventi, iscritti e check-in) e partecipante (i miei pass).
export default async function EventsMyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ fee_session?: string; fee?: string; event?: string }>
}) {
  const { locale } = await params
  const query = await searchParams
  const t = await getTranslations('eventsOrganizer')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // Ritorno dal pagamento delle commissioni: le segniamo pagate subito (il
  // webhook fa lo stesso, questa è la riserva se arriva in ritardo).
  let notice: 'paid' | 'pending' | 'canceled' | 'error' | 'none' | null = null
  if (query.fee_session && /^cs_[A-Za-z0-9_]+$/.test(query.fee_session)) {
    try {
      notice = (await markEventFeesPaid(query.fee_session, user.id)) ? 'paid' : 'pending'
    } catch (err) {
      console.error('[Events] mark fees paid failed:', err instanceof Error ? err.message : err)
      notice = 'pending'
    }
  } else if (query.fee === 'canceled' || query.fee === 'error' || query.fee === 'none') {
    notice = query.fee
  }

  const [status, organized, passes, fees] = await Promise.all([getOrganizerStatus(), listMyOrganized(), listMyPasses(), listMyFees()])

  const online = await isToolOnline('events')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/events" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backToEvents')}
          </Link>
          <div className="flex items-center gap-2">
            <CalendarHeart className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">KUMANI Events</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">{t('title')}</h1>
          <p className="mt-2 text-[var(--muted)]">{t('intro')}</p>
        </div>
        {!online && <SuspendedBanner className="mb-6" />}
        <OrganizerHome
          status={status}
          organized={organized}
          passes={passes}
          fees={fees}
          notice={notice}
          openEventId={typeof query.event === 'string' ? query.event : null}
        />
      </main>
    </div>
  )
}

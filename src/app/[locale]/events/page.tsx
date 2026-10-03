import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, CalendarHeart, CalendarPlus, Ticket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import EventsCalendar from '@/components/events/EventsCalendar'
import { listEvents } from '@/app/actions/events'
import { createClient } from '@/lib/supabase/server'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('events')
  return pageMetadata('/events', { title: { absolute: `KUMANI Events · ${t('tagline')}` }, description: t('heroText') })
}

// KUMANI Events: calendario pubblico degli eventi della community. Si vede
// anche senza account (event_list è concessa ad anon); per partecipare serve
// registrarsi.
export default async function EventsPage() {
  const t = await getTranslations('events')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const [
    events,
    {
      data: { user },
    },
  ] = await Promise.all([listEvents(), supabase.auth.getUser()])
  const loggedIn = !!user

  const online = await isToolOnline('events')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href={loggedIn ? '/dashboard' : '/'} className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {loggedIn ? commonT('backToDashboard') : t('backHome')}
          </Link>
          <div className="flex items-center gap-2">
            <CalendarHeart className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">KUMANI Events</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[var(--ink)] text-white">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:pb-14 sm:pt-12">
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">KUMANI Events</h1>
          <p className="mt-2 text-xl font-semibold text-[var(--gold-bright)] sm:text-2xl">{t('tagline')}</p>
          <p className="mt-3 max-w-2xl text-lg text-[var(--gold-pale)]">{t('heroSubtitle')}</p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">{t('heroText')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={loggedIn ? '/events/my' : '/register'}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)]"
            >
              <CalendarPlus className="h-5 w-5" /> {t('organizeEvent')}
            </Link>
            {loggedIn && (
              <Link href="/events/my#passes" className="flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:border-[var(--gold-bright)]">
                <Ticket className="h-5 w-5" /> {t('myPasses')}
              </Link>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {!online && <SuspendedBanner className="mb-6" />}
        <EventsCalendar events={events} loggedIn={loggedIn} />
      </main>
    </div>
  )
}

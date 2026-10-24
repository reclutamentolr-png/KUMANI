import { getTranslations } from 'next-intl/server'
import { ArrowLeft, CalendarCheck } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import HubBar from '@/components/hubs/HubBar'
import TempusApp from '@/components/tempus/TempusApp'
import { createClient } from '@/lib/supabase/server'
import { toolMetadata } from '@/lib/toolMetadata'
import { SITE_URL } from '@/lib/siteUrl'
import { slugify } from '@/lib/landing'
import { mondayOf, todayIn, addDays, type TempusBooking, type TempusClosure, type TempusService } from '@/lib/tempus'
import { zonedToUtc } from '@/lib/events'
import { BOOKING_COLUMNS, loadBusiness, SERVICE_COLUMNS, SETTINGS_COLUMNS, settingsFromRow } from '@/lib/tempus-server'

export const generateMetadata = toolMetadata('tempus')

// KUMANI TEMPUS (piano Pro): agenda, servizi, orari e pagina di prenotazione.
// La pagina è protetta dal proxy come gli altri strumenti; i dati arrivano
// dal database con le regole del titolare (solo i propri).
export default async function TempusPage() {
  const [t, tm, tc] = await Promise.all([getTranslations('tempus'), getTranslations('marketplace'), getTranslations('common')])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ data: page }, { data: services }, business] = await Promise.all([
    supabase.from('tempus_pages').select(SETTINGS_COLUMNS).maybeSingle(),
    supabase.from('tempus_services').select(SERVICE_COLUMNS).order('sort').order('created_at'),
    loadBusiness(user!.id),
  ])
  const settings = page ? settingsFromRow(page as Record<string, unknown>) : null
  const tz = settings?.timezone ?? 'Europe/Rome'
  const today = todayIn(tz)
  const monday = mondayOf(today)
  const [{ data: closures }, { data: bookings }] = settings
    ? await Promise.all([
        supabase.from('tempus_closures').select('id, starts_on, ends_on, note').gte('ends_on', today).order('starts_on'),
        supabase
          .from('tempus_bookings')
          .select(BOOKING_COLUMNS)
          .gte('starts_at', zonedToUtc(monday, '00:00', tz))
          .lt('starts_at', zonedToUtc(addDays(monday, 7), '00:00', tz))
          .order('starts_at'),
      ])
    : [{ data: [] }, { data: [] }]

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            label={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToServices')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {tm('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <CalendarCheck className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            {tm('tempus')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--ink)] to-[#2a2216] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <CalendarCheck className="h-4 w-4" />
              {t('badge')}
            </div>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/70 sm:text-lg">{t('heroText')}</p>
            <p className="mt-4 text-sm font-semibold italic text-[var(--gold-bright)]">{t('motto')}</p>
          </div>
        </div>

        <TempusApp
          initialSettings={settings}
          initialServices={(services ?? []) as TempusService[]}
          initialClosures={(closures ?? []) as TempusClosure[]}
          initialBookings={(bookings ?? []) as TempusBooking[]}
          initialWeek={monday}
          suggestedSlug={slugify(business.name) || ''}
          businessName={business.name}
          publicBase={`${SITE_URL}/prenota/`}
        />
      </main>
    </div>
  )
}

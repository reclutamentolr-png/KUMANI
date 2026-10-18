import { notFound, redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, CalendarDays, HandCoins, MapPin, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import HubBar from '@/components/hubs/HubBar'
import ConviviumOwnerPanel from '@/components/convivium/ConviviumOwnerPanel'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/siteUrl'
import { OccasionTile } from '@/components/convivium/OccasionIcon'
import { OCCASION_EMOJI, formatCost, formatWhen, invitePath, mapsHref, seated, type ConviviumEvent, type ConviviumRsvp } from '@/lib/convivium'

export const dynamic = 'force-dynamic'

// La serata vista da chi la organizza: link da mandare e risposte
export default async function ConviviumEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const locale = await getLocale()
  const t = await getTranslations('convivium')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/convivium/${id}`)}`)

  const [{ data: event }, { data: rsvps }] = await Promise.all([
    supabase.from('convivium_events').select('*').eq('id', id).maybeSingle<ConviviumEvent>(),
    supabase.from('convivium_rsvps').select('id, name, answer, user_id, created_at, updated_at').eq('event_id', id).order('created_at'),
  ])
  if (!event) notFound()

  const list = (rsvps ?? []) as ConviviumRsvp[]
  const yes = seated(list.filter((r) => r.answer === 'yes').length, event.host_joins)
  const when = formatWhen(event.starts_at, locale)
  const inviteUrl = `${SITE_URL}${locale === 'it' ? '' : `/${locale}`}${invitePath(event.invite_code)}`
  const shareText = t('shareText', { emoji: OCCASION_EMOJI[event.occasion], title: event.title, when })
  const maps = mapsHref(event.maps_url)
  const { data: me } = await supabase.from('profiles').select('first_name').eq('id', user.id).maybeSingle()
  const hostName = (me?.first_name as string | null) ?? null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Link href="/convivium" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('back')}
          </Link>
        </div>
      </header>
      <HubBar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <OccasionTile occasion={event.occasion} size="md" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{t(`occasion_${event.occasion}`)}</p>
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold text-[var(--ink)]">
                {event.title}
                {event.cancelled_at && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-sm font-bold text-red-700">{t('cancelledBadge')}</span>}
              </h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" aria-hidden /> {when}
                </span>
                {event.place && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" aria-hidden />
                    {maps ? (
                      <a href={maps} target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--gold)]/50 underline-offset-2">
                        {event.place}
                      </a>
                    ) : (
                      event.place
                    )}
                  </span>
                )}
                {event.cost_cents != null && (
                  <span className="flex items-center gap-1">
                    <HandCoins className="h-4 w-4" aria-hidden />
                    {event.cost_cents === 0 ? t('costOfferedNoName') : t('costPerPerson', { amount: formatCost(event.cost_cents, locale) })}
                    {event.cost_note && <span className="text-[var(--muted)]">· {event.cost_note}</span>}
                  </span>
                )}
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <Users className="h-4 w-4" aria-hidden /> {event.max_guests ? t('seats', { yes, max: event.max_guests }) : t('yesCount', { count: yes })}
                </span>
              </div>
              {event.note && <p className="mt-3 whitespace-pre-line text-[var(--ink)]">{event.note}</p>}
            </div>
          </div>
        </section>
        <ConviviumOwnerPanel event={event} rsvps={list} hostName={hostName} inviteUrl={inviteUrl} shareText={shareText} />
      </main>
    </div>
  )
}

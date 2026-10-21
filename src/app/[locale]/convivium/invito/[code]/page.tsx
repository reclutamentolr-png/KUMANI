import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { CalendarDays, CalendarPlus, HandCoins, MapPin, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import ConviviumRsvp from '@/components/convivium/ConviviumRsvp'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { createClient } from '@/lib/supabase/server'
import { isToolOnline } from '@/lib/toolOnline'
import { OccasionTile } from '@/components/convivium/OccasionIcon'
import { OCCASION_EMOJI, formatCost, formatWhen, inviteCodeOk, mapsHref, rsvpCookie, seated, type ConviviumPublic } from '@/lib/convivium'

// Dati che cambiano a ogni risposta: sempre calcolata a ogni richiesta
export const dynamic = 'force-dynamic'

// «12 € a testa · aperitivo + tagliere» oppure «Offre Marco»
function costLabel(event: ConviviumPublic, t: (key: string, values?: Record<string, string>) => string, locale: string): string | null {
  if (event.cost_cents == null) return null
  const main = event.cost_cents === 0 ? (event.host_name ? t('costOffered', { name: event.host_name }) : t('costOfferedNoName')) : t('costPerPerson', { amount: formatCost(event.cost_cents, locale) })
  return event.cost_note ? `${main} · ${event.cost_note}` : main
}

async function load(code: string) {
  const normalized = code.trim().toUpperCase()
  if (!inviteCodeOk(normalized)) return null
  const token = (await cookies()).get(rsvpCookie(normalized))?.value ?? null
  const supabase = await createClient()
  const { data } = await supabase.rpc('convivium_public', { p_code: normalized, p_token: token })
  return { supabase, event: data as ConviviumPublic | null }
}

// Anteprima del link su WhatsApp: cosa, quando e chi invita (mai indicizzata)
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const loaded = await load(code)
  const event = loaded?.event
  if (!event) return { robots: { index: false, follow: false } }
  const t = await getTranslations('convivium')
  const locale = await getLocale()
  const title = `${OCCASION_EMOJI[event.occasion]} ${event.title}`
  const description = [formatWhen(event.starts_at, locale), event.place, costLabel(event, t, locale), t('question')].filter(Boolean).join(' · ')
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, siteName: 'KUMANI Convivium' } }
}

// Pagina del link d'invito: si risponde senza registrarsi; in fondo l'invito
// a entrare in KUMANI con il codice di chi organizza
export default async function ConviviumInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const loaded = await load(code)
  if (!loaded?.event) notFound()
  const { supabase, event } = loaded
  const t = await getTranslations('convivium')
  const locale = await getLocale()
  const [online, { data: auth }] = await Promise.all([isToolOnline('convivium'), supabase.auth.getUser()])
  let myName = ''
  if (auth.user) {
    const { data: me } = await supabase.from('profiles').select('first_name').eq('id', auth.user.id).maybeSingle()
    myName = (me?.first_name as string | null) ?? ''
  }

  const maps = mapsHref(event.maps_url)
  const atTable = seated(event.yes, event.host_joins)
  const full = !!event.max_guests && atTable >= event.max_guests
  const shown = event.yes_names.slice(0, 24)
  const sponsor = event.host_referral
  const cost = costLabel(event, t, locale)

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-10 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Logo size={40} className="h-10 w-10" />
          <span className="text-sm font-bold tracking-[0.3em] text-[var(--gold-bright)]">KUMANI CONVIVIUM</span>
        </Link>

        <div className="rounded-3xl border border-[var(--gold)]/25 bg-white/[0.04] p-6 text-center">
          <OccasionTile occasion={event.occasion} size="lg" className="mx-auto" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
            {event.host_name ? t('inviteEyebrow', { name: event.host_name }) : t('inviteEyebrowNoName')}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">{event.title}</h1>
          <div className="mt-4 space-y-1.5 text-white/80">
            <p className="flex items-center justify-center gap-2">
              <CalendarDays className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden /> <span className="first-letter:uppercase">{formatWhen(event.starts_at, locale)}</span>
            </p>
            {event.place && (
              <p className="flex items-center justify-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden />
                {maps ? (
                  <a href={maps} target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--gold)]/60 underline-offset-2">
                    {event.place}
                  </a>
                ) : (
                  event.place
                )}
              </p>
            )}
          </div>
          {cost && (
            <p className="mx-auto mt-4 flex w-fit max-w-full items-center gap-2 rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-4 py-2 text-sm font-bold text-[var(--gold-bright)]">
              <HandCoins className="h-4 w-4 shrink-0" aria-hidden /> <span>{cost}</span>
            </p>
          )}
          {event.note && <p className="mx-auto mt-4 max-w-sm whitespace-pre-line rounded-2xl bg-white/[0.06] px-4 py-3 text-sm italic text-white/85">«{event.note}»</p>}

          {/* Il tavolo che si riempie */}
          <div className="mt-6 rounded-2xl bg-white/[0.06] p-4">
            <p className="flex items-center justify-center gap-2 text-sm font-bold text-[var(--gold-bright)]">
              <Users className="h-4 w-4" aria-hidden />
              {event.max_guests ? t('seats', { yes: atTable, max: event.max_guests }) : t('yesCount', { count: atTable })}
              {event.maybe > 0 && <span className="font-semibold text-white/60">· {t('maybeCount', { count: event.maybe })}</span>}
            </p>
            {(shown.length > 0 || event.host_joins) && (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {event.host_joins && (
                  <li className="flex items-center gap-1 rounded-full border border-[var(--gold)]/60 bg-[var(--gold)]/25 px-2.5 py-1 text-xs font-bold">
                    {event.host_name ?? t('hostTag')} <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gold-bright)]">· {t('hostTag')}</span>
                  </li>
                )}
                {shown.map((name, i) => (
                  <li key={`${name}-${i}`} className="rounded-full bg-[var(--gold)]/20 px-2.5 py-1 text-xs font-semibold">
                    {name}
                  </li>
                ))}
                {event.yes > shown.length && <li className="px-1 py-1 text-xs text-white/60">{t('andMore', { count: event.yes - shown.length })}</li>}
              </ul>
            )}
          </div>

          {event.cancelled ? (
            <p className="mt-6 rounded-xl bg-red-500/15 px-4 py-3 font-semibold text-red-200">{t('cancelledText')}</p>
          ) : event.closed ? (
            <p className="mt-6 rounded-xl bg-white/10 px-4 py-3 font-semibold text-white/80">{t('closedText')}</p>
          ) : !online ? (
            <SuspendedBanner className="mt-6 text-left" />
          ) : event.is_owner ? (
            <div className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-sm">
              <p>{t('ownerText')}</p>
              <Link href="/convivium" className="mt-2 inline-block font-bold text-[var(--gold-bright)] underline">
                {t('ownerLink')}
              </Link>
            </div>
          ) : (
            <>
              <ConviviumRsvp code={event.code} initialName={myName} mine={event.mine} full={full} />
              <a
                href={`/api/convivium/ics/${event.code}`}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/75 underline decoration-white/30 underline-offset-2 hover:text-white"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden /> {t('addCalendar')}
              </a>
            </>
          )}
        </div>

        {/* Invito a entrare in KUMANI (con il codice di chi organizza) */}
        {!auth.user && (
          <div className="mt-6 rounded-3xl border border-[var(--gold)]/30 bg-gradient-to-br from-[#2a2112] to-[var(--ink)] p-6 text-center">
            <p className="text-lg font-extrabold">{t('ctaTitle')}</p>
            <p className="mt-2 text-sm text-white/75">{t('ctaText')}</p>
            <Link
              href={sponsor ? `/register?invito=${encodeURIComponent(sponsor)}` : '/register'}
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
            >
              {t('ctaButton')}
            </Link>
            {sponsor && event.host_name && <p className="mt-3 text-xs text-white/55">{t('ctaCode', { name: event.host_name, code: sponsor })}</p>}
          </div>
        )}
        <p className="mt-6 text-center text-sm font-semibold text-[var(--gold-bright)]">{t('motto')}</p>
        <p className="mt-1 text-center text-xs text-white/40">{t('poweredBy')}</p>
      </div>
    </div>
  )
}

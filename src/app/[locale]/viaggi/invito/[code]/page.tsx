import { notFound, redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { CalendarDays, MapPin, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import JoinTripButton from '@/components/travel/JoinTripButton'
import { createClient } from '@/lib/supabase/server'
import { formatTripDates, type TripPublic } from '@/lib/travel'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

// Pagina del link di invito (condiviso su WhatsApp): cosa è il viaggio e chi
// lo organizza. Per entrare serve un account KUMANI, anche senza abbonamento;
// chi si iscrive entra nella rete di chi ha condiviso il link (?ref=).
export default async function TripInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const { code } = await params
  const { ref } = await searchParams
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z0-9]{4,12}$/.test(normalized)) notFound()
  const t = await getTranslations('travel')
  const locale = await getLocale()
  const supabase = await createClient()
  const [{ data }, { data: auth }] = await Promise.all([supabase.rpc('trip_public', { p_code: normalized }), supabase.auth.getUser()])
  const trip = data as TripPublic | null
  if (!trip) notFound()

  // Già dentro il viaggio: si va direttamente alla scheda.
  if (auth.user && trip.is_member) {
    const { data: joined } = await supabase.rpc('trip_join', { p_code: normalized })
    const id = (joined as { id?: string } | null)?.id
    if (id) redirect(`${locale === 'it' ? '' : `/${locale}`}/viaggi/${id}`)
  }

  const online = await isToolOnline('travel')
  const refCode = typeof ref === 'string' ? ref.trim().toUpperCase() : ''
  const sponsor = /^[A-Z0-9-]{3,32}$/.test(refCode) ? refCode : trip.creator_referral
  const dates = formatTripDates(trip, locale)

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-10 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Logo size={40} className="h-10 w-10" />
          <span className="text-sm font-bold tracking-[0.3em] text-[var(--gold-bright)]">KUMANI TRAVEL</span>
        </Link>
        <div className="rounded-3xl border border-[var(--gold)]/25 bg-white/[0.04] p-6 text-center">
          <p className="text-5xl">{trip.emoji}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
            {t('inviteEyebrow', { name: trip.creator_name ?? '' })}
          </p>
          <h1 className="mt-2 text-2xl font-bold">{trip.title}</h1>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-white/70">
            {trip.destination && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {trip.destination}
              </span>
            )}
            {dates && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" /> {dates}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> {t('membersCount', { count: trip.members })}
            </span>
          </div>
          <p className="mt-5 text-sm leading-6 text-white/70">{t('invitePitch')}</p>

          {!online ? (
            <SuspendedBanner className="mt-6 text-left" />
          ) : auth.user ? (
            <JoinTripButton code={normalized} />
          ) : (
            <>
              <Link
                href={sponsor ? `/register?sponsor=${encodeURIComponent(sponsor)}` : '/register'}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
              >
                {t('registerToJoin')}
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(`/viaggi/invito/${normalized}`)}`}
                className="mt-3 block text-center text-sm text-white/70 hover:text-white"
              >
                {t('alreadyMember')}
              </Link>
              <p className="mt-4 text-xs text-white/50">{t('registerThenCode', { code: trip.code })}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

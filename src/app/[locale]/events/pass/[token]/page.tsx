import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { CalendarHeart, CircleCheck, CircleX, Clock, LogIn, ShieldAlert, TriangleAlert } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { openPass } from '@/app/actions/events'
import { createClient } from '@/lib/supabase/server'

// Pagina aperta inquadrando il QR di un pass con la fotocamera del telefono.
// All'organizzatore fa subito il check-in; al titolare mostra il suo evento.
export default async function EventPassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const t = await getTranslations('events')
  const locale = await getLocale()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <Shell>
        <LogIn className="mx-auto h-12 w-12 text-[var(--gold-bright)]" />
        <h1 className="mt-4 text-2xl font-bold">{t('passLoginTitle')}</h1>
        <p className="mt-2 text-sm leading-6 text-white/70">{t('passLoginText')}</p>
        <Link
          href="/login"
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
        >
          {t('login')}
        </Link>
      </Shell>
    )
  }

  const result = await openPass(token)

  // Il titolare del pass: si va alla scheda dell'evento (dove c'è il QR).
  if (result.result === 'owner' && result.event_id) {
    redirect(`${locale === 'it' ? '' : `/${locale}`}/events/${result.event_id}`)
  }

  if (result.role !== 'organizer') {
    const notAllowed = result.result === 'not_allowed'
    return (
      <Shell>
        {notAllowed ? <ShieldAlert className="mx-auto h-12 w-12 text-amber-300" /> : <CircleX className="mx-auto h-12 w-12 text-red-400" />}
        <h1 className="mt-4 text-2xl font-bold">{notAllowed ? t('passNotAllowedTitle') : t('checkin_invalid')}</h1>
        <p className="mt-2 text-sm leading-6 text-white/70">{notAllowed ? t('passNotAllowedText') : t('checkin_invalidText')}</p>
        <Link href="/events" className="mt-6 block text-sm font-semibold text-[var(--gold-bright)] hover:underline">
          {t('allEvents')}
        </Link>
      </Shell>
    )
  }

  // Esito del check-in per l'organizzatore: verde, ambra o rosso, ben visibile.
  const outcome = (['ok', 'already', 'invalid', 'not_today'] as const).find((code) => code === result.result) ?? 'invalid'
  const style = {
    ok: { box: 'bg-emerald-500 text-white', icon: <CircleCheck className="mx-auto h-20 w-20" /> },
    already: { box: 'bg-amber-400 text-[var(--ink)]', icon: <TriangleAlert className="mx-auto h-20 w-20" /> },
    not_today: { box: 'bg-red-500 text-white', icon: <Clock className="mx-auto h-20 w-20" /> },
    invalid: { box: 'bg-red-500 text-white', icon: <CircleX className="mx-auto h-20 w-20" /> },
  }[outcome]

  return (
    <Shell>
      <div className={`rounded-3xl p-8 ${style.box}`}>
        {style.icon}
        <p className="mt-4 text-3xl font-black uppercase tracking-wide">{t(`checkin_${outcome}`)}</p>
        {result.name && <p className="mt-2 text-xl font-bold">{result.name}</p>}
        <p className="mt-2 text-sm opacity-85">{t(`checkin_${outcome}Text`)}</p>
      </div>
      <Link
        href={result.event_id ? `/events/my?event=${result.event_id}` : '/events/my'}
        className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
      >
        {t('backToMyEvents')}
      </Link>
      <p className="mt-3 text-xs text-white/50">{t('scanNextHint')}</p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/events" className="mb-8 flex items-center justify-center gap-2">
          <CalendarHeart className="h-6 w-6 text-[var(--gold-bright)]" />
          <span className="text-sm font-bold tracking-[0.3em] text-[var(--gold-bright)]">KUMANI EVENTS</span>
        </Link>
        <div className="text-center">{children}</div>
      </div>
    </div>
  )
}

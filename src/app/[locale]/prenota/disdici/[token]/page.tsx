import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { CalendarCheck, Phone } from 'lucide-react'
import TempusCancelButton from '@/components/tempus/TempusCancelButton'
import { loadBusiness, tempusDb } from '@/lib/tempus-server'
import { canCancelOnline, formatWhen, isPast, phoneDigits } from '@/lib/tempus'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: { absolute: 'KUMANI TEMPUS' }, robots: { index: false, follow: false, nocache: true } }

type Props = { params: Promise<{ token: string }> }

// La prenotazione vista dal cliente con il suo link personale: data, ora,
// servizio e il pulsante per disdire (fino al limite deciso dall'attività).
export default async function TempusManagePage({ params }: Props) {
  const { token } = await params
  if (!/^[a-f0-9]{36,64}$/.test(token)) notFound()
  const db = tempusDb()
  const { data: b } = await db.from('tempus_bookings').select('owner_id, service_name, starts_at, status, cancelled_by').eq('cancel_token', token).maybeSingle()
  if (!b) notFound()
  const [{ data: page }, business, t, locale] = await Promise.all([
    db.from('tempus_pages').select('title, slug, timezone, cancel_limit_hours').eq('owner_id', b.owner_id).maybeSingle(),
    loadBusiness(b.owner_id as string),
    getTranslations('tempus'),
    getLocale(),
  ])
  const name = page?.title || business.name || page?.slug || ''
  const tz = page?.timezone ?? 'Europe/Rome'
  const startsAt = b.starts_at as string
  const past = isPast(startsAt)
  const canCancel = b.status === 'confirmed' && canCancelOnline(startsAt, page?.cancel_limit_hours ?? 0)
  const phone = business.phone || business.whatsapp

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-[var(--gold)]/25 bg-white p-6 text-center shadow-sm">
        <CalendarCheck className="mx-auto h-12 w-12 text-[var(--gold)]" />
        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{t('manageKicker')}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[var(--ink)]">{name}</h1>
        <p className="mt-4 rounded-2xl bg-[var(--gold-pale)] px-4 py-3 font-bold capitalize text-[var(--ink)]">
          {b.service_name as string}
          <br />
          {formatWhen(startsAt, tz, locale)}
        </p>
        {b.status === 'cancelled' ? (
          <p className="mt-4 font-semibold text-red-700">{b.cancelled_by === 'owner' ? t('manageCancelledByOwner') : t('manageCancelled')}</p>
        ) : past ? (
          <p className="mt-4 text-[var(--muted)]">{t('managePast')}</p>
        ) : canCancel ? (
          <TempusCancelButton token={token} />
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">{t('manageTooLate', { hours: page?.cancel_limit_hours ?? 0 })}</p>
        )}
        {phone && !past && (
          <a href={`tel:${phoneDigits(phone)}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink)] hover:underline">
            <Phone className="h-4 w-4" /> {t('callBusiness', { phone })}
          </a>
        )}
      </div>
    </div>
  )
}

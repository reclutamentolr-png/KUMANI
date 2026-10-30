import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CalendarCheck } from 'lucide-react'
import DeliveryFrame from '@/components/surprise/DeliveryFrame'
import { BookingForm, DeliveredBox, DeliverButton, DeliveryClaim } from '@/components/surprise/DeliveryProvider'
import { surpriseDb } from '@/lib/surpriseServer'
import { bookingLabel, deliveryCookieName, DELIVERY_STATUSES, normalizeDeliveryCode } from '@/lib/surpriseDelivery'
import { deliveryByCode, giftLive, tokenMatches } from '@/lib/surpriseDeliveryServer'

// Pagina di chi consegna il regalo (senza account): si apre dal link
// segreto dell'email. Richieste di chi riceve, appuntamento e consegna.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default async function DeliveryManagePage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code: raw } = await params
  setRequestLocale(locale)
  const t = await getTranslations('surprise')
  const code = normalizeDeliveryCode(raw)
  if (!code) notFound()
  const d = await deliveryByCode(code)
  if (!d) notFound()
  const allowed = tokenMatches(d, (await cookies()).get(deliveryCookieName(code))?.value)
  if (!allowed) {
    return (
      <DeliveryFrame>
        <section className="rounded-3xl border border-[var(--gold)]/30 bg-white/[0.04] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--gold-bright)]">{t('dlvManageKicker')}</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wider">{code}</p>
          <div className="mt-4">
            <DeliveryClaim code={code} />
          </div>
        </section>
      </DeliveryFrame>
    )
  }

  const { data: requests } = await surpriseDb()
    .from('surprise_delivery_requests')
    .select('id, when_text, contact, note, created_at')
    .eq('gift_id', d.gift_id)
    .order('created_at', { ascending: false })
    .limit(5)
  const to = d.gift.recipient_name.trim() || t('dlvSomeone')
  const from = d.gift.sender_name.trim() || t('dlvSomeone')
  const live = giftLive(d)
  const rank = DELIVERY_STATUSES.indexOf(d.status)
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
  const booking = bookingLabel(d.booking_text, d.booking_at, locale)

  return (
    <DeliveryFrame>
      <section className="space-y-4 rounded-3xl bg-white p-5 text-[#171717] shadow-xl sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-[#a37a2c]">{t('dlvManageKicker')}</p>
        <h1 className="break-words text-xl font-extrabold sm:text-2xl">{d.gift.title || '—'}</h1>
        <p className="text-sm text-gray-600">
          {t('dlvManageFor', { to, from })} · {t('dlvManageCode')} <span className="font-mono font-bold text-[#171717]">{d.code}</span>
          {d.gift.valid_until
            ? ` · ${t('validUntilView', { date: new Date(`${d.gift.valid_until}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}`
            : ''}
        </p>

        {/* Richiesto → Appuntamento → Consegnato */}
        <div className="flex items-center gap-1">
          {(['requested', 'booked', 'delivered'] as const).map((s) => (
            <span key={s} className={`flex-1 rounded-full px-2 py-1.5 text-center text-[11px] font-bold ${DELIVERY_STATUSES.indexOf(s) <= rank ? 'bg-[#c9a227] text-[#171717]' : 'bg-gray-100 text-gray-400'}`}>
              {t(`dlvStatus_${s}`)}
            </span>
          ))}
        </div>

        {!live ? (
          <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800">{t('dlvVerify_invalidText')}</p>
        ) : d.status === 'delivered' ? (
          <DeliveredBox />
        ) : (
          <div className="space-y-4 rounded-2xl bg-[#faf6ec] p-4">
            {booking ? (
              <>
                <p className="flex items-start gap-2 text-sm">
                  <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#a37a2c]" aria-hidden />
                  <span>
                    {t('dlvBookingNow')} <b>{booking}</b>
                  </span>
                </p>
                <DeliverButton code={d.code} />
                <BookingForm code={d.code} to={to} initialText={d.booking_text} initialAt={d.booking_at} change />
              </>
            ) : (
              <>
                <BookingForm code={d.code} to={to} initialText="" initialAt={null} />
                <div className="border-t border-[#c9a227]/20 pt-3">
                  <DeliverButton code={d.code} />
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <h2 className="text-sm font-bold">{t('dlvRequestsTitle', { to })}</h2>
          {!requests?.length ? (
            <p className="mt-1 text-sm text-gray-600">{t('dlvNoRequests', { to })}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {requests.map((r) => (
                <li key={r.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                  <p className="text-xs text-gray-500">{when(r.created_at as string)}</p>
                  <p>
                    <b>{t('dlvMailWhen')}</b> {r.when_text || '—'}
                  </p>
                  <p className="break-words">
                    <b>{t('dlvMailContact')}</b> {r.contact}
                  </p>
                  {r.note && (
                    <p className="whitespace-pre-wrap break-words">
                      <b>{t('dlvMailNote')}</b> {r.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </DeliveryFrame>
  )
}

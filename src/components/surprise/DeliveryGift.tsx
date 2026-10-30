'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarCheck, CheckCircle2, Gift, LoaderCircle, Mail, MapPin, MessageCircle, PackageCheck, Phone, Send, Store, User, X } from 'lucide-react'
import LinkifiedText from '@/components/LinkifiedText'
import { surpriseWhatsAppUrl, type SurpriseView } from '@/lib/surprise'
import { bookingLabel, deliveryVerifyPath, DELIVERY_MAX, DELIVERY_WHEN, firstName, type DeliveryView, type DeliveryWhen } from '@/lib/surpriseDelivery'
import { requestSurpriseDelivery } from '@/app/actions/surpriseDelivery'

// «Regalo con consegna» per chi riceve: buono dorato (messaggio, chi lo
// consegna e dove, codice e QR, stato) e «Ritira il tuo regalo» (richiesta con
// KUMANI oppure WhatsApp, chiamata, email).

const GOLD_DARK = '#8a6d1f'

export function DeliveryTicket({ view, delivery }: { view: SurpriseView; delivery: DeliveryView }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const v = view.voucher
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const url = `${window.location.origin}${deliveryVerifyPath(delivery.code)}`
    import('qrcode')
      .then((m) => m.default.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M', color: { dark: '#171717', light: '#fffaf0' } }))
      .then((u) => alive && setQr(u))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [delivery.code])
  const delivered = delivery.delivered
  return (
    <article className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#f7e7b4] via-[#d9b25c] to-[#a37a2c] p-[2px] shadow-[0_20px_50px_rgba(163,122,44,0.35)] motion-safe:animate-[fadeIn_0.6s_ease-out]">
      <div className="relative overflow-hidden rounded-[24px] bg-[#fffaf0] text-[#171717]">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#c9a227]/15 blur-2xl" />
        {v.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo dello Storage
          <img src={v.coverUrl} alt="" className="block h-auto max-h-[60vh] w-full bg-black/5 object-contain" />
        )}
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.25em]" style={{ color: GOLD_DARK }}>
              <Gift className="h-4 w-4" aria-hidden /> {t('dlvTicketLabel')}
            </p>
            {delivered ? (
              <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase text-white">{t('dlvDelivered')}</span>
            ) : (
              <span className="rounded-full bg-[#171717] px-2.5 py-1 text-[10px] font-bold uppercase text-[#e8c872]">{t('dlvValid')}</span>
            )}
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-letter)] text-[28px] font-semibold leading-tight sm:text-4xl">{v.title}</h2>
          {v.message && (
            <p className="mt-2 whitespace-pre-wrap font-[family-name:var(--font-letter)] text-lg italic leading-relaxed text-[#4a4033]">
              <LinkifiedText text={v.message} />
            </p>
          )}
          {view.senderName && (
            <p className="mt-2 text-right font-[family-name:var(--font-letter)] text-xl italic" style={{ color: GOLD_DARK }}>
              — {view.senderName}
            </p>
          )}
          {v.howToUse && <p className="mt-3 whitespace-pre-wrap text-sm text-[#4a4033]">{v.howToUse}</p>}
        </div>
        {/* Linea del biglietto */}
        <div aria-hidden className="relative h-5">
          <span className="absolute -left-2.5 top-0 h-5 w-5 rounded-full bg-black/70" />
          <span className="absolute -right-2.5 top-0 h-5 w-5 rounded-full bg-black/70" />
          <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-[#d9b25c]" />
        </div>
        <div className="relative flex items-center gap-4 p-5 pt-3 sm:p-6 sm:pt-3">
          <div className="min-w-0 flex-1 space-y-1.5 text-xs text-[#4a4033]">
            <p className="flex items-start gap-1.5 font-bold text-[#171717]">
              <User className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD_DARK }} aria-hidden /> <span className="break-words">{delivery.providerName}</span>
            </p>
            {delivery.business && (
              <p className="flex items-start gap-1.5">
                <Store className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD_DARK }} aria-hidden /> <span className="break-words">{delivery.business}</span>
              </p>
            )}
            {delivery.pickup && (
              <p className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD_DARK }} aria-hidden /> <span className="whitespace-pre-wrap break-words">{delivery.pickup}</span>
              </p>
            )}
            <p className="pt-1 font-mono text-[13px] font-bold tracking-wider text-[#171717]" aria-label={t('dlvCodeLabel')}>
              {delivery.code}
            </p>
            {v.validUntil && (
              <p className="text-[11px] opacity-70">
                {t('validUntilView', { date: new Date(v.validUntil + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
              </p>
            )}
          </div>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- immagine creata nel browser
            <img src={qr} alt={t('dlvQrAlt')} className={`h-24 w-24 shrink-0 rounded-lg sm:h-28 sm:w-28 ${delivered ? 'opacity-30' : ''}`} />
          ) : (
            <span className="h-24 w-24 shrink-0 rounded-lg bg-[#f1e6c6] sm:h-28 sm:w-28" />
          )}
        </div>
      </div>
    </article>
  )
}

export function DeliveryPickup({ view, delivery, token, preview }: { view: SurpriseView; delivery: DeliveryView; token?: string; preview?: boolean }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const [sheet, setSheet] = useState(false)
  const [sent, setSent] = useState(delivery.requested)
  const [when, setWhen] = useState<DeliveryWhen>('any')
  const [contact, setContact] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = firstName(delivery.providerName) || delivery.providerName
  const from = view.senderName || t('dlvSomeone')
  const waText = t('dlvWaText', { name, to: view.recipientName || '', from, title: view.voucher.title ?? '', code: delivery.code })
  const booking = bookingLabel(delivery.bookingText, delivery.bookingAt, locale)

  // Il foglio si chiude con Esc
  useEffect(() => {
    if (!sheet) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || preview) return
    if (contact.trim().length < 3) return setError(t('dlvErr_contact'))
    setBusy(true)
    setError(null)
    const r = await requestSurpriseDelivery(token, { when, contact, note })
    setBusy(false)
    if (!r.ok) return setError(t(`dlvErr_${r.reason}`))
    setSent(true)
    setSheet(false)
  }

  if (delivery.delivered) {
    return (
      <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-50" role="status">
        <p className="flex items-center gap-2 font-bold">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden /> {t('dlvDeliveredText')}
        </p>
      </div>
    )
  }

  const field = 'mt-1 w-full rounded-xl border border-[#c9a227]/40 bg-white px-3 py-2.5 text-[15px] text-[#171717] focus:border-[#c9a227] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/30'
  return (
    <div className="space-y-3">
      {booking ? (
        <div className="rounded-2xl border border-[#e8c872]/50 bg-[#e8c872]/10 p-4 text-sm text-white" role="status">
          <p className="flex items-center gap-2 font-bold text-[#f3dc8f]">
            <CalendarCheck className="h-5 w-5" aria-hidden /> {t('dlvBookedTitle')}
          </p>
          <p className="mt-1 text-base font-semibold">{booking}</p>
          {delivery.pickup && <p className="mt-1 whitespace-pre-wrap text-white/80">{delivery.pickup}</p>}
        </div>
      ) : sent ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-50" role="status">
          <p className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden /> {t('dlvSentTitle', { name })}
          </p>
          <p className="mt-1 text-emerald-50/80">{t('dlvSentText', { from })}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setSheet(true)}
        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-4 text-base font-extrabold ${
          sent || booking
            ? 'border border-white/25 bg-white/10 text-white hover:bg-white/15'
            : 'bg-gradient-to-r from-[#c9a227] to-[#e8c872] text-[#171717] shadow-[0_10px_30px_rgba(199,154,59,0.35)]'
        }`}
      >
        <PackageCheck className="h-5 w-5" aria-hidden /> {sent || booking ? t('dlvContactAgain', { name }) : t('dlvPickupCta')}
      </button>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setSheet(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dlv-sheet-title"
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 text-[#171717] shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[#a37a2c]">{t('dlvPickupCta')}</p>
                <p id="dlv-sheet-title" className="mt-1 break-words text-lg font-extrabold">
                  {t('dlvSheetTitle', { name: delivery.providerName })}
                </p>
                {delivery.business && <p className="text-sm text-gray-600">{delivery.business}</p>}
              </div>
              <button type="button" aria-label={t('dlvClose')} onClick={() => setSheet(false)} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!sent && (
              <form onSubmit={send}>
                <p className="mt-4 text-sm font-bold">{t('dlvSendTitle')}</p>
                <p className="text-xs text-gray-600">{t('dlvSendHint', { name })}</p>
                <div className="mt-2 space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">
                    {t('dlvWhenLabel')}
                    <select className={field} value={when} onChange={(e) => setWhen(e.target.value as DeliveryWhen)}>
                      {DELIVERY_WHEN.map((w) => (
                        <option key={w} value={w}>
                          {t(`dlvWhen_${w}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    {t('dlvContactLabel')} *
                    <input className={field} value={contact} maxLength={DELIVERY_MAX.contact} required autoComplete="tel" placeholder={t('dlvContactPlaceholder')} onChange={(e) => setContact(e.target.value)} />
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    {t('dlvNoteLabel')}
                    <textarea className={field} rows={2} value={note} maxLength={DELIVERY_MAX.note} placeholder={t('dlvNotePlaceholder')} onChange={(e) => setNote(e.target.value)} />
                  </label>
                </div>
                {error && (
                  <p className="mt-2 text-sm font-semibold text-red-600" role="alert">
                    {error}
                  </p>
                )}
                {preview && <p className="mt-2 text-xs font-semibold text-amber-700">{t('dlvPreviewNote')}</p>}
                <button
                  type="submit"
                  disabled={busy || preview || !token}
                  className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#171717] px-5 font-bold text-[#e8c872] disabled:opacity-60"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('dlvSendCta', { name })}
                </button>
              </form>
            )}

            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">{sent ? t('dlvContactDirect') : t('dlvOrContact')}</p>
            <div className={`mt-2 grid gap-2 ${delivery.phone ? 'grid-cols-3' : 'grid-cols-1'}`}>
              {delivery.phone && (
                <a href={surpriseWhatsAppUrl(waText, delivery.phone)} target="_blank" rel="noopener noreferrer" className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-green-50 p-3 text-xs font-bold text-green-800">
                  <MessageCircle className="h-5 w-5" aria-hidden /> WhatsApp
                </a>
              )}
              {delivery.phone && (
                <a href={`tel:${delivery.phone}`} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-sky-50 p-3 text-xs font-bold text-sky-800">
                  <Phone className="h-5 w-5" aria-hidden /> {t('dlvCall')}
                </a>
              )}
              <a
                href={`mailto:${delivery.email}?subject=${encodeURIComponent(t('dlvMailtoSubject', { code: delivery.code }))}&body=${encodeURIComponent(waText)}`}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl bg-gray-100 p-3 text-xs font-bold text-gray-700"
              >
                <Mail className="h-5 w-5" aria-hidden /> {t('dlvEmail')}
              </a>
            </div>
            {delivery.phone && <p className="mt-2 text-[11px] text-gray-500">{t('dlvWaHint')}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

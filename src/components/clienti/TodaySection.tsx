'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, MessageCircle, Phone } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { setNextStep } from '@/app/actions/clienti'
import { formatEur, whatsappDigits, type TodayData } from '@/lib/clienti'

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm'
const pill = 'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold'

// «Oggi»: chi sentire, cosa incassare dopo la consegna, cosa c'è in agenda
export default function TodaySection({ data, owedTotal }: { data: TodayData; owedTotal: number }) {
  const t = useTranslations('clienti')
  const locale = useLocale()
  const router = useRouter()
  const [doneIds, setDoneIds] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const dayLabel = new Date(`${data.today}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const daysBetween = (from: string) => Math.round((new Date(`${data.today}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000)
  const collectTotal = data.toCollect.reduce((s, x) => s + x.left, 0)
  const steps = data.steps.filter((s) => !doneIds.includes(s.id))
  const nothing = steps.length === 0 && data.toCollect.length === 0 && data.agenda.length === 0 && data.lateDue.length === 0

  const markDone = async (id: string) => {
    setBusy(id)
    const result = await setNextStep(id, '', null)
    setBusy(null)
    if (result.success) {
      setDoneIds((prev) => [...prev, id])
      router.refresh()
    }
  }

  const tile = (label: string, value: string, tone = 'text-[var(--ink)]') => (
    <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-3 sm:p-4">
      <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-lg font-extrabold sm:text-xl ${tone}`}>{value}</p>
    </div>
  )

  return (
    <section aria-labelledby="clienti-today" className="space-y-4">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#8a6a1f]">{dayLabel}</p>
        <h2 id="clienti-today" className="text-2xl font-bold text-[var(--ink)]">
          {t('today.title')}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tile(t('today.toCollect'), formatEur(owedTotal, locale))}
        {tile(t('today.afterDelivery'), formatEur(collectTotal, locale), collectTotal > 0 ? 'text-red-700' : 'text-[var(--ink)]')}
        {tile(t('today.openJobs'), String(data.openJobs))}
      </div>

      {nothing && <p className="rounded-2xl bg-[#e7f4ea] px-4 py-3 text-sm font-semibold text-[#1d6b34]">{t('today.allClear')}</p>}

      {steps.length > 0 && (
        <div className={card}>
          <h3 className="text-base font-extrabold text-[var(--ink)]">{t('today.stepsTitle')}</h3>
          <ul className="mt-2 divide-y divide-[var(--gold)]/15">
            {steps.map((s) => {
              const late = daysBetween(s.due)
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-2 py-3">
                  <Link href={`/app/clienti/${s.id}`} className="min-w-0 flex-1 basis-48">
                    <span className="block break-words font-bold text-[var(--ink)]">{s.name}</span>
                    <span className="block break-words text-sm text-[var(--muted)]">
                      {s.step}
                      {late > 0 ? <span className="font-semibold text-red-700"> · {t('today.lateDays', { days: late })}</span> : null}
                    </span>
                  </Link>
                  <span className="flex gap-2">
                    {s.phone && (
                      <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className={`${pill} bg-[var(--gold-bright)] text-[var(--ink)]`}>
                        <Phone className="h-4 w-4" aria-hidden="true" />
                        {t('call')}
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={busy === s.id}
                      onClick={() => markDone(s.id)}
                      aria-label={t('today.doneFor', { name: s.name })}
                      className={`${pill} border border-[var(--gold)]/40 bg-white text-[var(--ink)] disabled:opacity-60`}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {t('stepDone')}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {data.toCollect.length > 0 && (
        <div className={card}>
          <h3 className="text-base font-extrabold text-[var(--ink)]">{t('today.collectTitle')}</h3>
          <ul className="mt-2 divide-y divide-[var(--gold)]/15">
            {data.toCollect.map((x) => {
              const wa = whatsappDigits(x.phone)
              const text = t('today.reminderText', { name: x.clientName, amount: formatEur(x.left, locale), title: x.title })
              const tone = x.days >= 30 ? 'text-red-700' : x.days >= 7 ? 'text-[#8a6a1f]' : 'text-[var(--muted)]'
              return (
                <li key={x.id} className="flex flex-wrap items-center gap-2 py-3">
                  <Link href={`/app/clienti/lavoro/${x.id}`} className="min-w-0 flex-1 basis-48">
                    <span className="block break-words font-bold text-[var(--ink)]">
                      {x.clientName} · {formatEur(x.left, locale)}
                    </span>
                    <span className="block break-words text-sm text-[var(--muted)]">
                      {x.title} · <span className={`font-semibold ${tone}`}>{x.days === 0 ? t('today.deliveredToday') : t('today.deliveredDays', { days: x.days })}</span>
                    </span>
                  </Link>
                  {wa && (
                    <a href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={`${pill} border border-[var(--ink)] bg-white text-[var(--ink)]`}>
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      {t('today.remind')}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {(data.agenda.length > 0 || data.lateDue.length > 0) && (
        <div className={card}>
          <h3 className="text-base font-extrabold text-[var(--ink)]">{t('today.agendaTitle')}</h3>
          <ul className="mt-2 space-y-2">
            {data.agenda.map((a) => (
              <li key={`${a.id}-${a.kind}`}>
                <Link href={`/app/clienti/lavoro/${a.id}`} className="block text-sm text-[var(--ink)] hover:text-[#8a6a1f]">
                  <b>{a.kind === 'start' ? t('today.starts') : t('today.delivery')}</b> · {a.title} · {a.clientName}
                </Link>
              </li>
            ))}
            {data.lateDue.map((a) => (
              <li key={`late-${a.id}`}>
                <Link href={`/app/clienti/lavoro/${a.id}`} className="block text-sm text-[var(--ink)] hover:text-[#8a6a1f]">
                  <b className="text-red-700">{t('today.deliveryLate', { days: daysBetween(a.due) })}</b> · {a.title} · {a.clientName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

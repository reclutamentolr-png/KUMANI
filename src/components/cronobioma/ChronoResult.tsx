'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Plane } from 'lucide-react'
import { CHRONOTYPE_EMOJI, fmt, PREVIEW_EVENTS, type ChronoResult as Result, type ClockEventKey, type DayPlan } from '@/lib/cronobioma'
import ChronoClock, { EVENT_COLOR } from './ChronoClock'

export function useDuration() {
  const t = useTranslations('cronobioma')
  return (minutes: number) => {
    const h = Math.floor(Math.round(minutes) / 60)
    const m = Math.round(minutes) % 60
    return m ? t('hoursMinutes', { h, m: String(m).padStart(2, '0') }) : t('hoursOnly', { h })
  }
}

// Il risultato: cronotipo, sonno naturale, jet lag sociale e la giornata
// ideale sul quadrante. preview: la versione ridotta del test pubblico.
export default function ChronoResult({ result, plan, preview = false, now }: { result: Result; plan: DayPlan; preview?: boolean; now?: number | null }) {
  const t = useTranslations('cronobioma')
  const dur = useDuration()
  const [selected, setSelected] = useState<ClockEventKey | null>(null)
  const events = preview ? plan.events.filter((e) => PREVIEW_EVENTS.includes(e.key)) : plan.events
  const sorted = [...events].sort((x, y) => ((x.start - plan.wake + 1440) % 1440) - ((y.start - plan.wake + 1440) % 1440))
  const typeName = t(`type_${result.chronotype}`)
  const jl = result.socialJetlag
  // Fino a 2 ore: «un'ora o due di fuso»; oltre: «viaggio intercontinentale»
  const jetlagKey = jl < 45 ? 'jetlag_low' : jl < 120 ? 'jetlag_mid' : 'jetlag_high'

  const text = (key: ClockEventKey) => (key === 'bed' ? t('evText_bed', { hours: dur(plan.sleepNeed), wake: fmt(plan.wake) }) : t(`evText_${key}`))

  return (
    <div className="space-y-5">
      {/* Il cronotipo */}
      <div className="relative overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
        <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('yourType')}</p>
        <p className="relative mt-2 flex items-center gap-3 text-4xl font-extrabold sm:text-5xl">
          <span aria-hidden>{CHRONOTYPE_EMOJI[result.chronotype]}</span> {typeName}
        </p>
        <p className="relative mt-3 max-w-xl text-white/75">{t(`typeText_${result.chronotype}`)}</p>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.06] p-3">
            <p className="text-xs text-white/55">{t('naturalSleep')}</p>
            <p className="mt-0.5 font-bold">{t('naturalSleepValue', { bed: fmt(result.naturalBed), wake: fmt(result.naturalWake) })}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-3">
            <p className="text-xs text-white/55">{t('sleepWork')}</p>
            <p className="mt-0.5 font-bold">{dur(result.sleepWork)}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-3">
            <p className="text-xs text-white/55">{t('sleepFree')}</p>
            <p className="mt-0.5 font-bold">{dur(result.sleepFree)}</p>
          </div>
        </div>
      </div>

      {/* Jet lag sociale */}
      <div className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${jl >= 120 ? 'border-amber-300 bg-amber-50' : 'border-[var(--gold)]/30 bg-white'}`}>
        <Plane className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
        <div>
          <p className="font-bold text-[var(--ink)]">
            {t('jetlagTitle')}: {dur(jl)}
          </p>
          <p className="mt-0.5 text-sm text-[var(--ink-soft)]">{t(jetlagKey, { time: dur(jl) })}</p>
        </div>
      </div>
      {!result.reliable && <p className="rounded-xl bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">{t('unreliable')}</p>}

      {/* La giornata ideale */}
      <div className="rounded-3xl border border-[var(--gold)]/25 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-extrabold text-[var(--ink)]">{preview ? t('previewTitle') : t('clockTitle')}</h3>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{preview ? t('previewWake', { wake: fmt(plan.wake) }) : t('clockHint')}</p>
        <div className="mt-4 grid items-center gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <ChronoClock
            bed={plan.bed}
            wake={plan.wake}
            events={events}
            selected={selected}
            onSelect={preview ? undefined : setSelected}
            now={now}
            nowLabel={t('clockNow')}
            center={{ emoji: CHRONOTYPE_EMOJI[result.chronotype], title: typeName, sub: `${fmt(plan.bed)} – ${fmt(plan.wake)}` }}
          />
          <ul className="space-y-2">
            {sorted.map((e) => (
              <li key={e.key}>
                <button
                  type="button"
                  onClick={() => setSelected(selected === e.key ? null : e.key)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors ${selected === e.key ? 'bg-[var(--gold-pale)]' : 'hover:bg-gray-50'}`}
                >
                  <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: EVENT_COLOR[e.key] }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-bold text-[var(--ink)]">{t(`ev_${e.key}`)}</span>
                      <span className="font-mono text-sm font-bold text-[var(--ink-soft)]">
                        {fmt(e.start)}
                        {e.end !== undefined ? `–${fmt(e.end)}` : ''}
                      </span>
                    </span>
                    {(preview || selected === e.key) && <span className="mt-0.5 block text-sm text-[var(--muted)]">{text(e.key)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {plan.earlyBy >= 30 && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t('earlyNote', { time: dur(plan.earlyBy) })}
          </p>
        )}
        {preview && <p className="mt-4 text-sm text-[var(--muted)]">{t('previewMore')}</p>}
      </div>
    </div>
  )
}

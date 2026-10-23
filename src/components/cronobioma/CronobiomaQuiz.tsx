'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { DEFAULT_ANSWERS, LATENCIES, OUTDOOR, SHIFTS, type QuizAnswers } from '@/lib/cronobioma'

// Il questionario (uguale nella pagina pubblica e nel servizio): orari veri
// di sonno nei giorni di lavoro e in quelli liberi, in 4 passi.
export default function CronobiomaQuiz({ initial, onDone }: { initial?: QuizAnswers | null; onDone: (answers: QuizAnswers) => void }) {
  const t = useTranslations('cronobioma')
  const [a, setA] = useState<QuizAnswers>(initial ?? DEFAULT_ANSWERS)
  const [step, setStep] = useState(1)
  const set = (patch: Partial<QuizAnswers>) => setA((prev) => ({ ...prev, ...patch }))
  // Senza giorni di lavoro si salta il passo dei giorni di lavoro
  const steps = a.workDays === 0 ? [1, 3, 4] : [1, 2, 3, 4]
  const index = steps.indexOf(step)
  const last = index === steps.length - 1

  const finish = () => {
    const done = a.workDays === 0 ? { ...a, workBed: a.freeBed, workLatency: a.freeLatency, workWake: a.freeWake } : a
    onDone(done)
  }

  const chip = (on: boolean) =>
    `min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${on ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 bg-white text-gray-600 hover:border-[var(--gold)]/60'}`
  const timeField = 'mt-1 block w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-lg font-bold text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none'

  const sleepBlock = (kind: 'work' | 'free') => {
    const bed = kind === 'work' ? 'workBed' : 'freeBed'
    const lat = kind === 'work' ? 'workLatency' : 'freeLatency'
    const wake = kind === 'work' ? 'workWake' : 'freeWake'
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-extrabold text-[var(--ink)]">{t(kind === 'work' ? 'workTitle' : 'freeTitle')}</h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{t(kind === 'work' ? 'workHint' : 'freeHint')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('bedLabel')}
            <input type="time" value={a[bed]} onChange={(e) => e.target.value && set({ [bed]: e.target.value } as Partial<QuizAnswers>)} className={timeField} />
          </label>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('wakeLabel')}
            <input type="time" value={a[wake]} onChange={(e) => e.target.value && set({ [wake]: e.target.value } as Partial<QuizAnswers>)} className={timeField} />
          </label>
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">{t('latencyLabel')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LATENCIES.map((n) => (
              <button key={n} type="button" onClick={() => set({ [lat]: n } as Partial<QuizAnswers>)} aria-pressed={a[lat] === n} className={chip(a[lat] === n)}>
                {t('latencyValue', { n })}
              </button>
            ))}
          </div>
        </div>
        {kind === 'free' && (
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">{t('alarmLabel')}</p>
            <div className="mt-2 flex gap-2">
              {[false, true].map((v) => (
                <button key={String(v)} type="button" onClick={() => set({ freeAlarm: v })} aria-pressed={a.freeAlarm === v} className={chip(a.freeAlarm === v)}>
                  {t(v ? 'yes' : 'no')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-[var(--gold)]/30 bg-white p-5 shadow-[0_14px_40px_rgba(23,23,23,0.08)] sm:p-7">
      <div className="mb-5 flex items-center gap-2" aria-hidden>
        {steps.map((s, i) => (
          <span key={s} className={`h-2 flex-1 rounded-full ${i <= index ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]' : 'bg-[var(--gold)]/15'}`} />
        ))}
      </div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{t('stepOf', { n: index + 1, total: steps.length })}</p>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-extrabold text-[var(--ink)]">{t('q_workDays')}</h3>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" onClick={() => set({ workDays: n })} aria-pressed={a.workDays === n} aria-label={t('workDaysValue', { n })} className={chip(a.workDays === n)}>
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{t('workDaysValue', { n: a.workDays })}</p>
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--ink)]">{t('q_shift')}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {SHIFTS.map((s) => (
                <button key={s} type="button" onClick={() => set({ shift: s })} aria-pressed={a.shift === s} className={chip(a.shift === s)}>
                  {t(`shift_${s}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {step === 2 && sleepBlock('work')}
      {step === 3 && sleepBlock('free')}
      {step === 4 && (
        <div>
          <h3 className="text-xl font-extrabold text-[var(--ink)]">{t('outdoorLabel')}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {OUTDOOR.map((o) => (
              <button key={o} type="button" onClick={() => set({ outdoor: o })} aria-pressed={a.outdoor === o} className={chip(a.outdoor === o)}>
                {t(`outdoor_${o}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {index > 0 && (
          <button
            type="button"
            onClick={() => setStep(steps[index - 1])}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-[var(--gold)]/40 bg-white px-4 font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
          >
            <ArrowLeft className="h-4 w-4" /> {t('back')}
          </button>
        )}
        <button
          type="button"
          onClick={() => (last ? finish() : setStep(steps[index + 1]))}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 text-base font-extrabold text-[var(--ink)] shadow-md hover:brightness-105"
        >
          {last ? (
            <>
              <Sparkles className="h-5 w-5" /> {t('seeResult')}
            </>
          ) : (
            <>
              {t('next')} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

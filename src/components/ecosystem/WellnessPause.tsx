'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Eye, LoaderCircle, PersonStanding, X } from 'lucide-react'
import WellnessPauseArt, { type PauseArtKey } from './WellnessPauseArt'
import { finishWellnessPause, startWellnessPause, type WellnessToday } from '@/app/actions/ecosystem'

// «Pausa di un minuto»: stretching (4 movimenti da 15 secondi) o riposo degli
// occhi 20-20-20 (3 momenti da 20 secondi), con il cerchio del tempo. Inizio
// e fine li registra il database: il passo vale solo dopo almeno 55 secondi.
type Kind = 'stretch' | 'eyes'
const PLAN: Record<Kind, { steps: PauseArtKey[]; each: number }> = {
  stretch: { steps: ['wellnessStretch1', 'wellnessStretch2', 'wellnessStretch3', 'wellnessStretch4'], each: 15 },
  eyes: { steps: ['wellnessEyes1', 'wellnessEyes2', 'wellnessEyes3'], each: 20 },
}
const TOTAL = 60
// Orologio fuori dal componente (si legge solo negli eventi e nei timer)
const clock = () => Date.now()

export default function WellnessPause({ onClose, onDone }: { onClose: () => void; onDone: (state: WellnessToday) => void }) {
  const t = useTranslations('ecosystem')
  const [kind, setKind] = useState<Kind | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [phase, setPhase] = useState<'choose' | 'starting' | 'running' | 'saving' | 'done' | 'error'>('choose')
  const pauseId = useRef<string | null>(null)
  const startedAt = useRef(0)

  // Tempo contato dall'orologio (non dai tick), così non rallenta se la scheda resta indietro
  useEffect(() => {
    if (phase !== 'running') return
    const timer = setInterval(() => setElapsed(Math.min(TOTAL, Math.floor((clock() - startedAt.current) / 1000))), 250)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'running' || elapsed < TOTAL || !pauseId.current) return
    setPhase('saving')
    finishWellnessPause(pauseId.current).then((state) => {
      if (state && !state.error) {
        setPhase('done')
        onDone(state)
        try {
          navigator.vibrate?.(200)
        } catch {
          // facoltativo
        }
      } else setPhase('error')
    })
  }, [elapsed, phase, onDone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const start = async (k: Kind) => {
    setKind(k)
    setPhase('starting')
    const id = await startWellnessPause(k)
    if (!id) {
      setPhase('error')
      return
    }
    pauseId.current = id
    startedAt.current = clock()
    setElapsed(0)
    setPhase('running')
  }

  const plan = kind ? PLAN[kind] : null
  const stepIndex = plan ? Math.min(plan.steps.length - 1, Math.floor(elapsed / plan.each)) : 0
  const stepLeft = plan ? plan.each - (elapsed % plan.each) : 0
  const radius = 54
  const circumference = 2 * Math.PI * radius

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t('wellnessPause')} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('wellnessPause')}</h3>
          <button type="button" onClick={onClose} aria-label={t('wellnessPauseCancel')} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {phase === 'choose' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { k: 'stretch' as const, Icon: PersonStanding, title: t('wellnessPauseStretch'), hint: t('wellnessPauseStretchHint') },
                { k: 'eyes' as const, Icon: Eye, title: t('wellnessPauseEyes'), hint: t('wellnessPauseEyesHint') },
              ]
            ).map(({ k, Icon, title, hint }) => (
              <button
                key={k}
                type="button"
                onClick={() => start(k)}
                className="flex flex-col items-start gap-2 rounded-2xl border border-teal-200 p-4 text-left transition hover:border-teal-400 hover:bg-teal-50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-bold text-[var(--ink)]">{title}</span>
                <span className="text-xs leading-snug text-[var(--muted)]">{hint}</span>
              </button>
            ))}
          </div>
        )}

        {phase === 'starting' && (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
          </p>
        )}

        {(phase === 'running' || phase === 'saving') && plan && (
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            {/* Figura animata del movimento, con il tempo che resta */}
            <div className="relative flex w-full justify-center rounded-2xl bg-teal-50 px-4 py-3">
              <WellnessPauseArt key={plan.steps[stepIndex]} step={plan.steps[stepIndex]} />
              <div className="absolute right-2 top-2 h-14 w-14">
                <svg viewBox="0 0 120 120" className="h-14 w-14 -rotate-90" aria-hidden>
                  <circle cx="60" cy="60" r={radius} fill="#fff" stroke="#ccfbf1" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke="#0d9488"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - elapsed / TOTAL)}
                    className="transition-[stroke-dashoffset] duration-300"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-base font-extrabold tabular-nums text-[var(--ink)]" aria-label={`${TOTAL - elapsed} ${t('wellnessPauseSeconds')}`}>
                  {TOTAL - elapsed}
                </span>
              </div>
            </div>
            <div className="min-h-20 space-y-1" aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                {stepIndex + 1} / {plan.steps.length} · {stepLeft} s
              </p>
              <p className="text-base font-semibold leading-snug text-[var(--ink)]">{t(plan.steps[stepIndex])}</p>
            </div>
            <div className="flex gap-1.5" aria-hidden>
              {plan.steps.map((s, i) => (
                <span key={s} className={`h-1.5 w-8 rounded-full ${i < stepIndex ? 'bg-teal-600' : i === stepIndex ? 'bg-teal-400 motion-safe:animate-pulse' : 'bg-teal-100'}`} />
              ))}
            </div>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              {t('wellnessPauseCancel')}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-7 w-7" />
            </span>
            <p className="text-lg font-bold text-[var(--ink)]">{t('wellnessPauseDone')}</p>
            <button type="button" onClick={onClose} className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-bold text-white hover:bg-teal-700">
              {t('wellnessPauseClose')}
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm font-semibold text-red-700">{t('wellnessPauseError')}</p>
            <button type="button" onClick={() => setPhase('choose')} className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-bold text-teal-800">
              {t('wellnessPauseRetry')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

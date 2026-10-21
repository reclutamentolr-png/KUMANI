'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Clock, ExternalLink, LifeBuoy, LoaderCircle, Lock, RotateCcw } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { askConfirm } from '@/lib/confirm'
import { finishSolveRun, resetSolveRun, saveSolveRun } from '@/app/actions/solve'
import { allAnswered, progressOf, urgentNotices, visibleSteps } from '@/lib/solve/engine'
import type { SolveAnswers, SolveGuide, SolveLink, SolveOutcome } from '@/lib/solve/types'
import { SOLVE_ICONS } from './solveIcons'

type Access = Record<string, { open: boolean; plan: 'free' | 'base' | 'pro' }>

// Il percorso di una guida: le domande, l'avviso urgente (se le risposte lo
// richiedono), i passi da spuntare e l'esito. Si salva da solo dopo ogni
// scelta; «Ricomincia» cancella risposte e spunte.
export default function SolvePlayer({
  guide,
  initialAnswers,
  initialDone,
  initialOutcome,
  access,
  locale,
}: {
  guide: SolveGuide
  initialAnswers: SolveAnswers
  initialDone: string[]
  initialOutcome: SolveOutcome | null
  access: Access
  locale: string
}) {
  const t = useTranslations('solve')
  const [answers, setAnswers] = useState(initialAnswers)
  const [done, setDone] = useState(initialDone)
  const [outcome, setOutcome] = useState<SolveOutcome | null>(initialOutcome)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<number | null>(null)
  const first = useRef(true)

  // Salvataggio automatico, un attimo dopo l'ultima scelta
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      setSaving('saving')
      const r = await saveSolveRun(guide.id, answers, done).catch(() => ({ success: false }))
      setSaving(r.success ? 'saved' : 'error')
    }, 600)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [answers, done, guide.id])

  const Icon = SOLVE_ICONS[guide.icon] ?? LifeBuoy
  const ready = allAnswered(guide, answers)
  const steps = visibleSteps(guide, answers)
  const urgent = urgentNotices(guide, answers)
  const p = progressOf(guide, answers, done)
  const allDone = ready && p.total > 0 && p.done === p.total

  const toggleStep = (id: string) => setDone((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))
  const answer = (q: string, value: string) => setAnswers((prev) => ({ ...prev, [q]: value }))

  const finish = async (value: SolveOutcome) => {
    setOutcome(value)
    await finishSolveRun(guide.id, value).catch(() => null)
  }
  const reset = async () => {
    if (!(await askConfirm(t('resetConfirm')))) return
    await resetSolveRun(guide.id).catch(() => null)
    first.current = true
    setAnswers({})
    setDone([])
    setOutcome(null)
    setSaving('idle')
  }

  const planLabel = (plan: 'free' | 'base' | 'pro') => (plan === 'pro' ? 'Pro' : plan === 'base' ? 'Base' : t('free'))
  const linkButton = (link: SolveLink, primary = false) => {
    const external = /^https?:\/\//.test(link.href)
    const a = link.tool ? access[link.tool] : undefined
    const locked = !!a && !a.open
    const cls = `inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold ${
      primary ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]' : 'border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]'
    }`
    const inner = (
      <>
        {locked && <Lock className="h-3.5 w-3.5" />} {link.label}
        {locked && a && <span className="rounded-full bg-[var(--ink)] px-1.5 text-[10px] text-[var(--gold-bright)]">{planLabel(a.plan)}</span>}
        {external ? <ExternalLink className="h-3.5 w-3.5" /> : <ArrowRight className="h-4 w-4" />}
      </>
    )
    return external ? (
      <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    ) : (
      <Link key={link.href} href={link.href} className={cls}>
        {inner}
      </Link>
    )
  }

  return (
    <div className="space-y-5">
      {/* Intestazione della guida */}
      <section className="rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.18)] sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">{guide.title}</h1>
            <p className="mt-1 text-sm text-white/75">{guide.subtitle}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold-bright)]">
              <Clock className="h-3.5 w-3.5" /> {t('minutes', { m: guide.minutes })}
            </p>
            {locale !== 'it' && <p className="mt-1 text-xs text-white/60">{t('onlyItalian')}</p>}
          </div>
        </div>
      </section>

      {/* Domande */}
      <section className="space-y-4 rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
        {guide.questions.map((q, i) => (
          <fieldset key={q.id}>
            <legend className="mb-2 text-sm font-bold text-[var(--ink)]">
              {i + 1}. {q.text}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const on = answers[q.id] === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => answer(q.id, o.value)}
                    className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                      on ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--ink)]' : 'border-gray-200 bg-white text-[var(--ink)] hover:border-[var(--gold)]/60'
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[var(--ink)] bg-[var(--ink)]' : 'border-gray-300'}`}>
                      {on && <Check className="h-3 w-3 text-[var(--gold-bright)]" />}
                    </span>
                    {o.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
        {!ready && <p className="text-xs text-[var(--muted)]">{t('answerFirst')}</p>}
      </section>

      {/* Avvisi urgenti: prima di tutto il resto */}
      {urgent.map((notice) => (
        <section key={notice.title} role="alert" className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 text-red-900 shadow-sm">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" /> {notice.title}
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6">
            {notice.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      {/* Passi */}
      {ready && (
        <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold text-[var(--ink)]">{t('stepsTitle')}</h2>
            <span className="text-xs font-bold text-[var(--muted)]">{t('progress', { done: p.done, total: p.total })}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--gold-pale)]" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done}>
            <div className="h-full rounded-full bg-[var(--gold)] transition-[width]" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
          </div>
          <ol className="mt-4 space-y-3">
            {steps.map((step, i) => {
              const isDone = done.includes(step.id)
              return (
                <li key={step.id} className={`rounded-xl border p-3 ${isDone ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleStep(step.id)}
                      aria-pressed={isDone}
                      aria-label={`${isDone ? t('undo') : t('markDone')}: ${step.title}`}
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${isDone ? 'bg-emerald-600 text-white' : 'border-2 border-[var(--gold)] text-[var(--ink)]'}`}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : i + 1}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold ${isDone ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>{step.title}</p>
                      {step.body && !isDone && <p className="mt-1 text-sm leading-6 text-gray-700">{step.body}</p>}
                      {step.link && !isDone && (
                        <div className="mt-2">
                          {linkButton(step.link)}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
            <span aria-live="polite">
              {saving === 'saving' ? (
                <span className="inline-flex items-center gap-1">
                  <LoaderCircle className="h-3 w-3 animate-spin" /> {t('saving')}
                </span>
              ) : saving === 'saved' ? (
                t('saved')
              ) : saving === 'error' ? (
                <span className="text-red-700">{t('saveError')}</span>
              ) : null}
            </span>
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 font-semibold hover:text-[var(--ink)]">
              <RotateCcw className="h-3.5 w-3.5" /> {t('reset')}
            </button>
          </div>
        </section>
      )}

      {/* Esito */}
      {allDone && (
        <section className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/60 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--ink)]">{guide.finish.question}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['yes', 'no', 'unknown'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={outcome === value}
                onClick={() => finish(value)}
                className={`min-h-10 rounded-xl px-4 text-sm font-bold ${outcome === value ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--ink)]/20 bg-white text-[var(--ink)]'}`}
              >
                {t(`outcome_${value}`)}
              </button>
            ))}
          </div>
          {outcome === 'yes' && (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> {t('thanks')}
            </p>
          )}
          {(outcome === 'no' || outcome === 'unknown') && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{t('ifNoTitle')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {guide.finish.ifNo.map((link) => linkButton(link))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Servizi collegati */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{t('servicesTitle')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {guide.services.map((link, i) => linkButton(link, i === 0))}
        </div>
      </section>

      {/* Fonti, revisione, nota */}
      <footer className="space-y-2 px-1 text-xs leading-5 text-[var(--muted)]">
        <p>
          <span className="font-semibold">{t('sourcesTitle')}:</span>{' '}
          {guide.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)]">
                {s.label}
              </a>
            </span>
          ))}
        </p>
        <p>{t('reviewed', { date: new Date(guide.reviewedAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
        <p>{guide.note}</p>
      </footer>
    </div>
  )
}

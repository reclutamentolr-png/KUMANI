'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Lock, RotateCcw, ShieldCheck, Stethoscope } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { cleanAnswers, computeChrono, dayPlan, toMinutes, QUIZ_STORAGE_KEY, type QuizAnswers } from '@/lib/cronobioma'
import CronobiomaQuiz from './CronobiomaQuiz'
import ChronoResult from './ChronoResult'
import ChronoShare from './ChronoShare'

// Il test pubblico: niente sul server, il risultato resta nel browser (lo
// ritrova il servizio dopo l'iscrizione). In fondo l'immagine da condividere
// e l'invito: registrarsi (con chi ha condiviso), aprire il servizio o il Plus.
export default function CronobiomaPublic({
  access,
  registerHref,
  shareUrl,
}: {
  access: 'guest' | 'member' | 'plus'
  registerHref: string
  shareUrl: string
}) {
  const t = useTranslations('cronobioma')
  const [answers, setAnswers] = useState<QuizAnswers | null>(null)
  const [started, setStarted] = useState(false)

  // Un test già fatto su questo dispositivo
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(QUIZ_STORAGE_KEY) ?? 'null')
      const clean = cleanAnswers(saved?.answers)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- si legge una volta sola dal browser
      if (clean) setAnswers(clean)
    } catch {
      // facoltativo
    }
  }, [])

  const done = (a: QuizAnswers) => {
    setAnswers(a)
    try {
      localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify({ answers: a, at: new Date().toISOString() }))
    } catch {
      // facoltativo
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const retake = () => {
    setAnswers(null)
    setStarted(true)
  }

  if (!answers) {
    return started ? (
      <CronobiomaQuiz onDone={done} />
    ) : (
      <div className="rounded-3xl border border-[var(--gold)]/30 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-lg text-[var(--ink-soft)]">{t('quizIntro')}</p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 text-base font-extrabold text-[var(--ink)] shadow-md hover:brightness-105"
        >
          {t('publicStart')} <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--muted)]">
          <ShieldCheck className="h-4 w-4 text-[var(--gold)]" /> {t('privacyNote')}
        </p>
      </div>
    )
  }

  const result = computeChrono(answers)
  const wake = toMinutes(answers.workDays > 0 ? answers.workWake : answers.freeWake) ?? result.naturalWake
  const plan = dayPlan(result, wake)

  return (
    <div className="space-y-5">
      <ChronoResult result={result} plan={plan} preview />

      {/* L'orologio completo */}
      <div className="rounded-3xl border-2 border-[var(--gold)]/60 bg-gradient-to-br from-[var(--gold-pale)] to-white p-6 shadow-[0_10px_30px_rgba(199,154,59,0.18)]">
        <p className="flex items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
          <Lock className="h-5 w-5 text-[var(--gold)]" /> {t('ctaTitle')}
        </p>
        <p className="mt-1 text-[var(--ink-soft)]">{t('ctaText')}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {access === 'guest' ? (
            <>
              <Link href={registerHref} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 font-extrabold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]">
                {t('ctaRegister')} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={`/login?next=${encodeURIComponent('/app/cronobioma')}`} className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--gold)]/50 bg-white px-5 font-bold text-[var(--ink)]">
                {t('ctaLogin')}
              </Link>
            </>
          ) : access === 'plus' ? (
            <Link href="/app/cronobioma" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 font-extrabold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]">
              {t('ctaOpen')} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link href="/billing" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 font-extrabold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]">
              {t('ctaPlus')} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      <ChronoShare result={result} plan={plan} shareUrl={shareUrl} />

      <div className="space-y-2 rounded-2xl bg-white/70 p-4 text-sm text-[var(--muted)]">
        <p className="flex items-start gap-2">
          <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('doctorNote')}
        </p>
        <p>{t('disclaimer')}</p>
        <p className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-[var(--gold)]" /> {t('privacyNote')}
        </p>
      </div>
      <button type="button" onClick={retake} className="mx-auto flex items-center gap-1.5 text-sm font-bold text-[var(--gold)] hover:text-[var(--ink)]">
        <RotateCcw className="h-4 w-4" /> {t('retake')}
      </button>
    </div>
  )
}

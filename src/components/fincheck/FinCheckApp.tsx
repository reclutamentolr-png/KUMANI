'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, BarChart3, CheckCircle2, ClipboardList, Gauge, ListChecks, LoaderCircle, Lock, PiggyBank, RotateCcw, Sparkles, TrendingUp } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { saveFinCheck, setFinCheckGoal } from '@/app/actions/fincheck'
import {
  FINCHECK_AREAS,
  FINCHECK_QUESTIONS,
  answerOrder,
  areaLevel,
  pickGoals,
  profileOf,
  type AreaLevel,
  type CheckupResult,
} from '@/lib/fincheck'

export type FinCheckResultRow = {
  id: string
  answers: number[]
  area_scores: number[]
  total: number
  ku_awarded: number
  goals_done: string[]
  created_at: string
}

const LEVEL_STYLE: Record<AreaLevel, { dot: string; bar: string; text: string; soft: string }> = {
  green: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-700', soft: 'border-emerald-200 bg-emerald-50' },
  yellow: { dot: 'bg-amber-400', bar: 'bg-amber-400', text: 'text-amber-700', soft: 'border-amber-200 bg-amber-50' },
  red: { dot: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-700', soft: 'border-red-200 bg-red-50' },
}

const SPENDLY_CATEGORY_KEY: Record<string, string> = {
  spesa_alimentari: 'categorySpesaAlimentari',
  svago_ristoranti: 'categorySvagoRistoranti',
  trasporti: 'categoryTrasporti',
  salute: 'categorySalute',
  casa: 'categoryCasa',
  shopping: 'categoryShopping',
  altro: 'categoryAltro',
}

export default function FinCheckApp({
  results,
  checkup,
  hasSpendly,
  locale,
}: {
  results: FinCheckResultRow[]
  checkup: CheckupResult | null
  hasSpendly: boolean
  locale: string
}) {
  const t = useTranslations('fincheck')
  const spendlyT = useTranslations('spendly')
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'quiz'>('view')
  const [answers, setAnswers] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kuMessage, setKuMessage] = useState<number | null>(null)
  const [goalsDone, setGoalsDone] = useState<string[]>(results[0]?.goals_done ?? [])

  const latest = results[0] ?? null
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
  const date = (value: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))

  const startQuiz = () => {
    setAnswers([])
    setError(null)
    setKuMessage(null)
    setMode('quiz')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const choose = async (points: number) => {
    if (answers.length >= FINCHECK_QUESTIONS.length) return
    const next = [...answers, points]
    if (next.length < FINCHECK_QUESTIONS.length) {
      setAnswers(next)
      return
    }
    setAnswers(next)
    await submit(next)
  }

  const submit = async (final: number[]) => {
    setSaving(true)
    setError(null)
    const res = await saveFinCheck(final)
    setSaving(false)
    if (!res.success) {
      setError(res.code === 'too_fast' ? t('errorTooFast') : t('errorSave'))
      return
    }
    setKuMessage(res.ku ?? 0)
    setGoalsDone([])
    setMode('view')
    router.refresh()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ------------------------------------------------------------------ test
  if (mode === 'quiz') {
    const index = Math.min(answers.length, FINCHECK_QUESTIONS.length - 1)
    const question = FINCHECK_QUESTIONS[index]
    const total = FINCHECK_QUESTIONS.length
    return (
      <div className="mx-auto max-w-xl">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
          <span>
            {t('questionOf', { n: index + 1, total })} · {t(`area_${question.area}`)}
          </span>
          {answers.length > 0 && !saving ? (
            <button type="button" onClick={() => setAnswers(answers.slice(0, -1))} className="flex items-center gap-1 hover:text-[var(--ink)]">
              <ArrowLeft className="h-3.5 w-3.5" /> {t('back')}
            </button>
          ) : (
            latest && (
              <button type="button" onClick={() => setMode('view')} className="hover:text-[var(--ink)]">
                {t('cancel')}
              </button>
            )
          )}
        </div>
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] transition-all" style={{ width: `${(answers.length / total) * 100}%` }} />
        </div>
        {saving ? (
          <div className="flex flex-col items-center gap-3 py-16 text-[var(--muted)]">
            <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold)]" />
            <p className="text-sm font-medium">{t('calculating')}</p>
          </div>
        ) : (
          <>
            <h2 className="mb-5 text-center text-xl font-bold text-[var(--ink)] sm:text-2xl">{t(`${question.id}.text`)}</h2>
            <div className="space-y-3">
              {answerOrder(index).map((points) => (
                <button
                  key={`${question.id}-${points}`}
                  type="button"
                  onClick={() => choose(points)}
                  className="w-full rounded-xl border-2 border-[var(--gold)]/25 bg-white px-5 py-4 text-left font-medium text-[var(--ink)] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--gold)] hover:shadow-md"
                >
                  {t(`${question.id}.a${points}`)}
                </button>
              ))}
            </div>
          </>
        )}
        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}{' '}
            <button type="button" onClick={() => void submit(answers)} className="font-bold underline">
              {t('retry')}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ------------------------------------------------------------ nessun test
  if (!latest) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-[var(--gold)]/30 bg-[var(--paper)] p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-[var(--ink)]">{t('introTitle')}</h2>
          <p className="mt-2 text-[var(--muted)]">{t('introText')}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ClipboardList, key: 'introPoint1' },
              { icon: BarChart3, key: 'introPoint2' },
              { icon: ListChecks, key: 'introPoint3' },
            ].map(({ icon: Icon, key }) => (
              <div key={key} className="rounded-2xl border border-[var(--gold)]/20 bg-white p-4">
                <Icon className="mb-2 h-6 w-6 text-[var(--gold)]" />
                <p className="text-sm text-[var(--ink)]">{t(key)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <button type="button" onClick={startQuiz} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3 font-bold text-[var(--gold-bright)] shadow-md transition hover:opacity-90">
              {t('start')} <ArrowRight className="h-4 w-4" />
            </button>
            <span className="text-sm text-[var(--muted)]">{t('duration')}</span>
          </div>
        </section>
        {renderCheckup()}
      </div>
    )
  }

  // -------------------------------------------------------------- risultati
  const profile = profileOf(latest.total)
  const goals = pickGoals(latest.answers, checkup ?? { status: 'noData' })
  const previous = results[1] ?? null

  const toggleGoal = async (key: string) => {
    const done = !goalsDone.includes(key)
    setGoalsDone((current) => (done ? [...current, key] : current.filter((g) => g !== key)))
    const res = await setFinCheckGoal(latest.id, key, done)
    if (!res.success) setGoalsDone((current) => (done ? current.filter((g) => g !== key) : [...current, key]))
  }

  return (
    <div className="space-y-8">
      {kuMessage !== null && (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {kuMessage > 0 ? t('savedKu', { points: kuMessage }) : t('saved')}
        </p>
      )}

      {/* Profilo e aree */}
      <section className="rounded-3xl border border-[var(--gold)]/30 bg-[var(--paper)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{t('yourProfile')}</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--ink)] sm:text-3xl">{t(`profile_${profile}_name`)}</h2>
            <p className="mt-2 max-w-xl text-[var(--muted)]">{t(`profile_${profile}_text`)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-start sm:items-end">
            <p className="text-4xl font-bold text-[var(--ink)]">
              {latest.total}
              <span className="text-lg font-semibold text-[var(--muted)]">/45</span>
            </p>
            {previous && (
              <p className={`text-xs font-semibold ${latest.total >= previous.total ? 'text-emerald-700' : 'text-red-700'}`}>
                {t('vsPrevious', { diff: `${latest.total - previous.total >= 0 ? '+' : ''}${latest.total - previous.total}` })}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--muted)]">{t('testDate', { date: date(latest.created_at) })}</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {FINCHECK_AREAS.map((area, a) => {
            const score = latest.area_scores[a]
            const level = areaLevel(score)
            const style = LEVEL_STYLE[level]
            return (
              <div key={area} className={`rounded-2xl border p-4 ${style.soft}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} /> {t(`area_${area}`)}
                  </p>
                  <span className={`text-sm font-bold ${style.text}`}>
                    {score}/9 · {t(`level_${level}`)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className={`h-full ${style.bar}`} style={{ width: `${(score / 9) * 100}%` }} />
                </div>
                <p className="mt-2 text-sm text-[var(--ink)]">{t(level === 'green' ? `praise_${area}` : `advice_${area}`)}</p>
              </div>
            )
          })}
        </div>

        <button type="button" onClick={startQuiz} className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/50 bg-white px-5 py-2.5 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--gold)]">
          <RotateCcw className="h-4 w-4" /> {t('retake')}
        </button>
      </section>

      {renderCheckup()}

      {/* Piano d'azione */}
      <section className="rounded-3xl border border-[var(--gold)]/30 bg-[var(--paper)] p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
          <ListChecks className="h-6 w-6 text-[var(--gold)]" /> {t('planTitle')}
        </h2>
        {goals.length === 0 ? (
          <p className="mt-2 text-[var(--muted)]">{t('planEmpty')}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('planIntro')}</p>
            <ul className="mt-4 space-y-2">
              {goals.map((goal) => {
                const done = goalsDone.includes(goal.key)
                const hasAmount = goal.amount !== undefined
                const text = hasAmount
                  ? t(`goal_${goal.key}`, { amount: money(goal.amount ?? 0), monthly: money(goal.monthly ?? 0) })
                  : t(['emergencyFund', 'saveAuto', 'cutWants'].includes(goal.key) ? `goal_${goal.key}_generic` : `goal_${goal.key}`)
                return (
                  <li key={goal.key}>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${done ? 'border-emerald-200 bg-emerald-50' : 'border-[var(--gold)]/20 bg-white hover:border-[var(--gold)]/50'}`}>
                      <input type="checkbox" checked={done} onChange={() => toggleGoal(goal.key)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--gold)]" />
                      <span className={`text-sm ${done ? 'text-emerald-800 line-through' : 'text-[var(--ink)]'}`}>{text}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <p className="mt-4 text-xs text-[var(--muted)]">{t('planRetakeHint')}</p>
      </section>

      {/* Storico */}
      {results.length > 1 && (
        <section className="rounded-3xl border border-[var(--gold)]/30 bg-[var(--paper)] p-6 shadow-sm sm:p-8">
          <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <TrendingUp className="h-6 w-6 text-[var(--gold)]" /> {t('historyTitle')}
          </h2>
          <ul className="mt-4 divide-y divide-[var(--gold)]/15">
            {results.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-[var(--muted)]">{date(row.created_at)}</span>
                <span className="flex-1 truncate font-medium text-[var(--ink)]">{t(`profile_${profileOf(row.total)}_name`)}</span>
                <span className="flex gap-1">
                  {row.area_scores.map((score, i) => (
                    <span key={i} title={t(`area_${FINCHECK_AREAS[i]}`)} className={`h-2.5 w-2.5 rounded-full ${LEVEL_STYLE[areaLevel(score)].dot}`} />
                  ))}
                </span>
                <span className="w-14 text-right font-bold text-[var(--ink)]">{row.total}/45</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )

  // ------------------------------------------------------------- check-up
  function renderCheckup() {
    return (
      <section className="rounded-3xl border border-[var(--gold)]/30 bg-[var(--paper)] p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
          <Gauge className="h-6 w-6 text-[var(--gold)]" /> {t('checkupTitle')}
        </h2>
        {!hasSpendly ? (
          <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-[var(--gold)]/20 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-sm text-[var(--ink)]">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" /> {t('checkupLocked')}
            </p>
            <Link href={{ pathname: '/billing' }} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--gold-bright)]">
              {t('checkupLockedCta')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : !checkup || checkup.status === 'noData' ? (
          <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-[var(--gold)]/20 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-sm text-[var(--ink)]">
              <PiggyBank className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" /> {t('checkupNoData')}
            </p>
            <Link href="/marketplace/spendly" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--gold-bright)]">
              {t('checkupNoDataCta')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          renderCheckupDetails(checkup)
        )}
      </section>
    )
  }

  function renderCheckupDetails(data: Extract<CheckupResult, { status: 'ok' }>) {
    const target10 = money(data.income * 0.1)
    const split = [
      { key: 'needs', value: data.needs, target: 50 },
      { key: 'wants', value: data.wants, target: 30 },
      { key: 'savingsShare', value: Math.max(data.savings, 0), target: 20 },
    ]
    return (
      <div className="mt-2">
        <p className="text-sm text-[var(--muted)]">{t('checkupIntro', { months: data.months })}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: t('kpiIncome'), value: data.income },
            { label: t('kpiExpenses'), value: data.expenses },
            { label: t('kpiSavings'), value: data.savings },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border border-[var(--gold)]/20 bg-white p-4">
              <p className="text-xs font-semibold text-[var(--muted)]">{kpi.label}</p>
              <p className={`mt-1 text-2xl font-bold ${kpi.value < 0 ? 'text-red-700' : 'text-[var(--ink)]'}`}>{money(kpi.value)}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-6 font-bold text-[var(--ink)]">{t('ruleTitle')}</h3>
        <p className="text-sm text-[var(--muted)]">{t('ruleText')}</p>
        <div className="mt-3 space-y-3">
          {split.map((row) => {
            const percent = data.income > 0 ? Math.round((row.value / data.income) * 100) : 0
            return (
              <div key={row.key}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-[var(--ink)]">{t(`split_${row.key}`)}</span>
                  <span className="text-[var(--muted)]">
                    {percent}% · {t('target', { percent: row.target })}
                  </span>
                </div>
                <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" style={{ width: `${Math.min(percent, 100)}%` }} />
                  <div className="absolute top-0 h-full w-0.5 bg-[var(--ink)]" style={{ left: `${row.target}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        <h3 className="mt-6 font-bold text-[var(--ink)]">{t('indicatorsTitle')}</h3>
        <ul className="mt-3 space-y-2">
          {data.indicators.map((ind) => {
            const style = LEVEL_STYLE[ind.level]
            return (
              <li key={ind.key} className={`rounded-xl border p-4 ${style.soft}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} /> {t(`ind_${ind.key}_name`)}
                  </p>
                  <span className={`text-sm font-bold ${style.text}`}>
                    {money(ind.amount)} · {ind.percent}%
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--ink)]">
                  {ind.level === 'green'
                    ? t(`ind_${ind.key}_ok`)
                    : t(`ind_${ind.key}_text`, {
                        amount: money(ind.amount),
                        percent: `${ind.percent}%`,
                        annual: money(ind.amount * 12),
                        target: target10,
                        cut: money(ind.amount * 0.1),
                      })}
                </p>
              </li>
            )
          })}
        </ul>

        {data.growing.length > 0 && (
          <>
            <h3 className="mt-6 flex items-center gap-2 font-bold text-[var(--ink)]">
              <Sparkles className="h-4 w-4 text-[var(--gold)]" /> {t('growingTitle')}
            </h3>
            <ul className="mt-2 space-y-2">
              {data.growing.map((g) => (
                <li key={g.category} className={`rounded-xl border p-3 text-sm text-[var(--ink)] ${LEVEL_STYLE[g.level].soft}`}>
                  {t('growingText', { category: spendlyT(SPENDLY_CATEGORY_KEY[g.category] ?? 'categoryAltro'), percent: `${g.percent}%` })}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }
}

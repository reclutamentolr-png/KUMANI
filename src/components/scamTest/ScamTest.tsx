'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, Clock, Flag, LifeBuoy, Lock, RotateCcw, ScanSearch, ShieldAlert, ShieldCheck, ShieldUser, UserPlus, UserX } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import DossierButton from '@/components/scamNet/DossierButton'
import { SCAM_QUESTIONS, SCAM_TEST_CARDS, SCAM_TEST_MAX, scamTestResult, type ScamAnswer, type ScamQuestion } from '@/lib/scamTest'

// «Mi stanno truffando?»: 5 schede da 3 domande, risultato con il livello di
// rischio, cosa fare subito se c'è già un danno, consigli per ogni «Sì», gli
// strumenti di KUMANI e il PDF. Le risposte restano nel browser (mai sul server).
// Chi non è iscritto vede subito il livello di rischio e, se serve, cosa fare
// subito; spiegazione, consigli, strumenti e PDF si sbloccano con l'iscrizione
// gratuita: le risposte si salvano nel browser e, dopo l'iscrizione o
// l'accesso, ?risultato=1 riapre il risultato completo senza rifare il test.
const SAVED_KEY = 'kumani_scam_test'
const RETURN_PATH = '/test-truffa?risultato=1'
const ANSWERS: ScamAnswer[] = ['no', 'maybe', 'yes']
const LEVEL_STYLE = {
  low: { box: 'border-emerald-300 bg-emerald-50 text-emerald-900', Icon: ShieldCheck, icon: 'text-emerald-600' },
  medium: { box: 'border-amber-300 bg-amber-50 text-amber-900', Icon: AlertTriangle, icon: 'text-amber-600' },
  high: { box: 'border-red-300 bg-red-50 text-red-900', Icon: ShieldAlert, icon: 'text-red-600' },
} as const

export default function ScamTest({ loggedIn }: { loggedIn: boolean }) {
  const t = useTranslations('scamTest')
  const locale = useLocale()
  const top = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(-1) // -1 = introduzione, 0..4 = schede, 5 = risultato
  const [answers, setAnswers] = useState<Partial<Record<ScamQuestion, ScamAnswer>>>({})
  const total = SCAM_TEST_CARDS.length

  // Ritorno dopo iscrizione o accesso: il risultato completo con le risposte salvate
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('risultato') !== '1') return
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? 'null') as Partial<Record<ScamQuestion, ScamAnswer>> | null
      if (saved && SCAM_QUESTIONS.every((q) => saved[q])) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lettura una tantum del browser
        setAnswers(saved)
        setStep(SCAM_TEST_CARDS.length)
      }
    } catch {
      // facoltativo
    }
  }, [])
  // Risultato raggiunto: le risposte restano nel browser per il ritorno
  useEffect(() => {
    if (step !== total) return
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(answers))
    } catch {
      // facoltativo
    }
  }, [step, total, answers])

  const go = (next: number) => {
    setStep(next)
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const answerLabel = (q: ScamQuestion, a: ScamAnswer) => (q === 'search' ? t(`search_${a}`) : t(`answer_${a}`))

  if (step === -1)
    return (
      <div ref={top} className="scroll-mt-[calc(var(--hub-bottom,4rem)+1rem)] rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-[var(--ink)]">{t('howTitle')}</h2>
        <p className="mt-2 text-[var(--muted)]">{t('howText')}</p>
        <ul className="mt-4 grid gap-2 text-sm text-[var(--ink)] sm:grid-cols-2">
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--gold)]" aria-hidden /> {t('howCards', { cards: total, questions: SCAM_QUESTIONS.length })}</li>
          <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-[var(--gold)]" aria-hidden /> {t('howTime')}</li>
          <li className="flex items-center gap-2"><UserX className="h-4 w-4 text-[var(--gold)]" aria-hidden /> {t('howAnonymous')}</li>
          <li className="flex items-center gap-2"><ShieldUser className="h-4 w-4 text-[var(--gold)]" aria-hidden /> {loggedIn ? t('howPdf') : t('howSignup')}</li>
        </ul>
        <p className="mt-4 rounded-xl bg-[var(--gold)]/10 px-4 py-3 text-sm text-[var(--ink)]">{t('disclaimer')}</p>
        <button type="button" onClick={() => go(0)} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-6 font-bold text-[var(--gold-bright)] sm:w-auto">
          {t('start')} <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    )

  if (step < total) {
    const card = SCAM_TEST_CARDS[step]
    const complete = card.questions.every((q) => answers[q])
    return (
      <div ref={top} className="scroll-mt-[calc(var(--hub-bottom,4rem)+1rem)] space-y-4">
        <div>
          <div className="flex justify-between text-sm text-[var(--muted)]">
            <span>{t('progress', { n: step + 1, total })}</span>
            <span>{Math.round((step / total) * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--gold)]/15">
            <div className="h-full rounded-full bg-[var(--gold)] transition-all" style={{ width: `${(step / total) * 100}%` }} />
          </div>
        </div>
        <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold text-[var(--ink)]">{t(`card_${card.key}`)}</h2>
          <ol className="mt-4 space-y-5">
            {card.questions.map((q) => (
              <li key={q}>
                <p className="font-semibold leading-snug text-[var(--ink)]">{t(`q_${q}`)}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t(`q_${q}`)}>
                  {ANSWERS.map((a) => {
                    const on = answers[q] === a
                    return (
                      <button
                        key={a}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q]: a }))}
                        className={`min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${on ? 'border-[var(--ink)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-gray-200 text-gray-700 hover:border-[var(--gold)]'}`}
                      >
                        {answerLabel(q, a)}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex items-center justify-between gap-3">
            <button type="button" onClick={() => go(step - 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 font-semibold text-gray-600 hover:bg-black/5">
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t('back')}
            </button>
            <button type="button" disabled={!complete} onClick={() => go(step + 1)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--ink)] px-5 font-bold text-[var(--gold-bright)] disabled:opacity-40">
              {step === total - 1 ? t('seeResult') : t('next')} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {!complete && <p className="mt-2 text-right text-xs text-[var(--muted)]">{t('answerAll')}</p>}
        </section>
      </div>
    )
  }

  const r = scamTestResult(answers)
  const style = LEVEL_STYLE[r.level]
  const LevelIcon = style.Icon
  const tools = [
    { href: '/controlla', icon: ScanSearch, key: 'toolCheck' },
    { href: '/marketplace/rete-antitruffa?tab=segnala', icon: Flag, key: 'toolReport' },
    ...(r.dataGiven ? [{ href: '/marketplace/scudo-dati', icon: ShieldUser, key: 'toolData' }] : []),
    { href: '/manuale-antitruffa', icon: BookOpenCheck, key: 'toolManual' },
  ]
  return (
    <div ref={top} className="scroll-mt-[calc(var(--hub-bottom,4rem)+1rem)] space-y-4">
      <section className={`rounded-2xl border-2 p-5 sm:p-6 ${style.box}`} aria-live="polite">
        <p className="flex items-center gap-3 text-2xl font-extrabold">
          <LevelIcon className={`h-8 w-8 shrink-0 ${style.icon}`} aria-hidden /> {t(`level_${r.level}`)}
        </p>
        <p className="mt-1 text-sm font-semibold opacity-80">{t('score', { score: r.score, max: SCAM_TEST_MAX })}</p>
        {loggedIn && <p className="mt-3 leading-relaxed">{t(r.damage ? 'desc_damage' : `desc_${r.level}`)}</p>}
      </section>

      {(r.damage || r.remote) && (
        <section className="rounded-2xl border-2 border-red-400 bg-white p-5 shadow-sm sm:p-6" role="alert">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-red-700">
            <ShieldAlert className="h-5 w-5" aria-hidden /> {t('urgentTitle')}
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[var(--ink)]">
            {r.damage && <li>{t('urgent_bank')}</li>}
            {r.remote && <li>{t('urgent_remote')}</li>}
            {r.damage && <li>{t('urgent_passwords')}</li>}
            {r.damage && <li>{t('urgent_police')}</li>}
            {locale === 'it' && r.damage && <li>{t('urgent_postale')}</li>}
            <li>{t('urgent_evidence')}</li>
          </ol>
        </section>
      )}

      {/* Non iscritti: livello e passi urgenti sono sempre visibili; il resto con l'iscrizione gratuita */}
      {!loggedIn && (
        <section className="rounded-2xl border-2 border-[var(--gold)] bg-[var(--ink)] p-5 text-white shadow-sm sm:p-6">
          <p className="flex items-center gap-2 text-lg font-extrabold text-[var(--gold-bright)]">
            <Lock className="h-5 w-5" aria-hidden /> {t('gateTitle')}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/80">{t('gateText')}</p>
          <ul className="mt-3 space-y-1 text-sm text-white/90">
            {(['gateItem1', 'gateItem2', 'gateItem3'] as const).map((k) => (
              <li key={k} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" aria-hidden /> {t(k)}
              </li>
            ))}
          </ul>
          <Link
            href={`/register?da=test-truffa`}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 font-bold text-[var(--ink)]"
          >
            <UserPlus className="h-5 w-5" aria-hidden /> {t('gateCta')}
          </Link>
          <Link href={`/login?next=${encodeURIComponent(RETURN_PATH)}`} className="mt-3 block text-center text-sm text-white/75 underline-offset-2 hover:text-white hover:underline">
            {t('gateLogin')}
          </Link>
        </section>
      )}

      {loggedIn && r.tips.length > 0 && (
        <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('tipsTitle')}</h2>
          <ul className="mt-3 space-y-2">
            {r.tips.map((q) => (
              <li key={q} className="flex gap-2 text-[var(--ink)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden /> <span>{t(`tip_${q}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {loggedIn && r.tips.length === 0 && (
        <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('tipsTitle')}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[var(--ink)]">
            <li>{t('safe_links')}</li>
            <li>{t('safe_update')}</li>
            <li>{t('safe_ask')}</li>
          </ul>
        </section>
      )}

      {loggedIn && (
      <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t('toolsTitle')}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {tools.map(({ href, icon: Icon, key }) => (
            <li key={key}>
              <Link href={href} className="flex h-full items-start gap-3 rounded-xl border border-gray-200 p-3 hover:border-[var(--gold)]">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" aria-hidden />
                <span>
                  <span className="block font-bold text-[var(--ink)]">{t(`${key}`)}</span>
                  <span className="block text-sm text-[var(--muted)]">{t(`${key}_text`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      )}

      <section className="flex flex-col gap-3 rounded-2xl bg-[var(--ink)] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="flex items-center gap-2 font-bold text-[var(--gold-bright)]">
            <LifeBuoy className="h-5 w-5" aria-hidden /> {t('staffTitle')}
          </p>
          <p className="mt-1 text-sm text-white/80">{t('staffText')}</p>
        </div>
        <Link href="/contact" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-bright)] px-5 font-bold text-[var(--ink)]">
          {t('staffCta')}
        </Link>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        {loggedIn && (
        <DossierButton
          build={() => ({
            tool: t('pdfTool'),
            subject: t(`level_${r.level}`),
            verdict: { status: r.level === 'high' ? 'risk' : r.level === 'medium' ? 'warning' : 'ok', text: t(r.damage ? 'desc_damage' : `desc_${r.level}`), score: `${r.score}/${SCAM_TEST_MAX}` },
            rows: SCAM_QUESTIONS.map((q) => ({
              label: t(`q_${q}`),
              value: answerLabel(q, answers[q] ?? 'no'),
              status: answers[q] === 'yes' ? 'risk' : answers[q] === 'maybe' ? 'warning' : 'ok',
            })),
            advice: [...(r.damage ? [t('urgent_bank'), t('urgent_police')] : []), ...(r.remote ? [t('urgent_remote')] : []), ...r.tips.map((q) => t(`tip_${q}`))],
          })}
        />
        )}
        <button
          type="button"
          onClick={() => {
            setAnswers({})
            go(0)
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 font-semibold text-[var(--ink)]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> {t('retake')}
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">{t('disclaimer')}</p>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarClock, Check, LoaderCircle, Rainbow, RotateCcw, Shield, Sparkles, X } from 'lucide-react'
import { claimScamCard, type ScamCardOwned } from '@/app/actions/scamCards'
import { GREEN_SHIELD_CAPTURES, SCAM_CARDS, SHIELDS, type ScamCard } from '@/lib/scamCards/cards'
import ScamCardView from './ScamCardView'
import ShareCardButton from './ShareCardButton'

// Album delle Carte Antitruffa: le 20 carte, quelle prese e quelle da
// prendere. Toccando una carta la si legge (fronte e retro); per prenderla
// si risponde alle sue 3 domande. Chi sbaglia riprova quella carta domani.

type Filter = 'all' | 'missing' | 'mine'

const SHIELD_COLORS: Record<(typeof SHIELDS)[number]['key'], string> = { bronze: '#b07a45', silver: '#a9b0b8', gold: '#e7c56a' }

// Ordine delle risposte mescolato, ma sempre lo stesso per la stessa domanda
function shuffled(cardNo: number, qIndex: number): number[] {
  const order = [0, 1, 2]
  let seed = cardNo * 31 + qIndex * 7
  for (let i = order.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280
    const j = seed % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export default function ScamCardsApp({
  initialOwned,
  initialFailedToday,
  monthCard,
  inviteCode,
  firstName,
}: {
  initialOwned: ScamCardOwned[]
  initialFailedToday: number[]
  // Carta del mese scelta dallo Staff (cornice arcobaleno se presa ora)
  monthCard: number | null
  inviteCode: string | null
  firstName: string | null
}) {
  const t = useTranslations('scamCards')
  const locale = useLocale()
  const month = SCAM_CARDS.find((c) => c.no === monthCard) ?? null
  const finderOf = (c: ScamCardOwned | undefined | null) =>
    c?.rarity === 'rara' && c.rareAt && firstName
      ? t('finder', { name: firstName, date: new Date(c.rareAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })
      : null
  const [owned, setOwned] = useState(() => new Map(initialOwned.map((c) => [c.no, c])))
  const [failedToday, setFailedToday] = useState(() => new Set(initialFailedToday))
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<ScamCard | null>(null)

  const count = owned.size
  // Truffe fermate davvero con un controllo (cornice verde)
  const captured = [...owned.values()].filter((c) => c.rarity === 'catturata').length
  const nextShield = SHIELDS.find((sh) => count < sh.cards)
  const visible = SCAM_CARDS.filter((c) => (filter === 'all' ? true : filter === 'mine' ? owned.has(c.no) : !owned.has(c.no)))

  return (
    <div className="space-y-6">
      {/* Avanzamento e scudi */}
      <section className="rounded-3xl bg-[var(--ink)] p-5 text-white sm:p-6" aria-label={t('progressAria')}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-extrabold tabular-nums text-[var(--gold-bright)]">{t('count', { count, total: SCAM_CARDS.length })}</p>
            <p className="mt-1 text-sm text-white/75">{nextShield ? t('nextShield', { missing: nextShield.cards - count, shield: t(`shield_${nextShield.key}`) }) : t('allCards')}</p>
          </div>
          <div className="flex gap-3">
            {SHIELDS.map((sh) => {
              const on = count >= sh.cards
              return (
                <div key={sh.key} className={`flex flex-col items-center gap-1 ${on ? '' : 'opacity-35'}`} title={t(`shield_${sh.key}`)}>
                  <Shield className="h-9 w-9" fill={on ? SHIELD_COLORS[sh.key] : 'transparent'} stroke={SHIELD_COLORS[sh.key]} aria-hidden />
                  <span className="text-[11px] font-bold">{sh.cards}</span>
                  <span className="sr-only">
                    {t(`shield_${sh.key}`)}: {on ? t('shieldOn') : t('shieldOff')}
                  </span>
                </div>
              )
            })}
            <div className={`flex flex-col items-center gap-1 border-l border-white/15 pl-3 ${captured >= GREEN_SHIELD_CAPTURES ? '' : 'opacity-35'}`} title={t('shieldGreenHint')}>
              <Shield className="h-9 w-9" fill={captured >= GREEN_SHIELD_CAPTURES ? '#34d399' : 'transparent'} stroke="#34d399" aria-hidden />
              <span className="text-[11px] font-bold tabular-nums">
                {Math.min(captured, GREEN_SHIELD_CAPTURES)}/{GREEN_SHIELD_CAPTURES}
              </span>
              <span className="sr-only">
                {t('shield_green')}: {captured >= GREEN_SHIELD_CAPTURES ? t('shieldOn') : t('shieldOff')}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] transition-all" style={{ width: `${(count / SCAM_CARDS.length) * 100}%` }} />
        </div>
      </section>

      {month && (
        <button
          type="button"
          onClick={() => setOpen(month)}
          className="flex w-full items-center gap-4 rounded-3xl bg-[conic-gradient(from_210deg,#f6a6c8,#f7d97a,#9fe3c5,#8fc4f5,#c9a6f2,#f6a6c8)] p-[3px] text-left"
        >
          <span className="flex w-full items-center gap-4 rounded-[calc(1.5rem-3px)] bg-white p-4">
            <Rainbow className="h-8 w-8 shrink-0 text-violet-500" aria-hidden />
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-[0.14em] text-violet-600">{t('monthEyebrow')}</span>
              <span className="block text-lg font-extrabold text-[var(--ink)]">{month.name}</span>
              <span className="block text-sm text-[var(--muted)]">{owned.get(month.no)?.rarity === 'mese' ? t('monthDone') : t('monthText')}</span>
            </span>
          </span>
        </button>
      )}

      <p className="max-w-2xl text-sm text-[var(--muted)]">{t('howTo')}</p>
      <p className="max-w-2xl rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{t('captureHowTo')}</p>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('filterAria')}>
        {(['all', 'missing', 'mine'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-10 rounded-full border px-4 text-sm font-bold ${filter === f ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--paper)]'}`}
          >
            {t(`filter_${f}`)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-[var(--muted)]">{filter === 'mine' ? t('emptyMine') : t('emptyMissing')}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] justify-items-center gap-x-3 gap-y-5">
          {visible.map((card) => {
            const mine = owned.get(card.no)
            return (
              <li key={card.no} className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpen(card)}
                  className="rounded-[10px] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
                  aria-label={t('openAria', { name: card.name })}
                >
                  <ScamCardView card={card} width={150} missing={!mine} rarity={mine?.rarity} finder={finderOf(mine)} uid={`g${card.no}`} />
                </button>
                <span className={`text-xs font-bold ${mine ? 'text-emerald-700' : failedToday.has(card.no) ? 'text-amber-700' : 'text-[var(--muted)]'}`}>
                  {mine?.rarity === 'rara'
                    ? t('rare')
                    : mine?.rarity === 'mese'
                      ? t('monthLabel')
                      : mine?.rarity === 'catturata'
                        ? t('captured')
                        : mine
                          ? t('taken')
                          : failedToday.has(card.no)
                            ? t('tomorrow')
                            : t('toTake')}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {open && (
        <CardSheet
          card={open}
          mine={owned.get(open.no) ?? null}
          finder={finderOf(owned.get(open.no))}
          ofTheMonth={open.no === monthCard}
          inviteCode={inviteCode}
          failedToday={failedToday.has(open.no)}
          onClose={() => setOpen(null)}
          onTaken={(c) => setOwned((prev) => new Map(prev).set(c.no, c))}
          onFailed={(no) => setFailedToday((prev) => new Set(prev).add(no))}
        />
      )}
    </div>
  )
}

type Step = { kind: 'read' } | { kind: 'quiz'; index: number; answers: number[]; picked: number | null } | { kind: 'saving' } | { kind: 'won' } | { kind: 'lost'; wrong: number } | { kind: 'error' }

function CardSheet({
  card,
  mine,
  finder,
  ofTheMonth,
  inviteCode,
  failedToday,
  onClose,
  onTaken,
  onFailed,
}: {
  card: ScamCard
  mine: ScamCardOwned | null
  finder: string | null
  ofTheMonth: boolean
  inviteCode: string | null
  failedToday: boolean
  onClose: () => void
  onTaken: (c: ScamCardOwned) => void
  onFailed: (no: number) => void
}) {
  const t = useTranslations('scamCards')
  const [flipped, setFlipped] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'read' })
  const [width, setWidth] = useState(280)

  // Carta grande quanto lo schermo lascia (fino a 300 px)
  useEffect(() => {
    const fit = () => setWidth(Math.max(220, Math.min(300, window.innerWidth - 64)))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const finish = async (answers: number[]) => {
    const wrong = card.quiz.filter((q, i) => answers[i] !== q.correct).length
    setStep({ kind: 'saving' })
    const res = await claimScamCard(card.no, answers)
    if (res.success) {
      onTaken(res.card)
      setStep({ kind: 'won' })
    } else if (res.message === 'wrong' || res.message === 'tryTomorrow') {
      onFailed(card.no)
      setStep({ kind: 'lost', wrong: Math.max(1, wrong) })
    } else setStep({ kind: 'error' })
  }

  const quiz = step.kind === 'quiz' ? step : null
  const question = quiz ? card.quiz[quiz.index] : null
  const order = useMemo(() => (quiz ? shuffled(card.no, quiz.index) : []), [card.no, quiz])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--paper)] p-5 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]">{card.animal}</p>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100" aria-label={t('close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {!question && (
          <div className="flex flex-col items-center gap-3">
            <button type="button" onClick={() => setFlipped((f) => !f)} className="[perspective:1200px]" aria-label={flipped ? t('showFront') : t('showBack')}>
              <ScamCardView card={card} width={width} flipped={flipped} rarity={mine?.rarity} finder={finder} uid={`s${card.no}`} />
            </button>
            <button type="button" onClick={() => setFlipped((f) => !f)} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[var(--ink)] underline underline-offset-4">
              <RotateCcw className="h-4 w-4" aria-hidden /> {flipped ? t('showFront') : t('showBack')}
            </button>
          </div>
        )}

        {step.kind === 'read' &&
          (mine && !(ofTheMonth && mine.rarity === 'oro') ? (
            <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-800">
              <Check className="h-5 w-5 shrink-0" aria-hidden />{' '}
              {mine.rarity === 'rara' ? t('rareMine') : mine.rarity === 'mese' ? t('monthMine') : mine.rarity === 'catturata' ? t('capturedMine') : t('alreadyMine')}
            </p>
          ) : failedToday ? (
            <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-900">
              <CalendarClock className="h-5 w-5 shrink-0" aria-hidden /> {t('tryTomorrow')}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setStep({ kind: 'quiz', index: 0, answers: [], picked: null })}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 font-bold text-[var(--gold-bright)]"
            >
              <Sparkles className="h-5 w-5" aria-hidden /> {mine ? t('takeMonth') : t('takeCard')}
            </button>
          ))}

        {step.kind === 'read' && <ShareCardButton card={card} inviteCode={inviteCode} className="mt-3 w-full" />}

        {quiz && question && (
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{t('questionOf', { n: quiz.index + 1, total: card.quiz.length })}</p>
            <h3 className="text-lg font-extrabold leading-snug text-[var(--ink)]">{question.q}</h3>
            <div className="space-y-2">
              {order.map((optionIndex) => {
                const picked = quiz.picked !== null
                const right = optionIndex === question.correct
                const chosen = quiz.picked === optionIndex
                return (
                  <button
                    key={optionIndex}
                    type="button"
                    disabled={picked}
                    onClick={() => setStep({ ...quiz, picked: optionIndex })}
                    className={`flex min-h-12 w-full items-center gap-2 rounded-2xl border px-4 py-2 text-left text-[15px] font-semibold ${
                      !picked
                        ? 'border-[var(--gold)]/40 bg-white hover:bg-[var(--gold-pale)]'
                        : right
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : chosen
                            ? 'border-red-400 bg-red-50 text-red-800'
                            : 'border-gray-200 bg-white text-gray-400'
                    }`}
                  >
                    {picked && right && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                    {picked && chosen && !right && <X className="h-4 w-4 shrink-0" aria-hidden />}
                    {question.options[optionIndex]}
                  </button>
                )
              })}
            </div>
            {quiz.picked !== null && (
              <div className="space-y-3">
                <p className={`text-sm font-bold ${quiz.picked === question.correct ? 'text-emerald-700' : 'text-red-700'}`} role="status">
                  {quiz.picked === question.correct ? t('right') : t('wrongShown')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const answers = [...quiz.answers, quiz.picked!]
                    if (quiz.index + 1 < card.quiz.length) setStep({ kind: 'quiz', index: quiz.index + 1, answers, picked: null })
                    else finish(answers)
                  }}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--ink)] px-5 font-bold text-[var(--gold-bright)]"
                >
                  {quiz.index + 1 < card.quiz.length ? t('next') : t('finish')}
                </button>
              </div>
            )}
          </div>
        )}

        {step.kind === 'saving' && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-[var(--muted)]">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> {t('saving')}
          </p>
        )}
        {step.kind === 'won' && (
          <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-center text-base font-extrabold text-emerald-800" role="status">
            {t('won')}
          </p>
        )}
        {(step.kind === 'lost' || step.kind === 'error') && (
          <div className="mt-4 space-y-3">
            <p className="rounded-2xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-900" role="status">
              {step.kind === 'lost' ? t('lost', { count: step.wrong }) : t('error')}
            </p>
            <button
              type="button"
              onClick={() => {
                setFlipped(step.kind === 'lost')
                setStep({ kind: 'read' })
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 font-bold text-[var(--gold-bright)]"
            >
              <RotateCcw className="h-5 w-5" aria-hidden /> {t('readAgain')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Angry, AudioWaveform, Brain, Check, ChevronDown, ChevronUp, Flame, Frown, Gift, Laugh, LoaderCircle, Lock, Meh, Moon, Palette, PersonStanding, Smile, Sparkles, Wind } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { claimWellnessBonus, setWellnessMood, type WellnessToday } from '@/app/actions/ecosystem'
import WellnessPause from './WellnessPause'
import WellnessGratitude from './WellnessGratitude'

// «Il tuo momento di benessere»: basta un passo al giorno.
// - Passi verificati (respiro, concentrazione, mente, pausa di un minuto):
//   +KU Karma per passo fino a 3, da ritirare man mano.
// - «Come stai oggi?» e «Una cosa bella»: contano per la serie, senza KU Karma.
// - Routine della sera: NeuroBalance pronto con la sessione per dormire.
// Un passo «consigliato oggi» cambia ogni giorno tra quelli non ancora fatti.
const MOODS = [
  { value: 1, Icon: Angry, tone: 'text-red-600' },
  { value: 2, Icon: Frown, tone: 'text-orange-500' },
  { value: 3, Icon: Meh, tone: 'text-amber-500' },
  { value: 4, Icon: Smile, tone: 'text-lime-600' },
  { value: 5, Icon: Laugh, tone: 'text-emerald-600' },
] as const
const MOOD_DOT = ['', 'bg-red-500', 'bg-orange-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500']

type StepKey = 'breath' | 'focus' | 'mind' | 'pause'
const ROTATION: StepKey[] = ['pause', 'breath', 'mind', 'focus']

// Chiusa in una riga che si apre (dashboard): si ricorda se la si è lasciata
// aperta; il link #benessere (es. «Fai la pausa» dei primi passi) la apre
const OPEN_KEY = 'kumani_wellness_open'

export default function WellnessTodayCard({ initial }: { initial: WellnessToday }) {
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let remembered = false
    try {
      remembered = localStorage.getItem(OPEN_KEY) === '1'
    } catch {
      // memoria del browser non disponibile
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (remembered || window.location.hash === '#benessere') setExpanded(true)
    const onHash = () => window.location.hash === '#benessere' && setExpanded(true)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const toggle = (open: boolean) => {
    setExpanded(open)
    try {
      localStorage.setItem(OPEN_KEY, open ? '1' : '0')
    } catch {
      // facoltativo
    }
  }

  const t = useTranslations('ecosystem')
  const locale = useLocale()
  const [state, setState] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [given, setGiven] = useState<number | null>(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [note, setNote] = useState(initial.mood_note ?? '')
  const [moodSaving, setMoodSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  // La faccina si corregge solo nei primi 2 minuti, poi resta fissa fino a domani
  const [moodLocked, setMoodLocked] = useState(false)
  useEffect(() => {
    if (!state.mood || !state.mood_lock_at) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMoodLocked(false)
      return
    }
    const wait = Date.parse(state.mood_lock_at) - Date.now()
    if (wait <= 0) {
      setMoodLocked(true)
      return
    }
    setMoodLocked(false)
    const timer = setTimeout(() => setMoodLocked(true), wait)
    return () => clearTimeout(timer)
  }, [state.mood, state.mood_lock_at])

  const steps: { key: StepKey; done: boolean; label: string; hint: string; time: string; Icon: typeof Wind; links: { href: string; label: string; Icon: typeof Wind }[] }[] = [
    { key: 'breath', done: state.breath, label: t('wellnessBreath'), hint: t('wellnessBreathHint'), time: t('wellnessTimeBreath'), Icon: Wind, links: [{ href: '/marketplace/oxygen', label: 'Oxygen', Icon: Wind }] },
    { key: 'pause', done: state.pause, label: t('wellnessPause'), hint: t('wellnessPauseHint'), time: t('wellnessTimePause'), Icon: PersonStanding, links: [] },
    {
      key: 'mind',
      done: state.mind,
      label: t('wellnessMind'),
      hint: t('wellnessMindHint'),
      time: t('wellnessTimeMind'),
      Icon: Palette,
      links: [
        { href: '/marketplace/mandala', label: 'Mandala', Icon: Palette },
        { href: '/marketplace/neurobalance', label: 'NeuroBalance', Icon: AudioWaveform },
      ],
    },
    { key: 'focus', done: state.focus, label: t('wellnessFocus'), hint: t('wellnessFocusHint'), time: t('wellnessTimeFocus'), Icon: Brain, links: [{ href: '/marketplace/focus', label: 'Focus', Icon: Brain }] },
  ]

  // Il consigliato di oggi: la rotazione parte da un passo diverso ogni giorno
  // (data del server, uguale per pagina e browser) e salta quelli già fatti
  const today = state.week[state.week.length - 1]?.day ?? '2026-01-01'
  const dayNumber = Math.floor(Date.parse(`${today.slice(0, 10)}T00:00:00Z`) / 86_400_000)
  const order = ROTATION.map((_, i) => ROTATION[(i + dayNumber) % ROTATION.length])
  const suggested = order.find((key) => !steps.find((s) => s.key === key)?.done) ?? null

  const maxKu = state.max_steps * state.step_ku
  const apply = useCallback((next: WellnessToday | null) => next && setState(next), [])

  const claim = async () => {
    setBusy(true)
    const result = await claimWellnessBonus()
    setBusy(false)
    if (result) {
      setState(result)
      if (result.given) setGiven(result.given)
    }
  }

  const chooseMood = async (mood: number) => {
    setMoodSaving(true)
    apply(await setWellnessMood(mood, note))
    setMoodSaving(false)
  }

  const saveNote = async () => {
    if (!state.mood) return
    setMoodSaving(true)
    const result = await setWellnessMood(state.mood, note)
    apply(result)
    setMoodSaving(false)
    if (result) setNoteSaved(true)
  }

  const weekday = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
  // Settimana in corso, da lunedì a domenica (gli ultimi 7 giorni del server
  // la coprono sempre fino a oggi); i giorni che devono arrivare restano vuoti
  const todayIso = today.slice(0, 10)
  const moodByDay = new Map(state.week.map((d) => [d.day.slice(0, 10), d.mood]))
  const todayMs = Date.parse(`${todayIso}T00:00:00Z`)
  const mondayMs = todayMs - ((new Date(todayMs).getUTCDay() + 6) % 7) * 86_400_000
  const thisWeek = Array.from({ length: 7 }, (_, i) => {
    const iso = new Date(mondayMs + i * 86_400_000).toISOString().slice(0, 10)
    return { day: iso, mood: moodByDay.get(iso) ?? null, future: iso > todayIso, isToday: iso === todayIso }
  })

  if (!expanded)
    return (
      <section id="benessere" className="scroll-mt-24">
        <button
          type="button"
          onClick={() => toggle(true)}
          aria-expanded={false}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white px-4 py-3.5 text-left shadow-sm transition hover:border-teal-400"
        >
          <span className="min-w-0">
            <span className="block font-bold text-[var(--ink)]">{t('wellnessTitle')}</span>
            <span className="block text-xs font-semibold text-teal-700">
              {state.steps > 0 ? t('wellnessCollapsedDone', { done: Math.min(state.steps, state.max_steps), max: state.max_steps }) : t('wellnessCollapsedHint')}
              {state.streak > 0 && <> · {t('wellnessStreak', { count: state.streak })}</>}
            </span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-teal-700" aria-hidden />
        </button>
      </section>
    )

  return (
    <section id="benessere" className="scroll-mt-24 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => toggle(false)} aria-expanded className="flex items-center gap-1.5 text-left text-lg font-bold text-[var(--ink)]">
          {t('wellnessTitle')} <ChevronUp className="h-5 w-5 text-teal-700" aria-hidden />
        </button>
        {state.streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
            <Flame className="h-3.5 w-3.5" /> {t('wellnessStreak', { count: state.streak })}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">{state.counted ? t('wellnessDoneToday') : t('wellnessIntro', { ku: state.step_ku, max: maxKu })}</p>

      {/* Come stai oggi? */}
      <div className="mb-4 rounded-xl border border-teal-200 bg-white p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[var(--ink)]">{t('wellnessMoodTitle')}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {!state.mood ? t('wellnessMoodHint') : moodLocked ? t('wellnessMoodLockedHint') : t('wellnessMoodCorrectHint')}
            </p>
          </div>
          {/* La settimana: un pallino per giorno */}
          <div className="flex items-end gap-1.5" aria-label={t('wellnessMoodWeek')} role="img">
            {thisWeek.map((d) => (
              <span key={d.day} className="flex flex-col items-center gap-1">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${d.mood ? MOOD_DOT[d.mood] : d.future ? 'border border-dashed border-gray-300' : 'bg-gray-200'} ${d.isToday ? 'ring-2 ring-teal-300 ring-offset-1' : ''}`}
                  title={d.mood ? t(`wellnessMood${d.mood}`) : ''}
                />
                <span className={`text-[10px] font-semibold uppercase ${d.isToday ? 'text-teal-700' : 'text-[var(--muted)]'}`}>{weekday(d.day)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1 sm:gap-1.5" role="radiogroup" aria-label={t('wellnessMoodTitle')}>
          {MOODS.map(({ value, Icon, tone }) => {
            const active = state.mood === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={t(`wellnessMood${value}`)}
                disabled={moodSaving || (moodLocked && !active)}
                onClick={() => !active && !moodLocked && chooseMood(value)}
                className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-2 text-center text-[11px] font-semibold leading-tight transition ${
                  active ? 'border-teal-500 bg-teal-50 text-[var(--ink)] ring-2 ring-teal-200' : moodLocked ? 'border-gray-100 text-[var(--muted)] opacity-40' : 'border-gray-200 text-[var(--muted)] hover:border-teal-300'
                }`}
              >
                <Icon className={`h-6 w-6 ${tone}`} strokeWidth={active ? 2.4 : 1.8} />
                {/* Sui telefoni stretti solo la faccina: il nome scelto è scritto sotto */}
                <span className="hidden sm:block">{t(`wellnessMood${value}`)}</span>
              </button>
            )
          })}
        </div>
        {state.mood && (
          <p className="mt-1.5 flex items-center justify-center gap-1 text-xs font-bold text-teal-800">
            {moodLocked && <Lock className="h-3 w-3" aria-hidden />}
            <span className={moodLocked ? '' : 'sm:hidden'}>{moodLocked ? t('wellnessMoodLocked', { mood: t(`wellnessMood${state.mood}`) }) : t(`wellnessMood${state.mood}`)}</span>
          </p>
        )}
        {state.mood && (
          <form
            className="mt-2.5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void saveNote()
            }}
          >
            <label htmlFor="wellness-mood-note" className="sr-only">
              {t('wellnessMoodNote')}
            </label>
            <input
              id="wellness-mood-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setNoteSaved(false)
              }}
              maxLength={280}
              placeholder={t('wellnessMoodNote')}
              className="min-w-0 flex-1 rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="submit"
              disabled={moodSaving || note.trim() === (state.mood_note ?? '')}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-teal-300 px-3 text-sm font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-40"
            >
              {moodSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : noteSaved ? <Check className="h-4 w-4" /> : null}
              {noteSaved ? t('wellnessMoodSaved') : t('wellnessMoodSave')}
            </button>
          </form>
        )}
      </div>

      {/* Passi verificati */}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(({ key, done, label, hint, time, Icon, links }) => (
          <li
            key={key}
            className={`relative flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-sm ${
              done ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : suggested === key ? 'border-teal-400 bg-white text-[var(--ink)] ring-2 ring-teal-100' : 'border-teal-200 bg-white text-[var(--ink)]'
            }`}
          >
            {suggested === key && !done && (
              <span className="inline-flex items-center gap-1 self-start rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <Sparkles className="h-3 w-3" /> {t('wellnessSuggested')}
              </span>
            )}
            <span className="flex items-center gap-3 font-semibold">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : 'bg-teal-100 text-teal-700'}`}>
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                {label}
                <span className={`block text-[11px] font-semibold ${done ? 'text-emerald-700' : 'text-teal-700'}`}>{time}</span>
              </span>
            </span>
            <span className={`text-xs ${done ? 'text-emerald-700' : 'text-[var(--muted)]'}`}>{done ? t('wellnessStepDone') : hint}</span>
            {!done && (
              <span className="mt-auto flex flex-wrap gap-1.5">
                {key === 'pause' ? (
                  <button
                    type="button"
                    onClick={() => setPauseOpen(true)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-bold text-white transition hover:bg-teal-700"
                  >
                    <PersonStanding className="h-3.5 w-3.5" /> {t('wellnessPauseStart')}
                  </button>
                ) : (
                  links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-teal-200 px-2.5 text-xs font-bold text-teal-800 transition hover:border-teal-400 hover:bg-teal-50"
                    >
                      <link.Icon className="h-3.5 w-3.5" /> {t('wellnessOpen', { tool: link.label })}
                    </Link>
                  ))
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* KU Karma dei passi */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[var(--muted)]">
          {t('wellnessProgress', { count: state.steps })} · {t('wellnessKarmaSoFar', { got: state.awarded, max: maxKu })}
        </span>
        {state.claimable > 0 ? (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-40"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {t('wellnessClaim', { bonus: state.claimable })}
          </button>
        ) : given ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <Check className="h-4 w-4" /> {t('wellnessAwarded', { bonus: given })}
          </span>
        ) : state.awarded >= maxKu ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <Check className="h-4 w-4" /> {t('wellnessMaxReached', { bonus: maxKu })}
          </span>
        ) : null}
      </div>

      {/* Cose belle e routine della sera */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <WellnessGratitude state={state} onChange={setState} />
        <div className="flex flex-col gap-2.5 rounded-xl bg-[var(--ink)] p-3.5 text-white">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Moon className="h-4 w-4 text-[var(--gold-bright)]" /> {t('wellnessEveningTitle')}
          </p>
          <p className="text-xs leading-snug text-white/70">{t('wellnessEveningText')}</p>
          <Link
            href="/marketplace/neurobalance?sera=1"
            className="mt-auto inline-flex min-h-10 items-center justify-center gap-1.5 self-start rounded-lg bg-[var(--gold)] px-3.5 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-bright)]"
          >
            <AudioWaveform className="h-4 w-4" /> {t('wellnessEveningCta')}
          </Link>
        </div>
      </div>

      {pauseOpen && <WellnessPause onClose={() => setPauseOpen(false)} onDone={apply} />}
    </section>
  )
}

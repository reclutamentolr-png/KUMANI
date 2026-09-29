'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Bell,
  BellOff,
  BellRing,
  ChevronDown,
  Coffee,
  Lightbulb,
  Minus,
  MonitorSmartphone,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Smartphone,
  Target,
  Timer,
  Wind,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { completeFocusSession } from '@/app/actions/focus'
import {
  DEFAULT_SETTINGS,
  LIMITS,
  SESSIONS_PER_CYCLE,
  addFocusSession,
  clamp,
  durationsFor,
  loadSettings,
  loadTodayStats,
  saveSettings,
  type Durations,
  type FocusSettings,
  type PresetId,
  type TodayStats,
} from './focusStorage'

// KUMANI Focus: timer a intervalli (tecnica del pomodoro), fratello di OXYGEN.
// Il tempo non si conta a tick: ogni fase ha un istante di fine (endAt) e a
// ogni controllo si ricalcola da Date.now(), così resta preciso anche con la
// scheda nascosta (dove i timer del browser rallentano) e senza deriva.
// Suono generato dal browser, vibrazione e notifica facoltativa segnano i
// cambi di fase. Statistiche e impostazioni restano solo nel browser.

type Phase = 'focus' | 'short' | 'long'
type Status = 'idle' | 'running' | 'paused'
type Engine = {
  phase: Phase
  status: Status
  endAt: number // istante di fine, valido solo in corsa
  remaining: number // ms rimanenti (in pausa o pronta)
  duration: number // ms totali della fase
  completed: number // sessioni completate nel ciclo verso la pausa lunga
}
type View = Omit<Engine, 'endAt'>
type Notice = 'focusDone' | 'breakDone' | null
type NotifyState = 'unknown' | 'unsupported' | NotificationPermission
type Sentinel = { release: () => Promise<void>; addEventListener?: (type: 'release', listener: () => void) => void }

const TICK_MS = 250
const RING_RADIUS = 108
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
const PRESET_IDS: PresetId[] = ['classic', 'long', 'short', 'custom']

function freshEngine(durations: Durations): Engine {
  const duration = durations.focus * 60_000
  return { phase: 'focus', status: 'idle', endAt: 0, remaining: duration, duration, completed: 0 }
}

const snapshot = ({ phase, status, remaining, duration, completed }: Engine): View => ({ phase, status, remaining, duration, completed })

function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Campanella leggera generata dal browser (nessun file audio)
function playTone(context: AudioContext | null, frequency: number, delay = 0) {
  if (!context) return
  const now = context.currentTime + delay
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.16, now + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 1.6)
}

export default function FocusTimer() {
  const t = useTranslations('focus')
  const [settings, setSettings] = useState<FocusSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<View>(() => snapshot(freshEngine(durationsFor(DEFAULT_SETTINGS))))
  const [stats, setStats] = useState<TodayStats>({ sessions: 0, minutes: 0 })
  const [intention, setIntention] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [notifyState, setNotifyState] = useState<NotifyState>('unknown')
  const [reducedMotion, setReducedMotion] = useState(false)

  const engine = useRef<Engine>(freshEngine(durationsFor(DEFAULT_SETTINGS)))
  const settingsRef = useRef<FocusSettings>(DEFAULT_SETTINGS)
  const audio = useRef<AudioContext | null>(null)
  const wakeLock = useRef<Sentinel | null>(null)
  const awarded = useRef(false)
  const originalTitle = useRef('')

  const sync = useCallback(() => setView(snapshot(engine.current)), [])

  // Impostazioni e statistiche di oggi dal browser, dopo il primo render
  useEffect(() => {
    const saved = loadSettings()
    const today = loadTodayStats()
    const permission: NotifyState = 'Notification' in window ? Notification.permission : 'unsupported'
    const initial = saved.notify && permission !== 'granted' ? { ...saved, notify: false } : saved
    settingsRef.current = initial
    engine.current = freshEngine(durationsFor(initial))
    queueMicrotask(() => {
      setSettings(initial)
      setStats(today)
      setNotifyState(permission)
      setView(snapshot(engine.current))
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (loaded) saveSettings(settings)
  }, [settings, loaded])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // Schermo acceso durante la sessione (dove il browser lo consente)
  const keepScreenOn = useCallback(async (on: boolean) => {
    try {
      if (on && settingsRef.current.keepAwake && !wakeLock.current && 'wakeLock' in navigator) {
        const lock = await (navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<Sentinel> } }).wakeLock.request('screen')
        wakeLock.current = lock
        // Il browser lo rilascia da solo quando la scheda si nasconde
        lock.addEventListener?.('release', () => {
          if (wakeLock.current === lock) wakeLock.current = null
        })
      } else if (!on && wakeLock.current) {
        const lock = wakeLock.current
        wakeLock.current = null
        await lock.release()
      }
    } catch {
      // non disponibile: il timer funziona lo stesso
    }
  }, [])

  // Il contesto audio nasce su un gesto dell'utente (regola dei browser)
  const ensureAudio = () => {
    try {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!audio.current && Context) audio.current = new Context()
      void audio.current?.resume()
    } catch {
      audio.current = null
    }
  }

  const cue = useCallback((to: Phase) => {
    if (settingsRef.current.sound) {
      // Verso la pausa due note che scendono, verso il lavoro due che salgono
      const [first, second] = to === 'focus' ? [440, 587] : [659, 523]
      playTone(audio.current, first)
      playTone(audio.current, second, 0.45)
    }
    if (settingsRef.current.vibration && 'vibrate' in navigator) navigator.vibrate(to === 'focus' ? [60, 80, 60] : [120, 80, 120])
  }, [])

  const notify = useCallback((title: string, body: string) => {
    if (!settingsRef.current.notify || !document.hidden) return
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, tag: 'kumani-focus' })
      }
    } catch {
      // su alcuni browser mobili le notifiche dirette non sono ammesse
    }
  }, [])

  const phaseMs = (phase: Phase) => durationsFor(settingsRef.current)[phase] * 60_000

  // Sessione completata davvero (non saltata): statistiche e punto KU
  const recordFocus = useCallback((durationMs: number) => {
    setStats(addFocusSession(Math.round(durationMs / 60_000)))
    if (!awarded.current) {
      awarded.current = true
      completeFocusSession().catch(() => {
        // il punto è un extra: se non arriva, il timer continua uguale
      })
    }
  }, [])

  // Passaggio alla fase successiva. "natural" = la fase è finita da sola.
  // La pausa parte in automatico agganciata alla fine esatta della sessione;
  // dopo la pausa la concentrazione aspetta che l'utente sia pronto.
  const advance = useCallback(
    (natural: boolean, now: number) => {
      const e = engine.current
      const durations = durationsFor(settingsRef.current)
      if (e.phase === 'focus') {
        const completed = natural ? e.completed + 1 : e.completed
        if (natural) recordFocus(e.duration)
        const next: Phase = completed >= SESSIONS_PER_CYCLE ? 'long' : 'short'
        const duration = durations[next] * 60_000
        e.phase = next
        e.completed = completed
        e.duration = duration
        if (natural) {
          e.status = 'running'
          e.endAt += duration
          e.remaining = e.endAt - now
        } else {
          if (e.status === 'running') e.endAt = now + duration
          e.remaining = duration
        }
      } else {
        const duration = durations.focus * 60_000
        if (e.phase === 'long') e.completed = 0
        e.phase = 'focus'
        e.duration = duration
        e.remaining = duration
        if (natural) e.status = 'idle'
        else if (e.status === 'running') e.endAt = now + duration
      }
    },
    [recordFocus],
  )

  const tick = useCallback(() => {
    const e = engine.current
    if (e.status !== 'running') return
    const now = Date.now()
    let endedPhase: Phase | null = null
    // Al ritorno da una scheda nascosta possono essere finite più fasi
    for (let guard = 0; guard < 3 && e.status === 'running' && e.endAt <= now; guard++) {
      endedPhase = e.phase
      advance(true, now)
    }
    if (e.status === 'running') e.remaining = Math.max(0, e.endAt - now)
    if (endedPhase) {
      cue(e.phase)
      if (endedPhase === 'focus') {
        setNotice('focusDone')
        notify(t('notifyFocusTitle'), t('notifyFocusBody', { count: Math.round(e.duration / 60_000) }))
      } else {
        setNotice('breakDone')
        notify(t('notifyBreakTitle'), t('notifyBreakBody'))
        void keepScreenOn(false)
      }
    }
    sync()
  }, [advance, cue, notify, t, keepScreenOn, sync])

  // Controllo frequente, ma il tempo viene sempre dall'orologio reale
  useEffect(() => {
    if (view.status !== 'running') return
    const timer = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(timer)
  }, [view.status, tick])

  // Scheda di nuovo visibile: ricalcolo immediato e schermo di nuovo acceso
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) return
      tick()
      if (engine.current.status === 'running') void keepScreenOn(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [tick, keepScreenOn])

  useEffect(() => () => void keepScreenOn(false), [keepScreenOn])

  // Conto alla rovescia nel titolo della scheda, ripristinato all'uscita
  useEffect(() => {
    originalTitle.current = document.title
    return () => {
      document.title = originalTitle.current
    }
  }, [])

  useEffect(() => {
    if (view.status === 'running') document.title = `${formatTime(view.remaining)} · ${t(`tab_${view.phase}`)}`
    else if (originalTitle.current) document.title = originalTitle.current
  }, [view.status, view.remaining, view.phase, t])

  // ── Comandi ──
  const startOrResume = () => {
    ensureAudio()
    const e = engine.current
    if (e.status === 'running') return
    e.endAt = Date.now() + e.remaining
    e.status = 'running'
    setNotice(null)
    void keepScreenOn(true)
    sync()
  }

  const pause = () => {
    const e = engine.current
    if (e.status !== 'running') return
    e.remaining = Math.max(0, e.endAt - Date.now())
    e.status = 'paused'
    void keepScreenOn(false)
    sync()
  }

  const skip = () => {
    ensureAudio()
    advance(false, Date.now())
    setNotice(null)
    sync()
  }

  const reset = () => {
    engine.current = freshEngine(durationsFor(settingsRef.current))
    setNotice(null)
    void keepScreenOn(false)
    sync()
  }

  const updateSettings = (patch: Partial<FocusSettings>) => {
    const next = { ...settingsRef.current, ...patch }
    settingsRef.current = next
    setSettings(next)
    // Fase non ancora partita: prende subito la nuova durata
    const e = engine.current
    if (e.status === 'idle') {
      e.duration = phaseMs(e.phase)
      e.remaining = e.duration
      sync()
    }
  }

  const setCustom = (key: keyof Durations, value: number) => {
    updateSettings({ preset: 'custom', custom: { ...settingsRef.current.custom, [key]: clamp(value, key) } })
  }

  const toggleKeepAwake = () => {
    const on = !settings.keepAwake
    updateSettings({ keepAwake: on })
    void keepScreenOn(on && engine.current.status === 'running')
  }

  // Il permesso si chiede solo quando l'utente attiva l'interruttore
  const toggleNotify = async () => {
    if (settings.notify) {
      updateSettings({ notify: false })
      return
    }
    if (!('Notification' in window)) {
      setNotifyState('unsupported')
      return
    }
    let permission = Notification.permission
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission()
      } catch {
        permission = 'denied'
      }
    }
    setNotifyState(permission)
    updateSettings({ notify: permission === 'granted' })
  }

  // ── Vista ──
  const durations = durationsFor(settings)
  const isFocus = view.phase === 'focus'
  const progress = view.duration > 0 ? Math.min(1, Math.max(0, 1 - view.remaining / view.duration)) : 0
  const ringColor = isFocus ? 'var(--gold-bright)' : '#6ee7b7'
  const statusLabel = view.status === 'paused' ? t('paused') : view.status === 'idle' ? t('ready') : null
  const noticeText =
    notice === 'focusDone' ? t('focusDoneMessage') : notice === 'breakDone' ? t('breakDoneMessage') : view.status === 'running' && isFocus ? t('focusHint') : ''

  return (
    <div className="space-y-5">
      {/* Timer */}
      <div className="rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
        <div className="flex min-h-[26px] items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold-bright)]">
          <span className="flex items-center gap-1.5">
            {isFocus ? <Target className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
            {t(`phase_${view.phase}`)}
          </span>
          {statusLabel && <span className="text-white/70">{statusLabel}</span>}
        </div>

        <div
          role="timer"
          aria-label={t('ringLabel', { time: formatTime(view.remaining), phase: t(`phase_${view.phase}`) })}
          className="relative mx-auto my-6 flex aspect-square w-full max-w-[18rem] items-center justify-center"
        >
          <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="120" cy="120" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle
              cx="120"
              cy="120"
              r={RING_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
              style={{ transition: reducedMotion ? 'none' : 'stroke-dashoffset 0.3s linear, stroke 0.6s ease' }}
            />
          </svg>
          <div className="relative text-center">
            <p className="text-6xl font-bold tabular-nums sm:text-7xl">{formatTime(view.remaining)}</p>
            <p className="mt-1 text-base font-semibold" style={{ color: ringColor }}>
              {t(`phase_${view.phase}`)}
            </p>
          </div>
        </div>

        {/* Sessioni del ciclo verso la pausa lunga */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2.5" aria-hidden="true">
            {Array.from({ length: SESSIONS_PER_CYCLE }, (_, index) => {
              const done = index < view.completed
              const current = isFocus && index === view.completed
              return (
                <span
                  key={index}
                  className={`h-3 w-3 rounded-full border ${
                    done ? 'border-[var(--gold-bright)] bg-[var(--gold-bright)]' : current ? 'border-[var(--gold-bright)] bg-transparent' : 'border-white/25 bg-transparent'
                  }`}
                />
              )
            })}
          </div>
          <p className="text-xs text-white/60">{t('cycleProgress', { done: view.completed, total: SESSIONS_PER_CYCLE })}</p>
        </div>

        <p className="mx-auto mt-4 min-h-[3rem] max-w-md text-center text-base leading-7 text-white/90" aria-live="polite">
          {noticeText}
        </p>

        {/* Intenzione, solo durante la concentrazione */}
        {isFocus && (
          <div className="mx-auto mt-2 max-w-md">
            <label htmlFor="focus-intention" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
              {t('intentionLabel')}
            </label>
            <input
              id="focus-intention"
              type="text"
              value={intention}
              maxLength={120}
              onChange={(event) => setIntention(event.target.value)}
              placeholder={t('intentionPlaceholder')}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-base text-white placeholder:text-white/40 focus:border-[var(--gold)] focus:outline-none"
            />
          </div>
        )}

        {/* In pausa: muoversi e respirare */}
        {!isFocus && (
          <div className="mx-auto mt-2 max-w-md rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-sm leading-6 text-white/80">{t(view.phase === 'long' ? 'longBreakHint' : 'breakHint')}</p>
            <Link
              href="/marketplace/oxygen"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-[var(--gold-bright)] hover:bg-white/20"
            >
              <Wind className="h-4 w-4" /> {t('oxygenLink')}
            </Link>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {view.status === 'running' ? (
            <button type="button" onClick={pause} className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/20">
              <Pause className="h-4 w-4" /> {t('pause')}
            </button>
          ) : (
            <button
              type="button"
              onClick={startOrResume}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 text-sm font-bold text-[var(--ink)] shadow-lg hover:brightness-110"
            >
              <Play className="h-4 w-4" /> {view.status === 'paused' ? t('resume') : isFocus ? t('startFocus') : t('startBreak')}
            </button>
          )}
          <button type="button" onClick={skip} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20">
            <SkipForward className="h-4 w-4" /> {t('skip')}
          </button>
          <button type="button" onClick={reset} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20">
            <RotateCcw className="h-4 w-4" /> {t('reset')}
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ sound: !settings.sound })}
            className="rounded-xl bg-white/10 p-3 hover:bg-white/20"
            aria-label={t('optionSound')}
            aria-pressed={settings.sound}
            title={t('optionSound')}
          >
            {settings.sound ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-white/50" />}
          </button>
        </div>
      </div>

      {/* Oggi */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="mb-3 flex items-center gap-2 font-bold text-[var(--ink)]">
          <Timer className="h-5 w-5 text-[var(--gold)]" /> {t('todayTitle')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[var(--paper)] p-4 text-center">
            <p className="text-3xl font-bold tabular-nums text-[var(--ink)]">{stats.sessions}</p>
            <p className="mt-1 text-xs text-gray-600">{t('todaySessions', { count: stats.sessions })}</p>
          </div>
          <div className="rounded-xl bg-[var(--paper)] p-4 text-center">
            <p className="text-3xl font-bold tabular-nums text-[var(--ink)]">{stats.minutes}</p>
            <p className="mt-1 text-xs text-gray-600">{t('todayMinutes', { count: stats.minutes })}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">{t('todayNote')}</p>
      </div>

      {/* Impostazioni */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="mb-3 font-bold text-[var(--ink)]">{t('rhythmTitle')}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => updateSettings({ preset: id })}
              aria-pressed={settings.preset === id}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                settings.preset === id ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 text-gray-700 hover:border-[var(--gold)]'
              }`}
            >
              {t(`preset_${id}`)}
            </button>
          ))}
        </div>

        {settings.preset === 'custom' && (
          <div className="mt-4 space-y-2">
            {(['focus', 'short', 'long'] as const).map((key) => {
              const label = t(`custom_${key}`)
              const value = settings.custom[key]
              const { min, max, step } = LIMITS[key]
              return (
                <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCustom(key, value - step)}
                      disabled={value <= min}
                      aria-label={t('decrease', { label })}
                      className="rounded-lg border border-gray-200 p-2 text-gray-700 hover:border-[var(--gold)] disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-16 text-center text-sm font-bold tabular-nums text-[var(--ink)]">{t('minutesShort', { count: value })}</span>
                    <button
                      type="button"
                      onClick={() => setCustom(key, value + step)}
                      disabled={value >= max}
                      aria-label={t('increase', { label })}
                      className="rounded-lg border border-gray-200 p-2 text-gray-700 hover:border-[var(--gold)] disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500">
          {t('rhythmSummary', { focus: durations.focus, short: durations.short, long: durations.long, sessions: SESSIONS_PER_CYCLE })}
          {view.status !== 'idle' ? ` ${t('appliesNext')}` : ''}
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
            <input type="checkbox" checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} className="h-4 w-4 accent-[var(--ink)]" />
            {settings.sound ? <Bell className="h-4 w-4 text-[var(--gold)]" /> : <BellOff className="h-4 w-4 text-gray-400" />} {t('optionSound')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
            <input type="checkbox" checked={settings.vibration} onChange={(e) => updateSettings({ vibration: e.target.checked })} className="h-4 w-4 accent-[var(--ink)]" />
            <Smartphone className="h-4 w-4 text-[var(--gold)]" /> {t('optionVibration')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
            <input type="checkbox" checked={settings.keepAwake} onChange={toggleKeepAwake} className="h-4 w-4 accent-[var(--ink)]" />
            <MonitorSmartphone className="h-4 w-4 text-[var(--gold)]" /> {t('optionScreen')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.notify}
              onChange={() => void toggleNotify()}
              disabled={notifyState === 'unsupported'}
              className="h-4 w-4 accent-[var(--ink)]"
            />
            <BellRing className="h-4 w-4 text-[var(--gold)]" /> {t('optionNotify')}
          </label>
        </div>
        {notifyState === 'unsupported' && <p className="mt-2 text-xs text-gray-500">{t('notifyUnsupported')}</p>}
        {notifyState === 'denied' && <p className="mt-2 text-xs text-amber-700">{t('notifyDenied')}</p>}
        {settings.notify && <p className="mt-2 text-xs text-gray-500">{t('notifyNote')}</p>}
      </div>

      {/* Consigli */}
      <details className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-[var(--ink)] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-[var(--gold)]" /> {t('tipsTitle')}
          </span>
          <ChevronDown className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="mt-3 space-y-1.5 text-sm leading-6 text-gray-700">
          {['tip1', 'tip2', 'tip3', 'tip4', 'tip5'].map((key) => (
            <li key={key}>• {t(key)}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}

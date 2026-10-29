'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Ear, Hand, Headphones, Minus, Play, Plus, Square, Timer, TrendingUp, Vibrate, Volume2 } from 'lucide-react'
import {
  MAX_BPM,
  METERS,
  MIN_BPM,
  NEAR_MS,
  ON_TIME_MS,
  SOUNDS,
  SUBDIVISIONS,
  TIMERS,
  bpmFromTaps,
  clampBpm,
  defaultAccents,
  loadPractices,
  loadSettings,
  meterOf,
  playClick,
  practiceStats,
  savePractice,
  saveSettings,
  tempoName,
  type Accent,
  type ClickSound,
  type MeterId,
  type Practice,
  type Subdivision,
} from '@/lib/metronomo'

// Metronomo: battiti con suono, luce e vibrazione, tempi semplici e composti,
// accenti a scelta, suddivisioni, accelerazione graduale, timer di studio e
// ascolto dei colpi di chi suona (microfono) con il riepilogo della prova.

type Beat = { time: number; index: number }
type Verdict = 'on' | 'early' | 'late' | null
type WakeLock = { release: () => Promise<void> }
type WakeNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }
const now = () => performance.now()
const NEXT_ACCENT: Record<Accent, Accent> = { strong: 'normal', normal: 'mute', mute: 'strong' }
const SUB_LABEL: Record<Subdivision, string> = { 1: '♩', 2: '♫', 3: '³', 4: '♬' }

export default function MetronomoApp() {
  const t = useTranslations('metronomo')
  const locale = useLocale()
  const [bpm, setBpm] = useState(90)
  const [meter, setMeter] = useState<MeterId>('4/4')
  const [accents, setAccents] = useState<Accent[]>(defaultAccents('4/4'))
  const [sub, setSub] = useState<Subdivision>(1)
  const [sound, setSound] = useState<ClickSound>('click')
  const [volume, setVolume] = useState(0.8)
  const [vibrate, setVibrate] = useState(false)
  const [canVibrate, setCanVibrate] = useState(false)
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(-1)
  const [bar, setBar] = useState(0)
  const [accel, setAccel] = useState(false)
  const [target, setTarget] = useState(120)
  const [step, setStep] = useState(2)
  const [everyBars, setEveryBars] = useState(8)
  const [timerMin, setTimerMin] = useState<(typeof TIMERS)[number]>(0)
  const [left, setLeft] = useState<number | null>(null)
  const [listen, setListen] = useState(false)
  const [countIn, setCountIn] = useState(false)
  const [counting, setCounting] = useState(false)
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [offsets, setOffsets] = useState<number[]>([])
  const [result, setResult] = useState<(ReturnType<typeof practiceStats> & { bpm: number }) | null>(null)
  const [history, setHistory] = useState<Practice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const taps = useRef<number[]>([])

  const ctxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const frame = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const wakeRef = useRef<WakeLock | null>(null)
  const startedAt = useRef(0)
  const startingRef = useRef(false)
  const mountedRef = useRef(true)
  const S = useRef({ next: 0, beatCount: 0, subStep: 0, bar: 0, bpm: 90, beats: 4, accents: defaultAccents('4/4'), sub: 1 as Subdivision, sound: 'click' as ClickSound, vibrate: false, accel: false, target: 120, step: 2, everyBars: 8, queue: [] as Beat[], clicks: [] as number[], offsets: [] as number[], listenFrom: 0 })

  // Impostazioni ricordate e prove salvate: si leggono solo nel browser
  useEffect(() => {
    const v = loadSettings()
    /* eslint-disable react-hooks/set-state-in-effect -- dati del telefono, letti dopo il primo disegno */
    if (typeof v.bpm === 'number') setBpm(clampBpm(v.bpm))
    if (v.meter && METERS.some((m) => m.id === v.meter)) {
      setMeter(v.meter)
      setAccents(Array.isArray(v.accents) && v.accents.length === meterOf(v.meter).beats ? v.accents : defaultAccents(v.meter))
    }
    if (v.sub && SUBDIVISIONS.includes(v.sub)) setSub(v.sub)
    if (v.sound && SOUNDS.includes(v.sound)) setSound(v.sound)
    if (typeof v.volume === 'number') setVolume(Math.min(1, Math.max(0, v.volume)))
    if (typeof v.vibrate === 'boolean') setVibrate(v.vibrate)
    setCanVibrate(typeof navigator.vibrate === 'function')
    setHistory(loadPractices())
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      release()
    }
  }, [])

  // Tornando all'app lo schermo va tenuto acceso di nuovo (il telefono lo libera)
  useEffect(() => {
    if (!running) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !ctxRef.current) return
      void ctxRef.current.resume().catch(() => {})
      ;(navigator as WakeNavigator).wakeLock
        ?.request('screen')
        .then((lock) => (wakeRef.current = lock))
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [running])

  useEffect(() => {
    if (ready) saveSettings({ bpm, meter, accents, sub, sound, volume, vibrate })
  }, [ready, bpm, meter, accents, sub, sound, volume, vibrate])

  // Le impostazioni si leggono dal programmatore dei battiti mentre suona
  useEffect(() => {
    Object.assign(S.current, { bpm, beats: meterOf(meter).beats, accents, sub, sound, vibrate, accel, target, step, everyBars })
    if (gainRef.current) gainRef.current.gain.value = volume
  }, [bpm, meter, accents, sub, sound, volume, vibrate, accel, target, step, everyBars])

  function release() {
    if (timer.current) clearInterval(timer.current)
    cancelAnimationFrame(frame.current)
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    void ctxRef.current?.close().catch(() => {})
    void wakeRef.current?.release().catch(() => {})
    timer.current = null
    streamRef.current = null
    ctxRef.current = null
    gainRef.current = null
    wakeRef.current = null
  }

  const start = async () => {
    // Avvio già in corso (doppio tocco o spazio mentre si chiede il microfono): un metronomo solo
    if (startingRef.current || timer.current) return
    startingRef.current = true
    setError(null)
    setResult(null)
    setOffsets([])
    setVerdict(null)
    setBar(0)
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ctxRef.current = ctx
    const out = ctx.createGain()
    out.gain.value = volume
    out.connect(ctx.destination)
    gainRef.current = out
    let analyser: AnalyserNode | null = null
    // Ritardo dell'audio (cuffie Bluetooth fino a 200 ms e più): il colpo si confronta con il clic come lo si sente
    let latency = 0
    // iPhone: il suono si sente anche con l'interruttore del silenzioso
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = listen ? 'play-and-record' : 'playback'
    if (listen) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        streamRef.current = stream
        latency = (stream.getAudioTracks()[0]?.getSettings() as MediaTrackSettings & { latency?: number }).latency ?? 0
        analyser = ctx.createAnalyser()
        // Finestra più lunga dell'intervallo tra due controlli: nessun colpo breve sfugge
        analyser.fftSize = 2048
        ctx.createMediaStreamSource(stream).connect(analyser)
      } catch {
        setError(t('errorMic'))
      }
    }
    // Dopo la domanda del microfono il browser può tenere l'audio in pausa (iPhone): si riavvia
    await ctx.resume().catch(() => {})
    startingRef.current = false
    // Pagina lasciata mentre si chiedeva il microfono: niente metronomo fantasma
    if (!mountedRef.current) return release()
    latency += (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
    const s = S.current
    Object.assign(s, { next: ctx.currentTime + 0.15, beatCount: 0, subStep: 0, bar: 0, queue: [], clicks: [], offsets: [] })
    // Con la battuta di attacco l'ascolto parte dopo la prima battuta
    s.listenFrom = s.next + (countIn && analyser ? (60 / s.bpm) * s.beats : 0)
    startedAt.current = now()

    // Programmatore: i colpi dei prossimi 120 millisecondi, ogni 25
    timer.current = setInterval(() => {
      while (s.next < ctx.currentTime + 0.12) {
        // Battiti e suddivisioni contati a parte: cambiando la suddivisione
        // mentre suona, il primo battito resta al suo posto
        const sub = s.sub
        if (s.subStep >= sub) {
          s.subStep = 0
          s.beatCount += 1
        }
        const beatIndex = s.beatCount % s.beats
        const onBeat = s.subStep === 0
        const accent = s.accents[beatIndex] ?? 'normal'
        if (onBeat) {
          if (accent !== 'mute') playClick(ctx, out, s.next, accent === 'strong' ? 2 : 1, s.sound)
          s.queue.push({ time: s.next, index: beatIndex })
          if (s.queue.length > 64) s.queue.shift()
        } else if (accent !== 'mute') playClick(ctx, out, s.next, 0, s.sound)
        if (s.sound !== 'none') {
          s.clicks.push(s.next)
          if (s.clicks.length > 64) s.clicks.shift()
        }
        s.next += 60 / s.bpm / sub
        s.subStep += 1
        if (s.subStep >= sub) {
          s.subStep = 0
          s.beatCount += 1
        }
        if (s.subStep === 0 && s.beatCount % s.beats === 0) {
          s.bar += 1
          // Accelerazione: ogni tot battute qualche battito in più, fino all'obiettivo
          if (s.accel && s.bar % s.everyBars === 0 && s.bpm < s.target) {
            s.bpm = clampBpm(Math.min(s.target, s.bpm + s.step))
            setBpm(s.bpm)
          }
        }
      }
    }, 25)

    // Luce, vibrazione, battute e ascolto dei colpi
    const buf = analyser ? new Float32Array(analyser.fftSize) : null
    let env = 0.01
    let lastHit = -1
    let lastBeatShown = -1
    let verdictUntil = 0
    let beatsShown = 0
    let wasCounting = false
    const loop = () => {
      const time = ctx.currentTime
      const due = s.queue.filter((b) => b.time <= time)
      const current = due[due.length - 1]
      if (current && current.time !== lastBeatShown) {
        lastBeatShown = current.time
        beatsShown += 1
        setBeat(current.index)
        if (current.index === 0) setBar(Math.max(1, Math.ceil(beatsShown / s.beats)))
        if (s.vibrate && (s.accents[current.index] ?? 'normal') !== 'mute') navigator.vibrate?.(s.accents[current.index] === 'strong' ? 40 : 20)
      }
      // Battuta di attacco: si ascolta solo dopo
      const isCounting = !!analyser && time < s.listenFrom
      if (isCounting !== wasCounting) {
        wasCounting = isCounting
        setCounting(isCounting)
      }
      if (analyser && buf && time >= s.listenFrom) {
        analyser.getFloatTimeDomainData(buf)
        // Il picco degli ultimi 17 ms (la parte nuova della finestra): un colpo è un picco
        // che sale di colpo sopra il livello di fondo
        const fresh = Math.min(buf.length, Math.ceil(ctx.sampleRate * 0.017))
        let peak = 0
        let peakAt = buf.length - 1
        for (let i = buf.length - fresh; i < buf.length; i++) {
          const v = Math.abs(buf[i])
          if (v > peak) {
            peak = v
            peakAt = i
          }
        }
        const hit = peak > Math.max(0.08, env * 3) && time - lastHit > 0.1
        env = env * 0.9 + peak * 0.1
        if (hit) {
          lastHit = time
          // L'ora del picco dentro la finestra
          const heard = time - (buf.length - 1 - peakAt) / ctx.sampleRate
          const at = heard - latency
          const interval = 60 / s.bpm
          // Il battito più vicino: si parte dall'ultimo programmato e si segue la griglia
          const known = s.queue.reduce<Beat | null>((best, x) => (!best || Math.abs(x.time - at) < Math.abs(best.time - at) ? x : best), null)
          const beatTime = known ? known.time + Math.round((at - known.time) / interval) * interval : null
          // Il clic dell'altoparlante sentito dal microfono non conta come colpo
          const echo = s.sound !== 'none' && peak < 0.4 && s.clicks.some((c) => heard - c >= 0 && heard - c < 0.07 + latency)
          if (beatTime !== null && beatTime >= s.listenFrom - 0.01 && Math.abs(at - beatTime) <= interval / 2 && !echo) {
            const offset = Math.round((at - beatTime) * 1000)
            s.offsets.push(offset)
            setOffsets([...s.offsets])
            setVerdict(Math.abs(offset) <= ON_TIME_MS ? 'on' : offset < 0 ? 'early' : 'late')
            verdictUntil = now() + 600
          }
        } else if (verdictUntil && now() > verdictUntil) {
          verdictUntil = 0
          setVerdict(null)
        }
      }
      frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)
    setRunning(true)
    // Schermo acceso mentre suona
    ;(navigator as WakeNavigator).wakeLock
      ?.request('screen')
      .then((lock) => (wakeRef.current = lock))
      .catch(() => {})
  }

  const stop = () => {
    const s = S.current
    release()
    setRunning(false)
    setBeat(-1)
    setVerdict(null)
    setLeft(null)
    setCounting(false)
    if (s.offsets.length >= 4) {
      const st = practiceStats(s.offsets)
      setResult({ ...st, bpm: s.bpm })
      setHistory(savePractice({ id: String(Date.now()), at: Date.now(), bpm: s.bpm, hits: st.hits, onTime: st.onTime, meanOffset: st.meanOffset }))
    }
  }
  const stopRef = useRef(stop)
  useEffect(() => {
    stopRef.current = stop
  })

  // Timer di studio: si ferma da solo
  useEffect(() => {
    if (!running || !timerMin) return
    const id = setInterval(() => {
      const rest = Math.max(0, timerMin * 60 - Math.floor((now() - startedAt.current) / 1000))
      setLeft(rest)
      if (rest === 0) stopRef.current()
    }, 500)
    return () => clearInterval(id)
  }, [running, timerMin])

  const toggle = () => (running ? stop() : void start())
  const toggleRef = useRef(toggle)
  useEffect(() => {
    toggleRef.current = toggle
  })

  // Tastiera: spazio avvia e ferma, frecce cambiano la velocità
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggleRef.current()
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setBpm((v) => clampBpm(v + (e.shiftKey ? 5 : 1)))
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setBpm((v) => clampBpm(v - (e.shiftKey ? 5 : 1)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tap = () => {
    const time = now()
    taps.current = [...taps.current.filter((x) => time - x < 3000), time]
    const v = bpmFromTaps(taps.current)
    if (v) setBpm(v)
  }

  const chooseMeter = (id: MeterId) => {
    setMeter(id)
    setAccents(defaultAccents(id))
  }
  const cycleAccent = (i: number) => setAccents((a) => a.map((x, k) => (k === i ? NEXT_ACCENT[x] : x)))

  const change = (d: number) => setBpm((v) => clampBpm(v + d))
  const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-bold disabled:opacity-50 ${on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/40 bg-white text-[var(--ink)]'}`
  const live = practiceStats(offsets)
  const flash = running && beat >= 0
  const flashColor = verdict === 'on' ? '#16a34a' : verdict === 'early' || verdict === 'late' ? '#ea580c' : flash && accents[beat] === 'strong' ? '#c9a227' : '#2b2d52'
  const mm = left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : null

  return (
    <div className="space-y-5">
      <section className={`${card} text-center`}>
        {/* Luce del battito */}
        <div
          className="mx-auto flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 transition-[background-color,transform] duration-75"
          style={{ borderColor: flashColor, background: flash ? `${flashColor}22` : 'transparent', transform: flash && accents[beat] === 'strong' ? 'scale(1.06)' : 'scale(1)' }}
        >
          <span className="text-5xl font-extrabold tabular-nums text-[var(--ink)]">{bpm}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{tempoName(bpm)}</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
          {t('bpm')}
          {running && bar > 0 ? ` · ${t('barCount', { bar })}` : ''}
          {mm ? ` · ${mm}` : ''}
        </p>

        {/* Battiti della battuta: toccandoli si cambia l'accento */}
        <div className="mx-auto mt-3 flex max-w-sm flex-wrap justify-center gap-2">
          {accents.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => cycleAccent(i)}
              aria-label={t('accentAria', { n: i + 1, accent: t(`accent_${a}`) })}
              title={t(`accent_${a}`)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-extrabold transition ${running && beat === i ? 'scale-110' : ''} ${a === 'strong' ? 'border-[var(--gold)] bg-[var(--gold)] text-white' : a === 'normal' ? 'border-[var(--ink)] bg-white text-[var(--ink)]' : 'border-dashed border-gray-300 bg-white text-gray-300'} ${running && beat === i ? 'ring-4 ring-[var(--gold)]/40' : ''}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">{t('accentHint')}</p>

        {listen && running && (
          <p className={`mt-3 h-7 text-lg font-extrabold ${verdict === 'on' ? 'text-emerald-600' : verdict ? 'text-orange-600' : 'text-[var(--muted)]'}`}>
            {verdict ? t(`verdict_${verdict}`) : counting ? t('countingIn') : t('listening')}
          </p>
        )}
        {listen && running && live.hits > 0 && <p className="text-sm text-[var(--muted)]">{t('liveLine', { hits: live.hits, percent: live.percent })}</p>}

        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" onClick={() => change(-5)} className="h-11 min-w-11 rounded-full border border-[var(--gold)]/40 px-3 font-bold text-[var(--ink)]">
            −5
          </button>
          <button type="button" onClick={() => change(-1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gold)]/40 text-[var(--ink)]" aria-label="−1">
            <Minus className="h-4 w-4" />
          </button>
          <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-28 accent-[var(--gold)] sm:w-48" aria-label={t('bpm')} />
          <button type="button" onClick={() => change(1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gold)]/40 text-[var(--ink)]" aria-label="+1">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => change(5)} className="h-11 min-w-11 rounded-full border border-[var(--gold)]/40 px-3 font-bold text-[var(--ink)]">
            +5
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {running ? (
            <button type="button" onClick={stop} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-red-600 px-8 text-lg font-bold text-white">
              <Square className="h-5 w-5" /> {t('stop')}
            </button>
          ) : (
            <button type="button" onClick={() => void start()} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-8 text-lg font-bold text-[var(--gold-bright)]">
              <Play className="h-5 w-5" /> {t('start')}
            </button>
          )}
          <button type="button" onClick={tap} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 px-5 font-bold text-[var(--ink)]">
            <Hand className="h-4 w-4" /> {t('tap')}
          </button>
        </div>
        <p className="mt-2 hidden text-xs text-[var(--muted)] sm:block">{t('keysHint')}</p>
        {error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      <section className={`${card} space-y-4`}>
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">{t('meterTitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {METERS.map((m) => (
              <button key={m.id} type="button" disabled={running} onClick={() => chooseMeter(m.id)} aria-pressed={meter === m.id} className={chip(meter === m.id)}>
                {m.id}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">{t('subTitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUBDIVISIONS.map((d) => (
              <button key={d} type="button" onClick={() => setSub(d)} aria-pressed={sub === d} className={chip(sub === d)}>
                <span className="mr-1" aria-hidden>
                  {SUB_LABEL[d]}
                </span>
                {t(`sub_${d}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">{t('soundTitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SOUNDS.map((s) => (
              <button key={s} type="button" onClick={() => setSound(s)} aria-pressed={sound === s} className={chip(sound === s)}>
                {t(`sound_${s}`)}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-[var(--ink)]">
            <Volume2 className="h-4 w-4 shrink-0 text-[var(--gold)]" aria-hidden />
            <span className="shrink-0">{t('volume')}</span>
            <input type="range" min={0} max={1} step={0.05} value={volume} disabled={sound === 'none'} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-[var(--gold)] disabled:opacity-40" aria-label={t('volume')} />
          </label>
          {canVibrate && (
            <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-[var(--ink)]">
              <input type="checkbox" checked={vibrate} onChange={(e) => setVibrate(e.target.checked)} className="h-5 w-5 accent-[var(--gold)]" />
              <Vibrate className="h-4 w-4 text-[var(--gold)]" aria-hidden /> {t('vibrate')}
            </label>
          )}
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
            <Timer className="h-4 w-4 text-[var(--gold)]" /> {t('timerTitle')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIMERS.map((m) => (
              <button key={m} type="button" disabled={running} onClick={() => setTimerMin(m)} aria-pressed={timerMin === m} className={chip(timerMin === m)}>
                {m ? t('timerMin', { min: m }) : t('timerOff')}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-2xl bg-[var(--background)] p-3">
          <input type="checkbox" checked={accel} disabled={running} onChange={(e) => setAccel(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--gold)]" />
          <span>
            <span className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
              <TrendingUp className="h-4 w-4 text-[var(--gold)]" /> {t('accelTitle')}
            </span>
            <span className="block text-sm text-[var(--muted)]">{t('accelHint', { step, bars: everyBars, target })}</span>
          </span>
        </label>
        {accel && !running && (
          <div className="grid grid-cols-3 gap-2 text-sm">
            {(
              [
                ['accelTarget', target, setTarget, MIN_BPM, MAX_BPM],
                ['accelStep', step, setStep, 1, 10],
                ['accelBars', everyBars, setEveryBars, 1, 32],
              ] as const
            ).map(([k, v, set, min, max]) => (
              <label key={k} className="block">
                <span className="text-xs font-semibold text-[var(--muted)]">{t(k)}</span>
                <NumberField min={min} max={max} value={v} onChange={set} />
              </label>
            ))}
          </div>
        )}

        <label className="flex items-start gap-3 rounded-2xl bg-[var(--background)] p-3">
          <input type="checkbox" checked={listen} disabled={running} onChange={(e) => setListen(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--gold)]" />
          <span>
            <span className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
              <Ear className="h-4 w-4 text-[var(--gold)]" /> {t('listenTitle')}
            </span>
            <span className="block text-sm text-[var(--muted)]">{t('listenHint')}</span>
          </span>
        </label>
        {listen && (
          <label className="ml-1 flex items-center gap-3 text-sm font-semibold text-[var(--ink)]">
            <input type="checkbox" checked={countIn} disabled={running} onChange={(e) => setCountIn(e.target.checked)} className="h-5 w-5 accent-[var(--gold)]" />
            {t('countIn')}
          </label>
        )}
        {listen && sound !== 'none' && (
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
            <Headphones className="mt-0.5 h-4 w-4 shrink-0" /> {t('headphones')}
          </p>
        )}
      </section>

      {result && (
        <section className={`${card} space-y-3`}>
          <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('resultTitle')}</h2>
          <p className="text-4xl font-extrabold text-[var(--ink)]">{t('resultPercent', { percent: result.percent })}</p>
          <p className="text-sm text-[var(--muted)]">{t('resultHits', { hits: result.hits, onTime: result.onTime, bpm: result.bpm })}</p>
          <p className="rounded-2xl bg-[var(--background)] p-3 text-sm font-semibold text-[var(--ink)]">
            {Math.abs(result.meanOffset) <= 15 ? t('tendencyNone') : result.meanOffset < 0 ? t('tendencyEarly', { ms: -result.meanOffset }) : t('tendencyLate', { ms: result.meanOffset })}
          </p>
          <svg viewBox="0 0 300 80" className="h-24 w-full rounded-xl border border-gray-100 bg-white" aria-label={t('chartLabel')}>
            <line x1="0" y1="40" x2="300" y2="40" stroke="#d6d3d1" />
            {offsets.map((o, i) => {
              const x = offsets.length > 1 ? (i / (offsets.length - 1)) * 290 + 5 : 150
              // In ritardo sopra la riga, in anticipo sotto
              const y = 40 - Math.max(-36, Math.min(36, (o / NEAR_MS) * 36))
              return <circle key={i} cx={x} cy={y} r="2.5" fill={Math.abs(o) <= ON_TIME_MS ? '#16a34a' : Math.abs(o) <= NEAR_MS ? '#ca8a04' : '#dc2626'} />
            })}
          </svg>
          <p className="text-xs text-[var(--muted)]">{t('chartHint')}</p>
        </section>
      )}

      {history.length > 0 && (
        <section className={`${card} space-y-2`}>
          <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('historyTitle')}</h2>
          <ul className="space-y-1.5 text-sm">
            {history.slice(0, 10).map((p) => (
              <li key={p.id} className="flex justify-between gap-3 rounded-xl bg-[var(--background)] px-3 py-2">
                <span>
                  {new Date(p.at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · {p.bpm} {t('bpmShort')}
                </span>
                <span className="font-bold text-[var(--ink)]">{p.hits ? Math.round((p.onTime / p.hits) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-[var(--muted)]">{t('privacy')}</p>
    </div>
  )
}

// Numero scritto a mano: si controlla quando si esce dal campo (scrivendo
// «140» il primo «1» non diventa subito il minimo)
function NumberField({ min, max, value, onChange }: { min: number; max: number; value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    onChange(Math.min(max, Math.max(min, Math.round(Number(draft)) || min)))
    setDraft(null)
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-[16px]"
    />
  )
}

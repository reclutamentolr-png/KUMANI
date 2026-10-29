'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Ear, Hand, Headphones, Minus, Play, Plus, Square, TrendingUp } from 'lucide-react'
import { MAX_BPM, METERS, MIN_BPM, NEAR_MS, ON_TIME_MS, bpmFromTaps, clampBpm, loadPractices, playClick, practiceStats, savePractice, type ClickSound, type Meter, type Practice } from '@/lib/metronomo'

// Metronomo: battiti con suono e luce, tempo, accelerazione graduale e
// ascolto dei colpi di chi suona (microfono) con il riepilogo della prova.

type Beat = { time: number; index: number }
type Verdict = 'on' | 'early' | 'late' | null
const SOUNDS: ClickSound[] = ['click', 'wood', 'bell']
const now = () => performance.now()

export default function MetronomoApp() {
  const t = useTranslations('metronomo')
  const locale = useLocale()
  const [bpm, setBpm] = useState(90)
  const [meter, setMeter] = useState<Meter>(4)
  const [sound, setSound] = useState<ClickSound>('click')
  const [lightOnly, setLightOnly] = useState(false)
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(-1)
  const [accel, setAccel] = useState(false)
  const [target, setTarget] = useState(120)
  const [step, setStep] = useState(2)
  const [everyBars, setEveryBars] = useState(8)
  const [listen, setListen] = useState(false)
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [offsets, setOffsets] = useState<number[]>([])
  const [result, setResult] = useState<ReturnType<typeof practiceStats> & { bpm: number } | null>(null)
  const [history, setHistory] = useState<Practice[]>([])
  const [error, setError] = useState<string | null>(null)
  const taps = useRef<number[]>([])

  const ctxRef = useRef<AudioContext | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const frame = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)
  const S = useRef({ next: 0, index: 0, bar: 0, bpm: 90, meter: 4 as Meter, sound: 'click' as ClickSound, lightOnly: false, accel: false, target: 120, step: 2, everyBars: 8, queue: [] as Beat[], offsets: [] as number[] })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prove salvate nel telefono, si leggono solo qui
    setHistory(loadPractices())
    return () => release()
  }, [])

  // Le impostazioni si leggono dal programmatore dei battiti mentre suona
  useEffect(() => {
    Object.assign(S.current, { bpm, meter, sound, lightOnly, accel, target, step, everyBars })
  }, [bpm, meter, sound, lightOnly, accel, target, step, everyBars])

  function release() {
    if (timer.current) clearInterval(timer.current)
    cancelAnimationFrame(frame.current)
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    void ctxRef.current?.close().catch(() => {})
    timer.current = null
    streamRef.current = null
    ctxRef.current = null
  }

  const start = async () => {
    setError(null)
    setResult(null)
    setOffsets([])
    setVerdict(null)
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ctxRef.current = ctx
    let analyser: AnalyserNode | null = null
    if (listen) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        streamRef.current = stream
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
    const s = S.current
    Object.assign(s, { next: ctx.currentTime + 0.15, index: 0, bar: 0, queue: [], offsets: [] })

    // Programmatore: i battiti dei prossimi 120 millisecondi, ogni 25
    timer.current = setInterval(() => {
      while (s.next < ctx.currentTime + 0.12) {
        const accent = s.index % s.meter === 0
        if (!s.lightOnly) playClick(ctx, s.next, accent, s.sound)
        s.queue.push({ time: s.next, index: s.index % s.meter })
        if (s.queue.length > 64) s.queue.shift()
        s.next += 60 / s.bpm
        s.index += 1
        if (s.index % s.meter === 0) {
          s.bar += 1
          // Accelerazione: ogni tot battute qualche battito in più, fino all'obiettivo
          if (s.accel && s.bar % s.everyBars === 0 && s.bpm < s.target) {
            s.bpm = clampBpm(Math.min(s.target, s.bpm + s.step))
            setBpm(s.bpm)
          }
        }
      }
    }, 25)

    // Luce dei battiti e ascolto dei colpi
    const buf = analyser ? new Float32Array(analyser.fftSize) : null
    let env = 0.01
    let lastHit = -1
    let lastBeatShown = -1
    let verdictUntil = 0
    const loop = () => {
      const time = ctx.currentTime
      const due = s.queue.filter((b) => b.time <= time)
      const current = due[due.length - 1]
      if (current && current.time !== lastBeatShown) {
        lastBeatShown = current.time
        setBeat(current.index)
      }
      if (analyser && buf) {
        analyser.getFloatTimeDomainData(buf)
        // Il picco degli ultimi 16 ms (la parte nuova della finestra): un colpo è un picco
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
        const rms = peak
        const hit = peak > Math.max(0.08, env * 3) && time - lastHit > 0.12
        env = env * 0.9 + peak * 0.1
        if (hit) {
          lastHit = time
          // L'ora del picco dentro la finestra
          const at = time - (buf.length - 1 - peakAt) / ctx.sampleRate
          const interval = 60 / s.bpm
          // Il battito più vicino: si parte dall'ultimo programmato e si segue la griglia
          // (il successivo può non essere ancora in coda)
          const known = s.queue.reduce<Beat | null>((best, x) => (!best || Math.abs(x.time - at) < Math.abs(best.time - at) ? x : best), null)
          const beatTime = known ? known.time + Math.round((at - known.time) / interval) * interval : null
          // Il clic dell'altoparlante sentito dal microfono non conta come colpo
          const echo = !s.lightOnly && beatTime !== null && at - beatTime >= 0 && at - beatTime < 0.07 && rms < 0.4
          if (beatTime !== null && Math.abs(at - beatTime) <= interval / 2 && !echo) {
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
  }

  const stop = () => {
    const s = S.current
    release()
    setRunning(false)
    setBeat(-1)
    setVerdict(null)
    if (s.offsets.length >= 4) {
      const st = practiceStats(s.offsets)
      setResult({ ...st, bpm: s.bpm })
      setHistory(savePractice({ id: String(Date.now()), at: Date.now(), bpm: s.bpm, hits: st.hits, onTime: st.onTime, meanOffset: st.meanOffset }))
    }
  }

  const tap = () => {
    const time = now()
    taps.current = [...taps.current.filter((x) => time - x < 3000), time]
    const v = bpmFromTaps(taps.current)
    if (v) setBpm(v)
  }

  const change = (d: number) => setBpm((v) => clampBpm(v + d))
  const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-bold ${on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/40 bg-white text-[var(--ink)]'}`
  const live = practiceStats(offsets)
  const flashColor = verdict === 'on' ? '#16a34a' : verdict === 'early' || verdict === 'late' ? '#ea580c' : beat === 0 ? '#c9a227' : '#2b2d52'

  return (
    <div className="space-y-5">
      <section className={`${card} text-center`}>
        {/* Luce del battito */}
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 transition-[background-color,transform] duration-75" style={{ borderColor: flashColor, background: running && beat >= 0 ? `${flashColor}22` : 'transparent', transform: running && beat === 0 ? 'scale(1.06)' : 'scale(1)' }}>
          <span className="text-5xl font-extrabold tabular-nums text-[var(--ink)]">{bpm}</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{t('bpm')}</p>
        <div className="mt-3 flex justify-center gap-2" aria-hidden>
          {Array.from({ length: meter }, (_, i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded-full ${running && beat === i ? (i === 0 ? 'bg-[var(--gold)]' : 'bg-[var(--ink)]') : 'bg-[var(--background)]'}`} />
          ))}
        </div>
        {listen && running && (
          <p className={`mt-3 h-7 text-lg font-extrabold ${verdict === 'on' ? 'text-emerald-600' : verdict ? 'text-orange-600' : 'text-[var(--muted)]'}`}>{verdict ? t(`verdict_${verdict}`) : t('listening')}</p>
        )}
        {listen && running && live.hits > 0 && <p className="text-sm text-[var(--muted)]">{t('liveLine', { hits: live.hits, percent: live.percent })}</p>}

        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" onClick={() => change(-5)} className="h-11 min-w-11 rounded-full border border-[var(--gold)]/40 px-3 font-bold text-[var(--ink)]">−5</button>
          <button type="button" onClick={() => change(-1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gold)]/40 text-[var(--ink)]" aria-label="−1">
            <Minus className="h-4 w-4" />
          </button>
          <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-32 accent-[var(--gold)] sm:w-48" aria-label={t('bpm')} />
          <button type="button" onClick={() => change(1)} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gold)]/40 text-[var(--ink)]" aria-label="+1">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => change(5)} className="h-11 min-w-11 rounded-full border border-[var(--gold)]/40 px-3 font-bold text-[var(--ink)]">+5</button>
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
        {error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      <section className={`${card} space-y-4`}>
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">{t('meterTitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {METERS.map((m) => (
              <button key={m} type="button" disabled={running} onClick={() => setMeter(m)} aria-pressed={meter === m} className={chip(meter === m)}>
                {m === 6 ? '6/8' : `${m}/4`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">{t('soundTitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SOUNDS.map((s) => (
              <button key={s} type="button" onClick={() => setSound(s)} aria-pressed={sound === s && !lightOnly} className={chip(sound === s && !lightOnly)}>
                {t(`sound_${s}`)}
              </button>
            ))}
            <button type="button" onClick={() => setLightOnly((v) => !v)} aria-pressed={lightOnly} className={chip(lightOnly)}>
              {t('lightOnly')}
            </button>
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
                <input type="number" min={min} max={max} value={v} onChange={(e) => set(Math.min(max, Math.max(min, Number(e.target.value) || min)))} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-[16px]" />
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
        {listen && !lightOnly && (
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
                <span>{new Date(p.at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · {p.bpm} {t('bpmShort')}</span>
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

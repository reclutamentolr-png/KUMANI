'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Mic, Minus, Plus, Square, Volume2 } from 'lucide-react'
import {
  A4_DEFAULT,
  A4_MAX,
  A4_MIN,
  INSTRUMENTS,
  centsBetween,
  detectPitch,
  instrumentOf,
  loadTunerSettings,
  median,
  midiToFreq,
  nearestNote,
  noteName,
  playReference,
  saveTunerSettings,
  searchRange,
  type Naming,
} from '@/lib/accordatore'
import GuidedTuning from './GuidedTuning'

// Accordatore: chitarra, basso, ukulele, violino, viola, violoncello o
// cromatico. Riconosce la corda da solo (o si sceglie toccandola), ago e
// strobo al centesimo, La regolabile, suono di riferimento, conferma per
// ogni corda accordata. Il suono non viene registrato.

type WakeLock = { release: () => Promise<void> }
type WakeNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }
type Reading = { freq: number; midi: number; cents: number; target: number | null; stringIndex: number | null }
const TOLERANCES = [2, 3, 5, 10]
const now = () => performance.now()

export default function AccordatoreApp() {
  const t = useTranslations('accordatore')
  const [instrument, setInstrument] = useState('guitar')
  const [tuning, setTuning] = useState('standard')
  const [a4, setA4] = useState(A4_DEFAULT)
  const [naming, setNaming] = useState<Naming>('solfege')
  const [tolerance, setTolerance] = useState(3)
  const [strobe, setStrobe] = useState(false)
  const [sensitivity, setSensitivity] = useState(0.5)
  const [running, setRunning] = useState(false)
  const [manual, setManual] = useState<number | null>(null)
  // «Passo passo»: una corda alla volta, con il disegno dello strumento
  const [guided, setGuided] = useState(true)
  const [guideIndex, setGuideIndex] = useState(0)
  const [reading, setReading] = useState<Reading | null>(null)
  const [tuned, setTuned] = useState<boolean[]>([])
  const [phase, setPhase] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frame = useRef(0)
  const wakeRef = useRef<WakeLock | null>(null)
  const L = useRef({ strings: [] as number[], a4: A4_DEFAULT, manual: null as number | null, tolerance: 3, sensitivity: 0.5, recent: [] as number[], held: -1, heldSince: 0, mutedUntil: 0, lastSeen: 0, strobePhase: 0 })

  const inst = instrumentOf(instrument)
  const tun = inst.tunings.find((x) => x.id === tuning) ?? inst.tunings[0]
  const strings = tun.strings

  // Impostazioni ricordate
  useEffect(() => {
    const v = loadTunerSettings()
    /* eslint-disable react-hooks/set-state-in-effect -- dati del telefono, letti dopo il primo disegno */
    if (v.instrument && INSTRUMENTS.some((i) => i.id === v.instrument)) {
      setInstrument(v.instrument)
      if (v.tuning && instrumentOf(v.instrument).tunings.some((x) => x.id === v.tuning)) setTuning(v.tuning)
      else setTuning(instrumentOf(v.instrument).tunings[0].id)
    }
    if (typeof v.a4 === 'number') setA4(Math.min(A4_MAX, Math.max(A4_MIN, Math.round(v.a4))))
    if (v.naming === 'letters' || v.naming === 'solfege') setNaming(v.naming)
    if (typeof v.tolerance === 'number' && TOLERANCES.includes(v.tolerance)) setTolerance(v.tolerance)
    if (typeof v.strobe === 'boolean') setStrobe(v.strobe)
    if (typeof v.sensitivity === 'number') setSensitivity(Math.min(1, Math.max(0, v.sensitivity)))
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => release()
  }, [])

  useEffect(() => {
    if (ready) saveTunerSettings({ instrument, tuning, a4, naming, tolerance, strobe, sensitivity })
  }, [ready, instrument, tuning, a4, naming, tolerance, strobe, sensitivity])

  // Il motore legge le impostazioni attuali; cambiando corde si riparte con i segni di spunta
  useEffect(() => {
    Object.assign(L.current, { strings, a4, manual, tolerance, sensitivity })
  }, [strings, a4, manual, tolerance, sensitivity])
  const stringsKey = strings.join(',')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nuove corde, nuovi segni di spunta
    setTuned(strings.map(() => false))
    setManual(null)
    setGuideIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stringsKey])

  // Passo passo: si accorda la corda della guida
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la guida decide la corda da ascoltare
    if (guided && strings.length) setManual(guideIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guided, guideIndex, stringsKey])

  // Corda accordata: dopo un attimo si passa alla prossima ancora da accordare
  useEffect(() => {
    if (!guided || !tuned[guideIndex]) return
    const next = tuned.findIndex((v, i) => i > guideIndex && !v)
    if (next < 0) return
    const id = setTimeout(() => setGuideIndex(next), 1400)
    return () => clearTimeout(id)
  }, [guided, tuned, guideIndex])

  function release() {
    cancelAnimationFrame(frame.current)
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    void ctxRef.current?.close().catch(() => {})
    void wakeRef.current?.release().catch(() => {})
    streamRef.current = null
    ctxRef.current = null
    wakeRef.current = null
  }

  const audio = () => {
    if (ctxRef.current) return ctxRef.current
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctxRef.current = new Ctx()
    return ctxRef.current
  }

  const start = async () => {
    setError(null)
    let stream: MediaStream
    try {
      // Niente filtri del telefono: cambierebbero il suono dello strumento
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    } catch {
      return setError(t('errorMic'))
    }
    const ctx = audio()
    await ctx.resume().catch(() => {})
    streamRef.current = stream
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 8192
    ctx.createMediaStreamSource(stream).connect(analyser)
    const full = new Float32Array(analyser.fftSize)
    let lastDetect = 0
    setRunning(true)
    ;(navigator as WakeNavigator).wakeLock
      ?.request('screen')
      .then((lock) => (wakeRef.current = lock))
      .catch(() => {})

    const loop = () => {
      const time = now()
      const s = L.current
      // Strobo: le strisce scorrono più veloci quanto più la nota è lontana
      if (s.lastSeen && time - s.lastSeen < 400) setPhase(s.strobePhase)
      // Analisi 20 volte al secondo: precisa e leggera per il telefono
      if (time - lastDetect >= 50 && time > s.mutedUntil) {
        lastDetect = time
        analyser.getFloatTimeDomainData(full)
        const [lo, hi] = searchRange(s.manual !== null && s.strings[s.manual] !== undefined ? [s.strings[s.manual]] : s.strings, s.a4)
        // Finestra adatta alla nota più grave (almeno due periodi e mezzo)
        const need = Math.ceil((ctx.sampleRate / lo) * 2.5)
        const size = Math.min(full.length, 2 ** Math.ceil(Math.log2(Math.max(1024, need))))
        const buf = full.subarray(full.length - size)
        let rms = 0
        for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i]
        rms = Math.sqrt(rms / buf.length)
        // Sensibilità: più è alta, più si ascoltano anche i suoni deboli
        const gate = 0.02 - s.sensitivity * 0.018
        const found = rms > gate ? detectPitch(buf, ctx.sampleRate, lo, hi) : null
        if (found && found.clarity > 0.8) {
          s.recent.push(found.freq)
          if (s.recent.length > 5) s.recent.shift()
          const freq = median(s.recent)
          s.lastSeen = time
          let stringIndex: number | null = null
          let target: number | null = null
          if (s.strings.length) {
            // Corda scelta toccandola, oppure la più vicina alla nota suonata
            stringIndex = s.manual ?? s.strings.reduce((best, m, i) => (Math.abs(centsBetween(freq, midiToFreq(m, s.a4))) < Math.abs(centsBetween(freq, midiToFreq(s.strings[best], s.a4))) ? i : best), 0)
            target = midiToFreq(s.strings[stringIndex], s.a4)
          }
          const near = nearestNote(freq, s.a4)
          const cents = target ? centsBetween(freq, target) : near.cents
          s.strobePhase = (s.strobePhase + cents * 0.6) % 1000
          setReading({ freq, midi: target ? s.strings[stringIndex!] : near.midi, cents, target, stringIndex })
          // Accordata: dentro la tolleranza per quasi un secondo
          const ok = Math.abs(cents) <= s.tolerance
          const key = stringIndex ?? -2
          if (ok) {
            if (s.held !== key) {
              s.held = key
              s.heldSince = time
            } else if (time - s.heldSince > 800 && stringIndex !== null) {
              setTuned((list) => (list[stringIndex!] ? list : list.map((v, i) => (i === stringIndex ? true : v))))
              navigator.vibrate?.(30)
            }
          } else s.held = -1
        } else if (time - s.lastSeen > 1200) {
          s.recent = []
          s.held = -1
          setReading(null)
        }
      }
      frame.current = requestAnimationFrame(loop)
    }
    frame.current = requestAnimationFrame(loop)
  }

  const stop = () => {
    release()
    setRunning(false)
    setReading(null)
  }

  // Suono di riferimento della corda: mentre suona l'accordatore non ascolta (non sente sé stesso)
  const reference = (midi: number) => {
    const ctx = audio()
    void ctx.resume().catch(() => {})
    playReference(ctx, midiToFreq(midi, a4))
    L.current.mutedUntil = now() + 2600
    L.current.recent = []
  }

  const pickString = (i: number) => {
    if (guided) {
      setGuideIndex(i)
      L.current.recent = []
      return
    }
    setManual((m) => (m === i ? null : i))
    L.current.recent = []
  }

  const chooseInstrument = (id: string) => {
    setInstrument(id)
    setTuning(instrumentOf(id).tunings[0].id)
  }

  const cents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0
  const inTune = !!reading && Math.abs(reading.cents) <= tolerance
  const color = !reading ? '#a8a29e' : inTune ? '#16a34a' : Math.abs(reading.cents) <= 15 ? '#ca8a04' : '#dc2626'
  const allTuned = strings.length > 0 && tuned.length === strings.length && tuned.every(Boolean)
  const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-bold ${on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/40 bg-white text-[var(--ink)]'}`
  // Ago: da −50 a +50 centesimi su mezzo cerchio
  const angle = (cents / 50) * 80

  return (
    <div className="space-y-5">
      <section className={`${card} text-center`}>
        {/* Nota e indicatore */}
        <p className="text-6xl font-extrabold leading-none" style={{ color }}>
          {reading ? noteName(reading.midi, naming) : '—'}
        </p>
        <p className="mt-2 h-5 text-sm font-semibold tabular-nums text-[var(--muted)]">
          {reading ? `${reading.freq.toFixed(1)} Hz${reading.target ? ` · ${t('target', { hz: reading.target.toFixed(1) })}` : ''}` : running ? t('playNote') : t('idle')}
        </p>

        {strobe ? (
          <div className="relative mx-auto mt-4 h-20 max-w-md overflow-hidden rounded-2xl border-2" style={{ borderColor: color }} aria-hidden>
            <div
              className="absolute inset-y-0 -left-20 right-[-80px]"
              style={{ backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 20px, transparent 20px 40px)`, transform: `translateX(${inTune ? 0 : (phase % 40) - 40}px)`, opacity: reading ? 0.85 : 0.2 }}
            />
            <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[var(--ink)]" />
          </div>
        ) : (
          <svg viewBox="0 0 220 125" className="mx-auto mt-2 h-40 w-full max-w-sm" role="img" aria-label={reading ? t('centsAria', { cents: Math.round(reading.cents) }) : t('idle')}>
            {/* Zona verde della tolleranza */}
            {[-50, -25, 0, 25, 50].map((c) => {
              const a = ((c / 50) * 80 - 90) * (Math.PI / 180)
              return <line key={c} x1={110 + 92 * Math.cos(a)} y1={115 + 92 * Math.sin(a)} x2={110 + (c === 0 ? 76 : 82) * Math.cos(a)} y2={115 + (c === 0 ? 76 : 82) * Math.sin(a)} stroke="#a8a29e" strokeWidth={c === 0 ? 3 : 2} />
            })}
            <path d={describeArc(110, 115, 98, -((tolerance / 50) * 80), (tolerance / 50) * 80)} stroke="#16a34a" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.8" />
            <path d={describeArc(110, 115, 98, -80, 80)} stroke="#e7e5e4" strokeWidth="2" fill="none" />
            <text x="22" y="122" fontSize="11" fill="#78716c">−50</text>
            <text x="186" y="122" fontSize="11" fill="#78716c">+50</text>
            <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '110px 115px', transition: 'transform 120ms linear' }}>
              <line x1="110" y1="115" x2="110" y2="24" stroke={color} strokeWidth="4" strokeLinecap="round" />
            </g>
            <circle cx="110" cy="115" r="7" fill={color} />
          </svg>
        )}

        <p className="mt-1 h-8 text-xl font-extrabold" style={{ color }}>
          {reading ? (inTune ? t('inTune') : reading.cents < 0 ? t('flat', { cents: Math.abs(Math.round(reading.cents)) }) : t('sharp', { cents: Math.round(reading.cents) })) : ''}
        </p>
        <p className="min-h-5 text-sm text-[var(--muted)]">{reading && !inTune ? (reading.cents < 0 ? t('flatHint') : t('sharpHint')) : ''}</p>

        {/* Corde: toccandone una si sceglie quella da accordare e se ne sente il suono */}
        {strings.length > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap justify-center gap-2">
              {strings.map((m, i) => {
                const active = reading?.stringIndex === i
                return (
                  <button
                    key={`${i}-${m}`}
                    type="button"
                    onClick={() => pickString(i)}
                    aria-pressed={manual === i}
                    className={`relative flex h-14 min-w-14 flex-col items-center justify-center rounded-2xl border-2 px-2 font-extrabold transition ${manual === i ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : active ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-[var(--gold)]/30 bg-white text-[var(--ink)]'}`}
                  >
                    <span className="text-base leading-none">{noteName(m, naming, false)}</span>
                    <span className="text-[10px] font-bold opacity-70">{noteName(m, naming)}</span>
                    {tuned[i] && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">{guided ? t('guidedHint') : manual === null ? t('autoHint') : t('manualHint', { note: noteName(strings[manual], naming) })}</p>
            {manual !== null && (
              <button type="button" onClick={() => reference(strings[manual])} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--gold)]/50 px-4 text-sm font-bold text-[var(--ink)]">
                <Volume2 className="h-4 w-4 text-[var(--gold)]" /> {t('playReference')}
              </button>
            )}
            <label className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
              <input
                type="checkbox"
                checked={guided}
                onChange={(e) => {
                  setGuided(e.target.checked)
                  if (!e.target.checked) setManual(null)
                }}
                className="h-5 w-5 accent-[var(--gold)]"
              />
              {t('guided')}
            </label>
            {guided && (
              <GuidedTuning
                instrument={instrument}
                strings={strings}
                index={Math.min(guideIndex, strings.length - 1)}
                naming={naming}
                cents={reading && reading.stringIndex === guideIndex ? reading.cents : null}
                tolerance={tolerance}
                tuned={tuned}
                onPrev={() => setGuideIndex((i) => Math.max(0, i - 1))}
                onNext={() => setGuideIndex((i) => Math.min(strings.length - 1, i + 1))}
              />
            )}
            {allTuned && <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm font-extrabold text-emerald-800">{t('allTuned')}</p>}
          </div>
        )}

        <div className="mt-5 flex justify-center">
          {running ? (
            <button type="button" onClick={stop} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-red-600 px-8 text-lg font-bold text-white">
              <Square className="h-5 w-5" /> {t('stop')}
            </button>
          ) : (
            <button type="button" onClick={() => void start()} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-8 text-lg font-bold text-[var(--gold-bright)]">
              <Mic className="h-5 w-5" /> {t('start')}
            </button>
          )}
        </div>
        {error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      <section className={`${card} space-y-4`}>
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">{t('instrumentTitle')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INSTRUMENTS.map((i) => (
              <button key={i.id} type="button" onClick={() => chooseInstrument(i.id)} aria-pressed={instrument === i.id} className={chip(instrument === i.id)}>
                {t(`inst_${i.id}`)}
              </button>
            ))}
          </div>
        </div>
        {inst.tunings.length > 1 && (
          <label className="block">
            <span className="text-sm font-bold text-[var(--ink)]">{t('tuningTitle')}</span>
            <select value={tun.id} onChange={(e) => setTuning(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[16px] font-semibold text-[var(--ink)]">
              {inst.tunings.map((x) => (
                <option key={x.id} value={x.id}>
                  {t(`tun_${inst.id}_${x.id}`)} · {x.strings.map((m) => noteName(m, naming, false)).join(' ')}
                </option>
              ))}
            </select>
          </label>
        )}
        <div>
          <p className="text-sm font-bold text-[var(--ink)]">{t('a4Title')}</p>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => setA4((v) => Math.max(A4_MIN, v - 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gold)]/40 text-[var(--ink)]" aria-label="−1 Hz">
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-24 text-center text-lg font-extrabold tabular-nums text-[var(--ink)]">{a4} Hz</span>
            <button type="button" onClick={() => setA4((v) => Math.min(A4_MAX, v + 1))} className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gold)]/40 text-[var(--ink)]" aria-label="+1 Hz">
              <Plus className="h-4 w-4" />
            </button>
            {a4 !== A4_DEFAULT && (
              <button type="button" onClick={() => setA4(A4_DEFAULT)} className="text-sm font-bold text-[var(--gold)] underline">
                {t('a4Reset')}
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{t('a4Hint')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-bold text-[var(--ink)]">{t('namingTitle')}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setNaming('solfege')} aria-pressed={naming === 'solfege'} className={chip(naming === 'solfege')}>
                Do Re Mi
              </button>
              <button type="button" onClick={() => setNaming('letters')} aria-pressed={naming === 'letters'} className={chip(naming === 'letters')}>
                C D E
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--ink)]">{t('toleranceTitle')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TOLERANCES.map((v) => (
                <button key={v} type="button" onClick={() => setTolerance(v)} aria-pressed={tolerance === v} className={chip(tolerance === v)}>
                  ±{v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold text-[var(--ink)]">
          <input type="checkbox" checked={strobe} onChange={(e) => setStrobe(e.target.checked)} className="h-5 w-5 accent-[var(--gold)]" />
          {t('strobe')}
        </label>
        <label className="block text-sm font-semibold text-[var(--ink)]">
          {t('sensitivity')}
          <input type="range" min={0} max={1} step={0.05} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} className="mt-2 w-full accent-[var(--gold)]" />
          <span className="block text-xs font-normal text-[var(--muted)]">{t('sensitivityHint')}</span>
        </label>
      </section>

      <p className="text-center text-xs text-[var(--muted)]">{t('privacy')}</p>
    </div>
  )
}

// Arco da un angolo all'altro (gradi, 0 = in alto)
function describeArc(cx: number, cy: number, r: number, from: number, to: number) {
  const p = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const [x1, y1] = p(from)
  const [x2, y2] = p(to)
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

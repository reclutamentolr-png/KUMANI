'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, Mic, Save, SlidersHorizontal, Square, Trash2 } from 'lucide-react'
import { deliverFiles } from '@/lib/deliverFiles'
import { askConfirm } from '@/lib/confirm'
import {
  DEFAULT_CALIBRATION,
  DEFAULT_THRESHOLD,
  MAX_SECONDS,
  clock,
  drawChart,
  duration,
  leq,
  levelColor,
  levelOf,
  loadSessions,
  saveSessions,
  sessionPdf,
  sessionStats,
  toDb,
  type NoiseEvent,
  type NoiseSession,
} from '@/lib/fonometro'

// Fonometro: misura dal vivo, registro dei momenti sopra la soglia, misure
// salvate nel telefono e PDF da mandare (amministratore, Comune, vicini).

type WakeLock = { release: () => Promise<void> }
type WakeNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }

const SETTINGS_KEY = 'kumani:fonometro:settings'

export default function FonometroApp() {
  const t = useTranslations('fonometro')
  const locale = useLocale()
  const [running, setRunning] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const [session, setSession] = useState<NoiseSession | null>(null)
  const [saved, setSaved] = useState<NoiseSession[]>([])
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [calibration, setCalibration] = useState(DEFAULT_CALIBRATION)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [liveStats, setLiveStats] = useState<ReturnType<typeof sessionStats> | null>(null)

  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef(0)
  const wakeRef = useRef<WakeLock | null>(null)
  const liveCanvas = useRef<HTMLCanvasElement>(null)
  const doneCanvas = useRef<HTMLCanvasElement>(null)
  // Dati della misura in corso (fuori dallo stato: si aggiornano molte volte al secondo)
  const live = useRef<{ start: number; samples: number[]; events: NoiseEvent[]; bucket: number[]; bucketStart: number; open: NoiseEvent | null; quiet: number }>({ start: 0, samples: [], events: [], bucket: [], bucketStart: 0, open: null, quiet: 0 })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- registro nel telefono, si legge solo qui
    setSaved(loadSessions())
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as { threshold?: number; calibration?: number }
      if (typeof s.threshold === 'number') setThreshold(s.threshold)
      if (typeof s.calibration === 'number') setCalibration(s.calibration)
    } catch {}
    // Uscendo dalla pagina il microfono si spegne
    return () => release()
  }, [])

  function release() {
    cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    void ctxRef.current?.close().catch(() => {})
    void wakeRef.current?.release().catch(() => {})
    streamRef.current = null
    ctxRef.current = null
    wakeRef.current = null
  }

  const storeSettings = (next: { threshold: number; calibration: number }) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch {}
  }

  // Fine di un secondo: il valore del secondo e i momenti sopra la soglia
  const closeSecond = (th: number) => {
    const L = live.current
    if (!L.bucket.length) return
    const v = leq(L.bucket)
    L.bucket = []
    L.samples.push(v)
    const at = (L.samples.length - 1) * 1000
    if (v >= th) {
      L.quiet = 0
      if (!L.open) L.open = { at, seconds: 1, peak: v }
      else {
        L.open.seconds = L.samples.length - L.open.at / 1000
        L.open.peak = Math.max(L.open.peak, v)
      }
    } else if (L.open && ++L.quiet >= 2) {
      // Due secondi sotto la soglia: il momento rumoroso è finito
      L.events.push(L.open)
      L.open = null
      L.quiet = 0
    }
  }

  const stop = () => {
    release()
    const L = live.current
    closeSecond(threshold)
    if (L.open) L.events.push(L.open)
    L.open = null
    setRunning(false)
    setNow(null)
    setLiveStats(null)
    if (!L.samples.length) return
    setSession({ id: String(L.start), start: L.start, end: L.start + L.samples.length * 1000, place: '', note: '', threshold, calibration, samples: L.samples, events: L.events })
  }

  const start = async () => {
    setError(null)
    setSession(null)
    let stream: MediaStream
    try {
      // Niente filtri del telefono: abbasserebbero o alzerebbero il volume da soli
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    } catch {
      return setError(t('errorMic'))
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    ctxRef.current = ctx
    streamRef.current = stream
    const buf = new Float32Array(analyser.fftSize)
    live.current = { start: Date.now(), samples: [], events: [], bucket: [], bucketStart: performance.now(), open: null, quiet: 0 }
    const th = threshold
    const cal = calibration
    let last = 0
    // Valore mostrato: media dell'ultimo mezzo secondo (come la scala «veloce» dei fonometri)
    const recent: number[] = []
    const loop = (ts: number) => {
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      const db = toDb(Math.sqrt(sum / buf.length), cal)
      const L = live.current
      L.bucket.push(db)
      recent.push(db)
      if (recent.length > 30) recent.shift()
      if (ts - L.bucketStart >= 1000) {
        L.bucketStart = ts
        closeSecond(th)
        if (L.samples.length >= MAX_SECONDS) {
          stop()
          return
        }
      }
      // Numero e grafico 8 volte al secondo
      if (ts - last > 125) {
        last = ts
        setNow(leq(recent))
        setLiveStats(sessionStats({ samples: L.samples, threshold: th, events: L.open ? [...L.events, L.open] : L.events }))
        const c = liveCanvas.current
        if (c) drawChart(c, L.samples.slice(-120), th)
      }
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)
    setRunning(true)
    // Schermo acceso: con lo schermo spento il telefono smette di ascoltare
    ;(navigator as WakeNavigator).wakeLock
      ?.request('screen')
      .then((lock) => (wakeRef.current = lock))
      .catch(() => {})
  }

  // Grafico della misura finita
  useEffect(() => {
    if (session && doneCanvas.current) drawChart(doneCanvas.current, session.samples, session.threshold)
  }, [session])

  const keep = () => {
    if (!session) return
    const list = [session, ...saved.filter((s) => s.id !== session.id)]
    if (!saveSessions(list)) return setError(t('errorSave'))
    setSaved(list)
  }

  // «Scarta questa misura»: sparisce anche dal registro, se era stata salvata
  const discard = async () => {
    if (!session) return
    if (!(await askConfirm(t('discardConfirm')))) return
    remove(session.id)
    setSession(null)
  }

  const remove = (id: string) => {
    const list = saved.filter((s) => s.id !== id)
    saveSessions(list)
    setSaved(list)
  }

  const pdf = async (s: NoiseSession) => {
    setBusy(true)
    try {
      const blob = await sessionPdf(
        s,
        {
          title: t('pdfTitle'),
          place: t('place'),
          note: t('note'),
          date: t('pdfDate'),
          from: t('pdfFrom'),
          to: t('pdfTo'),
          length: t('statLength'),
          average: t('statAverage'),
          max: t('statMax'),
          min: t('statMin'),
          threshold: t('threshold'),
          over: t('statOver'),
          events: t('eventsTitle'),
          eventAt: t('eventAt'),
          eventLong: t('eventLong'),
          eventPeak: t('eventPeak'),
          noEvents: t('noEvents'),
          disclaimer: t('disclaimer'),
          footer: t('pdfFooter'),
        },
        locale
      )
      const name = `KUMANI_rumore_${new Date(s.start).toISOString().slice(0, 10)}.pdf`
      await deliverFiles([new File([blob], name, { type: 'application/pdf' })])
    } catch (e) {
      console.error('[fonometro] pdf', e)
      setError(t('errorPdf'))
    } finally {
      setBusy(false)
    }
  }

  const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
  const doneStats = session ? sessionStats(session) : null
  const isSaved = !!session && saved.some((s) => s.id === session.id)

  return (
    <div className="space-y-5">
      {/* Misura dal vivo */}
      <section className={`${card} text-center`}>
        <p className="text-7xl font-extrabold tabular-nums" style={{ color: now !== null ? levelColor(now) : '#a8a29e' }} aria-live="off">
          {now !== null ? Math.round(now) : '--'}
          <span className="ml-1 text-2xl font-bold text-[var(--muted)]">dB</span>
        </p>
        <p className="mt-1 h-5 text-sm font-semibold text-[var(--ink)]">{now !== null ? t(`level_${levelOf(now)}`) : t('levelIdle')}</p>
        <div className="mx-auto mt-3 h-3 max-w-sm overflow-hidden rounded-full bg-[var(--background)]">
          <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${now !== null ? Math.min(100, Math.max(0, ((now - 20) / 90) * 100)) : 0}%`, background: now !== null ? levelColor(now) : 'transparent' }} />
        </div>
        {running && (
          <>
            <canvas ref={liveCanvas} width={700} height={220} className="mt-4 h-28 w-full rounded-xl border border-gray-100" />
            {liveStats && (
              <p className="mt-2 text-sm text-[var(--muted)]">
                {t('liveLine', { time: duration(liveStats.seconds), average: liveStats.average, max: liveStats.max, events: liveStats.events })}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--muted)]">{t('keepOn')}</p>
          </>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {running ? (
            <button type="button" onClick={() => stop()} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-red-600 px-8 text-lg font-bold text-white">
              <Square className="h-5 w-5" /> {t('stop')}
            </button>
          ) : (
            <button type="button" onClick={start} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-8 text-lg font-bold text-[var(--gold-bright)]">
              <Mic className="h-5 w-5" /> {t('start')}
            </button>
          )}
          <button type="button" disabled={running} onClick={() => setShowSettings((v) => !v)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 px-5 font-bold text-[var(--ink)] disabled:opacity-50">
            <SlidersHorizontal className="h-4 w-4" /> {t('settings')}
          </button>
        </div>
        {showSettings && !running && (
          <div className="mt-4 space-y-4 rounded-2xl bg-[var(--background)] p-4 text-left">
            <label className="block text-sm font-semibold text-[var(--ink)]">
              {t('thresholdLabel', { value: threshold })}
              <input
                type="range"
                min={35}
                max={90}
                value={threshold}
                onChange={(e) => {
                  setThreshold(Number(e.target.value))
                  storeSettings({ threshold: Number(e.target.value), calibration })
                }}
                className="mt-2 w-full accent-[var(--gold)]"
              />
              <span className="block text-xs font-normal text-[var(--muted)]">{t('thresholdHint')}</span>
            </label>
            <label className="block text-sm font-semibold text-[var(--ink)]">
              {t('calibrationLabel', { value: calibration - DEFAULT_CALIBRATION > 0 ? `+${calibration - DEFAULT_CALIBRATION}` : calibration - DEFAULT_CALIBRATION })}
              <input
                type="range"
                min={DEFAULT_CALIBRATION - 20}
                max={DEFAULT_CALIBRATION + 20}
                value={calibration}
                onChange={(e) => {
                  setCalibration(Number(e.target.value))
                  storeSettings({ threshold, calibration: Number(e.target.value) })
                }}
                className="mt-2 w-full accent-[var(--gold)]"
              />
              <span className="block text-xs font-normal text-[var(--muted)]">{t('calibrationHint')}</span>
            </label>
          </div>
        )}
        {error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      {/* Misura finita */}
      {session && doneStats && (
        <section className={`${card} space-y-4`}>
          <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('doneTitle', { from: clock(session.start), to: clock(session.end) })}</h2>
          <canvas ref={doneCanvas} width={700} height={220} className="h-32 w-full rounded-xl border border-gray-100" />
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['statLength', duration(doneStats.seconds)],
                ['statAverage', `${doneStats.average} dB`],
                ['statMax', `${doneStats.max} dB`],
                ['statOver', duration(doneStats.secondsOver)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-[var(--background)] p-3">
                <dt className="text-xs text-[var(--muted)]">{t(k)}</dt>
                <dd className="text-lg font-extrabold text-[var(--ink)]">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">{t('eventsTitle')}</h3>
            {session.events.length ? (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                {session.events.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3 rounded-lg bg-[var(--background)] px-3 py-1.5">
                    <span className="tabular-nums">{clock(session.start + e.at)}</span>
                    <span className="text-[var(--muted)]">{duration(e.seconds)}</span>
                    <span className="font-semibold tabular-nums">{Math.round(e.peak)} dB</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-[var(--muted)]">{t('noEvents')}</p>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={session.place} maxLength={120} onChange={(e) => setSession({ ...session, place: e.target.value })} placeholder={t('placePlaceholder')} className="rounded-xl border border-gray-300 px-3 py-2.5 text-[16px]" aria-label={t('place')} />
            <input value={session.note} maxLength={500} onChange={(e) => setSession({ ...session, note: e.target.value })} placeholder={t('notePlaceholder')} className="rounded-xl border border-gray-300 px-3 py-2.5 text-[16px]" aria-label={t('note')} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={keep} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 font-bold text-[var(--gold-bright)]">
              <Save className="h-4 w-4" /> {isSaved ? t('savedAgain') : t('save')}
            </button>
            <button type="button" disabled={busy} onClick={() => pdf(session)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/50 px-5 font-bold text-[var(--ink)] disabled:opacity-50">
              <Download className="h-4 w-4" /> {t('pdf')}
            </button>
            <button type="button" onClick={discard} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold text-red-700 hover:bg-red-50 sm:ml-auto">
              <Trash2 className="h-4 w-4" /> {t('discard')}
            </button>
          </div>
        </section>
      )}

      {/* Registro */}
      {saved.length > 0 && (
        <section className={`${card} space-y-3`}>
          <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('logTitle')}</h2>
          <ul className="space-y-2">
            {saved.map((s) => {
              const st = sessionStats(s)
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--background)] p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--ink)]">
                      {new Date(s.start).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })} · {clock(s.start)}–{clock(s.end)}
                    </p>
                    <p className="truncate text-sm text-[var(--muted)]">{[s.place, t('logLine', { average: st.average, max: st.max, events: st.events })].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" disabled={busy} onClick={() => pdf(s)} className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink)] hover:bg-white" aria-label={t('pdf')}>
                      <Download className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => remove(s.id)} className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white hover:text-red-600" aria-label={t('delete')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-[var(--muted)]">{t('disclaimer')}</p>
    </div>
  )
}

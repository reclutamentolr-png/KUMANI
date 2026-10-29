'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, FileAudio, LoaderCircle, Mic, ShieldAlert, ShieldCheck, Square, Type } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { extractAudio, joinWords } from '@/lib/vox'
import { scanVoiceText, type VoiceVerdict } from '@/lib/voiceScan'

// «Vocale sospetto?» (Anti-Truffa): un messaggio vocale si carica (da
// WhatsApp: Condividi → Salva su File), si fa ascoltare al microfono mentre
// suona, o se ne incolla il testo. La voce si trascrive nel telefono con lo
// stesso motore di VOX (public/workers/vox-worker.js) e il testo si controlla
// con regole nostre (lib/voiceScan). Niente lascia il dispositivo.

type Phase = 'idle' | 'recording' | 'audio' | 'download' | 'listening' | 'done'
const MAX_SECONDS = 180

// Formato della registrazione: il primo audio che il telefono sa registrare
const audioType = () => (typeof MediaRecorder === 'undefined' ? '' : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((x) => MediaRecorder.isTypeSupported(x)) ?? '')

export default function VocaleSospettoTool() {
  const t = useTranslations('vocaleSospetto')
  // Il controllo conosce le frasi delle truffe in italiano: nelle altre lingue lo si dice chiaro
  const italian = useLocale() === 'it'
  // Pagina lasciata durante l'ascolto: niente trascrizione in sottofondo
  const unmounted = useRef(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [text, setText] = useState('')
  const [verdict, setVerdict] = useState<VoiceVerdict | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [typing, setTyping] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const files = useRef<Record<string, { loaded: number; total: number }>>({})
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(
    () => () => {
      unmounted.current = true
      if (recorder.current) recorder.current.onstop = null
      workerRef.current?.terminate()
      recorder.current?.stream.getTracks().forEach((tr) => tr.stop())
      if (timer.current) clearInterval(timer.current)
    },
    []
  )

  const check = (value: string) => {
    setText(value)
    setVerdict(value.trim() ? scanVoiceText(value) : null)
    setPhase('done')
  }

  // Audio → testo, nel telefono
  const transcribe = async (blob: Blob) => {
    if (unmounted.current) return
    setError(null)
    setVerdict(null)
    setPhase('audio')
    let audio: Float32Array
    try {
      const out = await extractAudio(blob)
      if (out.duration > MAX_SECONDS + 5) {
        setPhase('idle')
        return setError(t('errorLong'))
      }
      audio = out.audio
      if (unmounted.current) return
    } catch {
      setPhase('idle')
      return setError(t('errorAudio'))
    }
    if (!workerRef.current) workerRef.current = new Worker('/workers/vox-worker.js', { type: 'module' })
    const worker = workerRef.current
    // Il motore della voce non si carica (vecchio browser, connessione): niente attesa infinita
    worker.onerror = () => {
      worker.terminate()
      workerRef.current = null
      setPhase('idle')
      setError(t('errorModel'))
    }
    files.current = {}
    setDownloaded(0)
    setPhase('download')
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; file?: string; loaded?: number; total?: number; words?: { text: string; start: number; end: number }[] }
      if (m.type === 'download' && m.file) {
        files.current[m.file] = { loaded: m.loaded ?? 0, total: m.total ?? 0 }
        const all = Object.values(files.current)
        const total = all.reduce((n, x) => n + x.total, 0)
        setDownloaded(total ? Math.round((all.reduce((n, x) => n + x.loaded, 0) / total) * 100) : 0)
      } else if (m.type === 'transcribing') setPhase('listening')
      else if (m.type === 'result') {
        const said = joinWords(m.words ?? [])
          .map((w) => w.text)
          .join(' ')
          .replace(/\s+([,.;:!?])/g, '$1')
          .trim()
        if (!said) {
          setPhase('idle')
          return setError(t('errorNoVoice'))
        }
        check(said)
      } else if (m.type === 'error') {
        setPhase('idle')
        setError(t('errorModel'))
      }
    }
    worker.postMessage({ type: 'transcribe', audio, language: 'italian', model: 'base' }, [audio.buffer])
  }

  // Il vocale suona da un altro telefono o dall'altoparlante: lo si ascolta col microfono
  const record = async () => {
    if (phase === 'recording') {
      recorder.current?.stop()
      return
    }
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } })
    } catch {
      return setError(t('errorMic'))
    }
    const type = audioType()
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    } catch {
      // Il telefono non sa registrare: il microfono si spegne subito
      stream.getTracks().forEach((tr) => tr.stop())
      return setError(t('errorMic'))
    }
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop())
      if (timer.current) clearInterval(timer.current)
      void transcribe(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
    }
    recorder.current = rec
    setSeconds(0)
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS && rec.state === 'recording') rec.stop()
        return s + 1
      })
    }, 1000)
    setPhase('recording')
    rec.start()
  }

  const reset = () => {
    setPhase('idle')
    setText('')
    setVerdict(null)
    setError(null)
    setTyping(false)
  }

  const busy = phase === 'audio' || phase === 'download' || phase === 'listening'
  const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
  const option = 'flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-[var(--gold)]/25 bg-white p-4 text-left transition hover:border-[var(--gold)] disabled:opacity-50'

  const tone = verdict?.risk === 'high' ? 'border-red-300 bg-red-50' : verdict?.risk === 'medium' ? 'border-amber-300 bg-amber-50' : verdict?.risk === 'low' ? 'border-sky-200 bg-sky-50' : 'border-emerald-200 bg-emerald-50'
  const Icon = verdict?.risk === 'high' ? ShieldAlert : verdict?.risk === 'medium' || verdict?.risk === 'low' ? AlertTriangle : ShieldCheck

  return (
    <div className="space-y-5">
      {phase !== 'done' && (
        <section className={`${card} space-y-3`}>
          <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('howTitle')}</h2>
          {!italian && <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{t('italianOnly')}</p>}
          <input ref={inputRef} type="file" accept="audio/*,.opus,.ogg,.m4a,.mp3,.wav,.aac,.amr,.webm" className="sr-only" onChange={(e) => {
              const file = e.target.files?.[0]
              // Si può scegliere di nuovo lo stesso file (dopo un errore)
              e.target.value = ''
              if (file) void transcribe(file)
            }} />
          <button type="button" disabled={busy || phase === 'recording'} onClick={() => inputRef.current?.click()} className={option}>
            <FileAudio className="h-6 w-6 shrink-0 text-[var(--gold)]" />
            <span>
              <span className="block font-bold text-[var(--ink)]">{t('optFile')}</span>
              <span className="block text-sm text-[var(--muted)]">{t('optFileHint')}</span>
            </span>
          </button>
          <button type="button" disabled={busy} onClick={record} className={`${option} ${phase === 'recording' ? 'border-red-400 bg-red-50' : ''}`}>
            {phase === 'recording' ? <Square className="h-6 w-6 shrink-0 text-red-600" /> : <Mic className="h-6 w-6 shrink-0 text-[var(--gold)]" />}
            <span>
              <span className="block font-bold text-[var(--ink)]">{phase === 'recording' ? t('optRecordStop', { seconds }) : t('optRecord')}</span>
              <span className="block text-sm text-[var(--muted)]">{t('optRecordHint')}</span>
            </span>
          </button>
          <button type="button" disabled={busy || phase === 'recording'} onClick={() => setTyping((v) => !v)} className={option}>
            <Type className="h-6 w-6 shrink-0 text-[var(--gold)]" />
            <span>
              <span className="block font-bold text-[var(--ink)]">{t('optText')}</span>
              <span className="block text-sm text-[var(--muted)]">{t('optTextHint')}</span>
            </span>
          </button>
          {typing && (
            <div className="space-y-2">
              <textarea rows={4} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder={t('textPlaceholder')} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[16px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30" />
              <button type="button" disabled={!text.trim()} onClick={() => check(text)} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--ink)] font-bold text-[var(--gold-bright)] disabled:opacity-50">
                {t('checkText')}
              </button>
            </div>
          )}
          {busy && (
            <p className="flex items-center gap-2 rounded-2xl bg-[var(--gold-pale)] p-3 text-sm font-semibold text-[var(--ink)]" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin text-[var(--gold)]" />
              {phase === 'download' ? t('downloading', { percent: downloaded }) : phase === 'listening' ? t('listening') : t('reading')}
            </p>
          )}
          {phase === 'download' && <p className="text-xs text-[var(--muted)]">{t('downloadNote')}</p>}
          {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </section>
      )}

      {phase === 'done' && verdict && (
        <>
          <section className={`rounded-3xl border-2 p-5 sm:p-6 ${tone}`} role="status">
            <p className="flex items-center gap-2 text-xl font-extrabold text-[var(--ink)]">
              <Icon className="h-7 w-7 shrink-0" /> {t(`risk_${verdict.risk}`)}
            </p>
            <p className="mt-1 text-sm text-[var(--ink)]/80">{t(`riskText_${verdict.risk}`)}</p>
            {!italian && <p className="mt-2 rounded-xl bg-white/70 p-2 text-sm font-semibold text-amber-800">{t('italianOnly')}</p>}
          </section>

          {verdict.signals.length > 0 && (
            <section className={`${card} space-y-3`}>
              <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('signalsTitle')}</h2>
              <ul className="space-y-3">
                {verdict.signals.map((s) => (
                  <li key={s.key} className="rounded-2xl bg-[var(--background)] p-3">
                    <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.weight === 3 ? 'bg-red-500' : s.weight === 2 ? 'bg-amber-500' : 'bg-sky-500'}`} />
                      {t(`sig_${s.key}`)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{t(`sigText_${s.key}`)}</p>
                    <p className="mt-1.5 text-sm italic text-[var(--ink)]">«{s.quote}»</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={`${card} space-y-2`}>
            <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('adviceTitle')}</h2>
            <ul className="space-y-1.5 text-sm text-[var(--ink)]">
              {(['advice1', 'advice2', 'advice3', 'advice4'] as const).map((k) => (
                <li key={k} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t(k)}
                </li>
              ))}
            </ul>
            {verdict.risk !== 'none' && (
              <Link href="/app/rete-antitruffa?tab=numero" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-bold text-[var(--gold-bright)]">
                <ShieldAlert className="h-4 w-4" /> {t('report')}
              </Link>
            )}
          </section>

          <details className={card}>
            <summary className="cursor-pointer font-bold text-[var(--ink)]">{t('transcriptTitle')}</summary>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--ink)]">{text}</p>
          </details>

          <button type="button" onClick={reset} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[var(--gold)]/50 bg-white font-bold text-[var(--ink)]">
            {t('again')}
          </button>
        </>
      )}

      <p className="text-center text-xs text-[var(--muted)]">{t('privacy')}</p>
    </div>
  )
}

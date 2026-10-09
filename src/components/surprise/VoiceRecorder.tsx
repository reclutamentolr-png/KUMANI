'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Mic, Square } from 'lucide-react'

// Messaggio vocale registrato dal telefono o dal computer (MediaRecorder),
// massimo 2 minuti. Restituisce un file audio da caricare come le altre foto.
const MAX_SECONDS = 120

function pickMime(): string {
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export default function VoiceRecorder({ onRecorded, disabled }: { onRecorded: (file: File) => void; disabled?: boolean }) {
  const t = useTranslations('surprise')
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- funzione disponibile solo nel browser
    setSupported(typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)
    return () => {
      if (timer.current) clearInterval(timer.current)
      recorder.current?.stream.getTracks().forEach((tr) => tr.stop())
    }
  }, [])

  const stop = () => {
    recorder.current?.stop()
    if (timer.current) clearInterval(timer.current)
    setRecording(false)
  }

  const start = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks: BlobPart[] = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop())
        const type = (rec.mimeType || mime || 'audio/webm').split(';')[0]
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        if (chunks.length) onRecorded(new File(chunks, `vocale.${ext}`, { type }))
      }
      recorder.current = rec
      rec.start()
      setRecording(true)
      setSeconds(0)
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop()
          return s + 1
        })
      }, 1000)
    } catch {
      setError(t('micError'))
    }
  }

  if (!supported) return null
  const mm = String(Math.floor(seconds / 60)).padStart(1, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return (
    <div>
      {recording ? (
        <button type="button" onClick={stop} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white">
          <Square className="h-4 w-4 fill-white" /> {t('recordStop')} · {mm}:{ss}
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:border-[var(--gold)] disabled:opacity-50"
        >
          <Mic className="h-4 w-4 text-red-600" /> {t('recordVoice')}
        </button>
      )}
      {error && <p className="mt-1 text-xs font-semibold text-amber-700">{error}</p>}
    </div>
  )
}

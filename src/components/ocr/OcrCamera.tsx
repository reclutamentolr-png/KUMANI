'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, LoaderCircle, X } from 'lucide-react'
import type { Worker } from 'tesseract.js'
import { parseMrz, type MrzResult } from '@/lib/ocr/mrz'
import { parseBill, type BillGuess } from '@/lib/ocr/bill'

// Lettura del testo con la fotocamera posteriore, tutta nel telefono
// (Tesseract): la foto non viene salvata né inviata, si scaricano solo i file
// del lettore la prima volta.
// - mode 'mrz': documenti. Si inquadrano le righe «<<<» nel riquadro: la
//   lettura riparte da sola finché la scadenza non supera le cifre di controllo.
// - mode 'bill': bollette. Uno scatto, poi importo, scadenza e chi la emette.

type Props =
  | { mode: 'mrz'; onResult: (r: MrzResult) => void; onClose: () => void }
  | { mode: 'bill'; onResult: (r: BillGuess) => void; onClose: () => void }

// Riquadro delle righe «<<<» (frazioni dello schermo)
const GUIDE = { w: 0.9, h: 0.22, top: 0.5 }

let mrzWorker: Promise<Worker> | null = null
let billWorker: Promise<Worker> | null = null
async function worker(mode: 'mrz' | 'bill') {
  const { createWorker, PSM } = await import('tesseract.js')
  if (mode === 'mrz') {
    mrzWorker ??= createWorker('eng').then(async (w) => {
      await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<', tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
      return w
    })
    return mrzWorker.catch((e) => ((mrzWorker = null), Promise.reject(e)))
  }
  billWorker ??= createWorker('ita')
  return billWorker.catch((e) => ((billWorker = null), Promise.reject(e)))
}

// Pezzo del video in scala di grigi con più contrasto: l'OCR legge meglio
function grab(video: HTMLVideoElement, sx: number, sy: number, sw: number, sh: number, outW: number) {
  const c = document.createElement('canvas')
  c.width = outW
  c.height = Math.round((outW * sh) / sw)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.filter = 'grayscale(1) contrast(1.6)'
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return c
}

export default function OcrCamera(props: Props) {
  const { mode, onClose } = props
  const t = useTranslations('camera')
  const videoRef = useRef<HTMLVideoElement>(null)
  const onResultRef = useRef(props.onResult)
  const [state, setState] = useState<'starting' | 'live' | 'reading' | 'denied' | 'error'>('starting')
  const [hint, setHint] = useState<'mrzHint' | 'mrzReading' | 'billHint' | 'billNothing'>(mode === 'mrz' ? 'mrzHint' : 'billHint')
  useEffect(() => {
    onResultRef.current = props.onResult
  })

  useEffect(() => {
    let alive = true
    let stream: MediaStream | null = null
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then(async (s) => {
        if (!alive) return s.getTracks().forEach((tr) => tr.stop())
        stream = s
        const video = videoRef.current!
        video.muted = true
        video.setAttribute('playsinline', '')
        video.srcObject = s
        await video.play().catch(() => {})
        setState('live')
        // Il lettore si prepara mentre si inquadra
        void worker(mode).catch(() => {})
        if (mode !== 'mrz') return
        // Documenti: si legge il riquadro di continuo, finché la data non torna
        const w = await worker(mode)
        setHint('mrzReading')
        while (alive) {
          if (video.readyState >= 2 && video.videoWidth) {
            // Riquadro dello schermo → coordinate del video (object-cover)
            const box = video.getBoundingClientRect()
            const scale = Math.max(box.width / video.videoWidth, box.height / video.videoHeight)
            const offX = (video.videoWidth * scale - box.width) / 2
            const offY = (video.videoHeight * scale - box.height) / 2
            const gx = ((1 - GUIDE.w) / 2) * box.width
            const gy = GUIDE.top * box.height - (GUIDE.h * box.height) / 2
            const sx = (gx + offX) / scale
            const sy = (gy + offY) / scale
            const sw = (GUIDE.w * box.width) / scale
            const sh = (GUIDE.h * box.height) / scale
            const { data } = await w.recognize(grab(video, sx, sy, sw, sh, 1400))
            const found = parseMrz(data.text)
            if (found && alive) {
              navigator.vibrate?.(60)
              onResultRef.current(found as never)
              return
            }
          }
          await new Promise((r) => setTimeout(r, 250))
        }
      })
      .catch((e: DOMException) => alive && setState(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'error'))
    return () => {
      alive = false
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [mode])

  // Bollette: uno scatto e la lettura di tutta la pagina
  const shootBill = async () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    setState('reading')
    try {
      const w = await worker('bill')
      const { data } = await w.recognize(grab(video, 0, 0, video.videoWidth, video.videoHeight, Math.min(1800, video.videoWidth)))
      const guess = parseBill(data.text)
      if (!guess.amount && !guess.dueDate && !guess.provider) {
        setHint('billNothing')
        setState('live')
        return
      }
      navigator.vibrate?.(60)
      onResultRef.current(guess as never)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={t(mode === 'mrz' ? 'mrzTitle' : 'billTitle')}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {mode === 'mrz' && state === 'live' && (
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
            style={{ width: `${GUIDE.w * 100}%`, height: `${GUIDE.h * 100}%`, top: `${GUIDE.top * 100}%` }}
            aria-hidden
          />
        )}
        {(state === 'live' || state === 'reading') && (
          <p className="absolute inset-x-4 top-[max(16px,env(safe-area-inset-top))] mx-auto max-w-md rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-[var(--ink)] shadow-lg" role="status">
            {state === 'reading' ? t('billReading') : t(hint)}
          </p>
        )}
        {state !== 'live' && state !== 'reading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state === 'starting' ? <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold-bright)]" /> : <p className="max-w-sm text-sm text-amber-200">{t(state === 'denied' ? 'ocrDenied' : 'ocrError')}</p>}
          </div>
        )}
        {state === 'reading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <LoaderCircle className="h-10 w-10 animate-spin text-[var(--gold-bright)]" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 bg-black px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={onClose} className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-5 font-semibold hover:bg-white/20">
          <X className="h-5 w-5" /> {t('ocrManual')}
        </button>
        {mode === 'bill' && (
          <button type="button" disabled={state !== 'live'} onClick={() => void shootBill()} className="flex h-14 items-center gap-2 rounded-full bg-[var(--gold)] px-6 font-bold text-[var(--ink)] disabled:opacity-40">
            <Camera className="h-5 w-5" /> {t('billShoot')}
          </button>
        )}
      </div>
    </div>
  )
}

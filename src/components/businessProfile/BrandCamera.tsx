'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, LoaderCircle, SwitchCamera, X } from 'lucide-react'
import { colorsFromPixels } from '@/lib/brand'

// I colori del brand dalla realtà: si inquadra l'insegna, il bancone, il
// logo stampato o la vetrina e i colori del centro dell'inquadratura si
// aggiornano dal vivo. «Usa questi colori» li ferma e li passa alla scelta
// dei ruoli. Tutto nel telefono: nessuna foto viene salvata o inviata.

const SAMPLE = 64
const EVERY_MS = 350

export default function BrandCamera({ onColors, onClose }: { onColors: (swatches: string[]) => void; onClose: () => void }) {
  const t = useTranslations('brand')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [state, setState] = useState<'starting' | 'live' | 'denied' | 'error'>('starting')
  const [swatches, setSwatches] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    let stream: MediaStream | null = null
    let timer = 0
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE
    canvas.height = SAMPLE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then(async (s) => {
        if (!alive) return s.getTracks().forEach((tr) => tr.stop())
        stream = s
        const video = videoRef.current!
        video.muted = true
        video.setAttribute('playsinline', '')
        video.srcObject = s
        await video.play().catch(() => {})
        setState('live')
        // Ogni tanto: il quadrato al centro (60% del lato corto), rimpicciolito
        timer = window.setInterval(() => {
          if (!ctx || video.readyState < 2 || !video.videoWidth) return
          const side = Math.min(video.videoWidth, video.videoHeight) * 0.6
          ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, SAMPLE, SAMPLE)
          const next = colorsFromPixels(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data, 6)
          setSwatches((prev) => (prev.join() === next.join() ? prev : next))
        }, EVERY_MS)
      })
      .catch((e: DOMException) => alive && setState(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'error'))

    return () => {
      alive = false
      window.clearInterval(timer)
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [facing])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={t('cameraTitle')}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        {state === 'live' && (
          <>
            {/* Mirino: si leggono i colori dentro il quadrato */}
            <span className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" aria-hidden />
            <p className="absolute inset-x-4 top-[max(16px,env(safe-area-inset-top))] mx-auto max-w-md rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-[var(--ink)] shadow-lg">{t('cameraHint')}</p>
          </>
        )}
        {state !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state === 'starting' ? <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold-bright)]" /> : <p className="max-w-sm text-sm text-amber-200">{t(state === 'denied' ? 'cameraDenied' : 'cameraError')}</p>}
          </div>
        )}
      </div>

      <div className="space-y-3 bg-black px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        {/* Colori trovati, dal più presente */}
        <div className="flex min-h-12 items-center justify-center gap-2" aria-live="polite" aria-label={t('cameraSwatches')}>
          {swatches.map((hex) => (
            <span key={hex} className="h-11 w-11 rounded-xl border-2 border-white/80 shadow" style={{ background: hex }} title={hex} />
          ))}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label={t('cameraClose')} title={t('cameraClose')}>
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={!swatches.length}
            onClick={() => onColors(swatches)}
            className="flex h-14 items-center gap-2 rounded-full bg-[var(--gold)] px-6 font-bold text-[var(--ink)] disabled:opacity-40"
          >
            <Check className="h-5 w-5" /> {t('cameraUse')}
          </button>
          <button
            type="button"
            onClick={() => {
              setState('starting')
              setFacing((f) => (f === 'environment' ? 'user' : 'environment'))
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label={t('cameraSwitch')}
            title={t('cameraSwitch')}
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { HOPLA_ID_RE } from '@/lib/hopla'

// Fotocamera dentro la pagina: legge il codice QR di Hoplà sul computer e
// apre il nuovo collegamento. Accetta solo codici di Hoplà di questo sito.
export default function HoplaScanner({ onClose, onFound }: { onClose: () => void; onFound: (path: string, id: string) => void }) {
  const t = useTranslations('hopla')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<'denied' | 'wrong' | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      } catch {
        setError('denied')
        return
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => {})
      const { default: jsQR } = await import('jsqr')
      timer = setInterval(() => {
        if (!ctx || video.readyState < 2 || !video.videoWidth) return
        // Lettura su un'immagine ridotta: più veloce e basta per un QR
        const scale = Math.min(1, 640 / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
        if (!code?.data) return
        try {
          const url = new URL(code.data)
          const id = url.pathname.split('/').pop() ?? ''
          if (url.origin === window.location.origin && /\/hopla\/[^/]+$/.test(url.pathname) && HOPLA_ID_RE.test(id)) {
            if (timer) clearInterval(timer)
            stream?.getTracks().forEach((track) => track.stop())
            onFound(url.pathname, id)
            return
          }
        } catch {
          // non è un indirizzo
        }
        setError('wrong')
      }, 250)
    }
    start()
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-labelledby="hopla-scan-title">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <p id="hopla-scan-title" className="text-lg font-bold">
          {t('scanTitle')}
        </p>
        <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15" aria-label={t('scanClose')}>
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute aspect-square w-[70%] max-w-sm rounded-3xl border-4 border-[var(--gold-bright)] shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" aria-hidden="true" />
      </div>
      {error && (
        <p className="m-4 rounded-2xl bg-white p-4 text-center text-sm font-semibold text-[var(--ink)]" role="alert">
          {error === 'denied' ? t('scanDenied') : t('scanWrong')}
        </p>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

// Fotocamera dell'organizzatore per inquadrare il pass QR di un iscritto
// (stessa tecnica di FidelityScanner: getUserMedia + jsQR), con inserimento
// manuale delle ultime 6 cifre del pass se la fotocamera non va.
export default function EventScanner({ onResult, onCancel }: { onResult: (value: string) => void; onCancel: () => void }) {
  const t = useTranslations('eventsOrganizer')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [cameraError, setCameraError] = useState(false)
  const [manualCode, setManualCode] = useState('')

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false

    const tick = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
      if (code?.data) {
        stopCamera()
        onResult(code.data)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        rafRef.current = requestAnimationFrame(tick)
      })
      .catch(() => setCameraError(true))

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [onResult, stopCamera])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-[var(--ink)]">{t('scanTitle')}</p>
        <button type="button" onClick={onCancel} aria-label={t('close')} className="rounded-lg bg-gray-100 p-2 text-gray-700 hover:bg-gray-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      {cameraError ? (
        <p className="rounded-lg bg-[var(--background)] p-4 text-sm text-[var(--muted)]">{t('cameraError')}</p>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-4 border-[var(--gold-bright)]/80" />
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (manualCode.trim().length === 6) onResult(manualCode.trim())
        }}
        className="flex gap-2"
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          maxLength={6}
          placeholder={t('manualCodePlaceholder')}
          className="min-w-0 flex-1 rounded-lg border border-[var(--gold)]/30 p-2.5 font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
        />
        <button type="submit" disabled={manualCode.trim().length !== 6} className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50">
          {t('manualCodeSubmit')}
        </button>
      </form>
    </div>
  )
}

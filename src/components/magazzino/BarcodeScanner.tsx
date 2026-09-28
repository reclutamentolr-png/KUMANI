'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ScanBarcode } from 'lucide-react'

// Lettore di codici a barre con il rilevatore integrato nel browser
// (BarcodeDetector: Chrome/Edge/Android). Dove non c'è, si scrive il codice.
type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (options: { formats: string[] }) => Detector

export default function BarcodeScanner({ onResult }: { onResult: (code: string) => void }) {
  const t = useTranslations('magazzino')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [supported] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window)
  // Senza fotocamera accessibile (pagina non https, browser vecchio) si mostra l'avviso
  const [cameraError, setCameraError] = useState<boolean>(() => typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia)
  const [manual, setManual] = useState('')

  useEffect(() => {
    if (!supported || cameraError) return
    let stream: MediaStream | null = null
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector
    const detector = new Ctor({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'] })

    const scan = async () => {
      if (stopped || !videoRef.current) return
      try {
        const codes = await detector.detect(videoRef.current)
        if (codes[0]?.rawValue) {
          stopped = true
          onResult(codes[0].rawValue.trim())
          return
        }
      } catch {
        // fotogramma non pronto: si riprova
      }
      timer = setTimeout(scan, 250)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((media) => {
        if (stopped) {
          media.getTracks().forEach((track) => track.stop())
          return
        }
        stream = media
        if (videoRef.current) {
          videoRef.current.srcObject = media
          videoRef.current.play().catch(() => {})
        }
        scan()
      })
      .catch(() => setCameraError(true))

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [supported, cameraError, onResult])

  return (
    <div className="space-y-3">
      {supported && !cameraError ? (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--gold-bright)]/80" />
        </div>
      ) : (
        <p className="rounded-lg bg-[var(--background)] p-3 text-sm text-[var(--muted)]">{cameraError ? t('cameraError') : t('scannerUnsupported')}</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) onResult(manual.trim())
        }}
        className="flex gap-2"
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          maxLength={64}
          placeholder={t('manualBarcode')}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
        />
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 text-sm font-semibold text-white">
          <ScanBarcode className="h-4 w-4" /> {t('find')}
        </button>
      </form>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

type Props = {
  url: string
  fileName: string
  fgColor?: string
  bgColor?: string
  generatingLabel: string
  downloadLabel: string
  accentClassName?: string
}

export default function OfferMakerQR({
  url,
  fileName,
  fgColor = '#171717',
  bgColor = '#ffffff',
  generatingLabel,
  downloadLabel,
  accentClassName = 'bg-[var(--ink)] hover:bg-[var(--ink-soft)]',
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    // qrcode caricato solo quando serve, fuori dal bundle iniziale
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(url, {
          width: 320,
          margin: 2,
          color: { dark: fgColor, light: bgColor },
          errorCorrectionLevel: 'H',
        })
      )
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl)
          setLoading(false)
        }
      })
      .catch((err) => console.error(err))
    return () => {
      cancelled = true
    }
  }, [url, fgColor, bgColor])

  const handleDownload = () => {
    const link = document.createElement('a')
    link.download = `${fileName}.png`
    link.href = qrDataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {loading ? (
        <div className="w-40 h-40 bg-gray-100 rounded-xl flex items-center justify-center animate-pulse">
          <span className="text-xs text-gray-400">{generatingLabel}</span>
        </div>
      ) : (
        <div className="p-3 bg-white rounded-xl border border-[var(--gold)]/25 shadow-sm">
          {/* QR generato al momento (data URL): <img> semplice */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR Code" className="w-40 h-40" />
        </div>
      )}
      <button
        onClick={handleDownload}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 ${accentClassName}`}
      >
        <Download className="w-4 h-4" />
        {downloadLabel}
      </button>
    </div>
  )
}

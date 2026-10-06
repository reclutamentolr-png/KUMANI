'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, LoaderCircle } from 'lucide-react'
import type { CvForPdf } from '@/lib/cvPdf'
import { loadImageAsDataUrl, loadInterFontBase64 } from '@/lib/pdfHelpers'

type Props = {
  cv: CvForPdf
  photoUrl: string | null
  publicUrl: string
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function CvPdfButton({ cv, photoUrl, publicUrl }: Props) {
  const t = useTranslations('kumaniCv')
  const [generating, setGenerating] = useState(false)

  const handleDownload = async () => {
    setGenerating(true)
    try {
      // jsPDF e qrcode solo al clic, fuori dal bundle iniziale
      const [{ generateCvPdfBlob }, QRCode] = await Promise.all([
        import('@/lib/cvPdf'),
        import('qrcode').then((m) => m.default),
      ])
      const [fontBase64, photoDataUrl, qrDataUrl] = await Promise.all([
        loadInterFontBase64(),
        photoUrl ? loadImageAsDataUrl(photoUrl) : Promise.resolve(null),
        QRCode.toDataURL(publicUrl, { width: 240, margin: 1, errorCorrectionLevel: 'H' }),
      ])
      const blob = generateCvPdfBlob({ cv, photoDataUrl, fontBase64, publicUrl, qrDataUrl })
      downloadBlob(blob, `cv-${cv.code}.pdf`)
    } catch (err) {
      console.error(err)
      alert(t('pdfError'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={generating}
      className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
    >
      {generating ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {generating ? t('generatingPdf') : t('downloadPdf')}
    </button>
  )
}

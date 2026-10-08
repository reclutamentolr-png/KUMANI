'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Share2, MessageCircle, Mail, Printer, LoaderCircle } from 'lucide-react'
import type { CvForPdf } from '@/lib/cvPdf'
import { loadImageAsDataUrl, loadInterFontBase64 } from '@/lib/pdfHelpers'

type Props = {
  cv: CvForPdf
  photoUrl: string | null
  publicUrl: string
}

export default function CvShareButtons({ cv, photoUrl, publicUrl }: Props) {
  const t = useTranslations('kumaniCv')
  const [busy, setBusy] = useState<'share' | 'print' | null>(null)

  const buildBlob = async (): Promise<Blob> => {
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
    return generateCvPdfBlob({ cv, photoDataUrl, fontBase64, publicUrl, qrDataUrl })
  }

  const summaryText = t('shareSummaryText', { name: cv.full_name, url: publicUrl })

  const canNativeShareFiles = (file: File) =>
    typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] })

  const handleNativeShare = async () => {
    setBusy('share')
    try {
      const blob = await buildBlob()
      const file = new File([blob], `cv-${cv.code}.pdf`, { type: 'application/pdf' })
      if (canNativeShareFiles(file)) {
        await navigator.share({ files: [file], title: cv.full_name, text: summaryText, url: publicUrl })
      }
    } catch (err) {
      if (!(err instanceof Error) || err.name !== 'AbortError') console.error(err)
    } finally {
      setBusy(null)
    }
  }

  const handlePrint = async () => {
    setBusy('print')
    try {
      const blob = await buildBlob()
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (err) {
      console.error(err)
      alert(t('pdfError'))
    } finally {
      setBusy(null)
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(summaryText)}`
  const mailHref = `mailto:?subject=${encodeURIComponent(cv.full_name)}&body=${encodeURIComponent(summaryText)}`

  // Starts false to match the server-rendered fallback markup exactly, then
  // upgrades after mount — avoids a hydration mismatch (see QuoteShareButtons).
  const [nativeSupported, setNativeSupported] = useState(false)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.canShare) return
    try {
      const probe = new File([''], 'probe.pdf', { type: 'application/pdf' })
      const supported = navigator.canShare({ files: [probe] })
      queueMicrotask(() => setNativeSupported(supported))
    } catch {
      // Unsupported — keep the text-link fallback
    }
  }, [])

  return (
    <div data-guest-hide className="flex flex-wrap items-center gap-3">
      {nativeSupported ? (
        <button
          onClick={handleNativeShare}
          disabled={busy === 'share'}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-all disabled:opacity-50"
        >
          {busy === 'share' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          {t('shareAction')}
        </button>
      ) : (
        <>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm bg-green-50 text-green-700 hover:bg-green-100 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            {t('shareWhatsapp')}
          </a>
          <a
            href={mailHref}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-all"
          >
            <Mail className="w-4 h-4" />
            {t('shareEmail')}
          </a>
        </>
      )}

      <button
        onClick={handlePrint}
        disabled={busy === 'print'}
        className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all disabled:opacity-50"
      >
        {busy === 'print' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
        {t('printAction')}
      </button>

      {!nativeSupported && <p className="w-full text-xs text-[var(--muted)]">{t('shareManualAttachHint')}</p>}
    </div>
  )
}

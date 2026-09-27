'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Share2, MessageCircle, Mail, Printer, LoaderCircle } from 'lucide-react'
import {
  generateQuotePdfBlob,
  loadImageAsDataUrl,
  buildQuotePdfLabels,
  type QuoteForPdf,
  type IssuerForPdf,
} from '@/lib/quotePdf'

type Props = {
  quote: QuoteForPdf
  issuer: IssuerForPdf
  logoUrl: string | null
}

export default function QuoteShareButtons({ quote, issuer, logoUrl }: Props) {
  const t = useTranslations('preventivi')
  const locale = useLocale()
  const [busy, setBusy] = useState<'share' | 'print' | null>(null)

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale)
  const formatCurrency = (n: number) => n.toLocaleString(locale, { style: 'currency', currency: 'EUR' })

  const buildBlob = async (): Promise<Blob> => {
    const logoDataUrl = logoUrl ? await loadImageAsDataUrl(logoUrl) : null
    return generateQuotePdfBlob({
      quote,
      issuer,
      logoDataUrl,
      formatDate,
      formatCurrency,
      labels: buildQuotePdfLabels(t),
    })
  }

  const summaryText = t('shareSummaryText', {
    number: quote.quote_number,
    client: quote.client_name,
    total: formatCurrency(quote.total),
  })

  const canNativeShareFiles = (file: File) =>
    typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] })

  const handleNativeShare = async () => {
    setBusy('share')
    try {
      const blob = await buildBlob()
      const file = new File([blob], `preventivo-${quote.quote_number}.pdf`, { type: 'application/pdf' })
      if (canNativeShareFiles(file)) {
        await navigator.share({ files: [file], title: t('pdfDocumentTitle', { number: quote.quote_number }), text: summaryText })
      }
    } catch (err) {
      // AbortError when the user cancels the native share sheet — not an error
      if (!(err instanceof Error) || err.name !== 'AbortError') console.error(err)
    } finally {
      setBusy(null)
    }
  }

  const handlePrint = async () => {
    setBusy('print')
    try {
      const blob = await buildBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      console.error(err)
      alert(t('pdfError'))
    } finally {
      setBusy(null)
    }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(summaryText)}`
  const mailHref = `mailto:${quote.client_email || ''}?subject=${encodeURIComponent(
    t('pdfDocumentTitle', { number: quote.quote_number })
  )}&body=${encodeURIComponent(summaryText)}`

  // Starts false to match the server-rendered fallback markup exactly, then
  // upgrades after mount — avoids a hydration mismatch, since canShare()
  // only exists client-side and needs a real File instance to probe.
  const [nativeSupported, setNativeSupported] = useState(false)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.canShare) return
    try {
      const probe = new File([''], 'probe.pdf', { type: 'application/pdf' })
      const supported = navigator.canShare({ files: [probe] })
      // One-off client-only capability probe (empty deps, runs once on
      // mount) — deferred a tick so this isn't a *synchronous* setState
      // inside the effect body, which the exhaustive-deps rule flags even
      // though it can't cascade here.
      queueMicrotask(() => setNativeSupported(supported))
    } catch {
      // Unsupported — keep the text-link fallback
    }
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-3">
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

      {!nativeSupported && <p className="w-full text-xs text-gray-400">{t('shareManualAttachHint')}</p>}
    </div>
  )
}

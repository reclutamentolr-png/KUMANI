'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Download, LoaderCircle } from 'lucide-react'
import { generateQuotePdfBlob, loadImageAsDataUrl, buildQuotePdfLabels, type QuoteForPdf, type IssuerForPdf } from '@/lib/quotePdf'

type Props = {
  quote: QuoteForPdf
  issuer: IssuerForPdf
  logoUrl: string | null
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

export default function QuotePdfButton({ quote, issuer, logoUrl }: Props) {
  const t = useTranslations('preventivi')
  const locale = useLocale()
  const [generating, setGenerating] = useState(false)

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale)
  const formatCurrency = (n: number) => n.toLocaleString(locale, { style: 'currency', currency: 'EUR' })

  const handleDownload = async () => {
    setGenerating(true)
    try {
      const logoDataUrl = logoUrl ? await loadImageAsDataUrl(logoUrl) : null
      const blob = generateQuotePdfBlob({
        quote,
        issuer,
        logoDataUrl,
        formatDate,
        formatCurrency,
        labels: buildQuotePdfLabels(t),
      })
      downloadBlob(blob, `preventivo-${quote.quote_number}.pdf`)
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

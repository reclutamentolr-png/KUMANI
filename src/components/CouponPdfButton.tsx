'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Download, LoaderCircle } from 'lucide-react'

type Coupon = {
  code: string
  title: string
  description: string | null
  created_at: string
}

// Gold/ink "gift card" style PDF for a wallet coupon — distinct from
// DigitalReceiptPdfButton's plain document layout, since this is meant to
// be handed over/used somewhere else (e.g. redeemed as an Amazon gift
// code), not filed as a record.
export default function CouponPdfButton({ coupon }: { coupon: Coupon }) {
  const t = useTranslations('wallet')
  const locale = useLocale()
  const [generating, setGenerating] = useState(false)

  const handleDownload = async () => {
    setGenerating(true)
    try {
      // jsPDF solo al clic, fuori dal bundle iniziale
      const { jsPDF } = await import('jspdf')
      const width = 600
      const height = 300
      const margin = 40
      const doc = new jsPDF({ unit: 'pt', format: [width, height], orientation: 'landscape' })

      // Outer gold border
      doc.setDrawColor(231, 197, 106)
      doc.setLineWidth(2)
      doc.rect(6, 6, width - 12, height - 12)

      // Header band
      doc.setFillColor(23, 23, 23)
      doc.rect(6, 6, width - 12, 60, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(231, 197, 106)
      doc.text('KUMANI', margin, 44)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(255, 255, 255)
      doc.text(t('couponPdfBadge'), width - margin, 44, { align: 'right' })

      // Title + description
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(23, 23, 23)
      doc.text(coupon.title, margin, 100)

      if (coupon.description) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(90, 90, 90)
        const lines = doc.splitTextToSize(coupon.description, width - margin * 2)
        doc.text(lines, margin, 122)
      }

      // Dashed divider (ticket tear line)
      doc.setDrawColor(231, 197, 106)
      doc.setLineWidth(1)
      doc.setLineDashPattern([4, 3], 0)
      doc.line(margin, 160, width - margin, 160)
      doc.setLineDashPattern([], 0)

      // Code box
      doc.setDrawColor(231, 197, 106)
      doc.setLineWidth(1.5)
      doc.roundedRect(margin, 180, width - margin * 2, 60, 8, 8)
      doc.setFont('courier', 'bold')
      doc.setFontSize(26)
      doc.setTextColor(23, 23, 23)
      doc.text(coupon.code, width / 2, 218, { align: 'center' })

      // Footer
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(140, 140, 140)
      doc.text(t('couponPdfFooter'), margin, height - 20)
      doc.text(
        new Date(coupon.created_at).toLocaleDateString(locale),
        width - margin,
        height - 20,
        { align: 'right' }
      )

      doc.save(`kumani-coupon-${coupon.code}.pdf`)
    } catch (err) {
      console.error(err)
      alert(t('couponPdfError'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={generating}
      className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--ink-soft)] disabled:opacity-50"
    >
      {generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {generating ? t('couponPdfGenerating') : t('couponDownloadPdf')}
    </button>
  )
}

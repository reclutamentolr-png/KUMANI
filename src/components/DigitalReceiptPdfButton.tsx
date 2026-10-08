'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Download, LoaderCircle } from 'lucide-react'
import { formatReceiptValue, type ReceiptTemplate } from '@/lib/digitalReceipt'

type ReceiptData = {
  code: string
  template: ReceiptTemplate
  object_name: string
  serial_number: string | null
  recipient_name: string
  delivery_date: string
  reason: string | null
  notes: string | null
  quantity: number | null
  declared_value: number | null
  vat_mode?: string | null
  show_issuer?: boolean | null
  expected_return_date: string | null
  confirmed_at: string | null
  returned_at: string | null
  created_at: string
}

type Props = {
  receipt: ReceiptData
  receiptUrl: string
  photoUrl: string | null
  issuedByName: string
  // Scheda attività di chi emette la ricevuta (intestazione con logo)
  issuer?: { company_name: string | null; vat_number: string | null; address: string | null; city: string | null; postal_code: string | null; province: string | null; phone: string | null; email: string | null } | null
  issuerLogoUrl?: string | null
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export default function DigitalReceiptPdfButton({ receipt, receiptUrl, photoUrl, issuedByName, issuer, issuerLogoUrl }: Props) {
  const t = useTranslations('digitalReceipt')
  const locale = useLocale()
  const [generating, setGenerating] = useState(false)

  const statusLabel = receipt.returned_at
    ? t('statusReturned')
    : receipt.confirmed_at
      ? t('statusConfirmed')
      : t('statusPending')

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(locale)

  const handleDownload = async () => {
    setGenerating(true)
    try {
      // jsPDF e qrcode solo al clic, fuori dal bundle iniziale
      const [{ jsPDF }, QRCode] = await Promise.all([import('jspdf'), import('qrcode').then((m) => m.default)])
      const showIssuer = receipt.show_issuer !== false && !!(issuer?.company_name || issuerLogoUrl)
      const [qrDataUrl, photoDataUrl, logoDataUrl] = await Promise.all([
        QRCode.toDataURL(receiptUrl, { width: 240, margin: 1, errorCorrectionLevel: 'H' }),
        photoUrl ? loadImageAsDataUrl(photoUrl) : Promise.resolve(null),
        showIssuer && issuerLogoUrl ? loadImageAsDataUrl(issuerLogoUrl) : Promise.resolve(null),
      ])

      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 48
      let y = 56

      // Intestazione: logo e dati della Scheda attività di chi emette la ricevuta
      if (showIssuer) {
        let textX = margin
        let logoBottom = y - 14
        if (logoDataUrl) {
          try {
            const props = doc.getImageProperties(logoDataUrl)
            let w = 80
            let h = (props.height / props.width) * w
            if (h > 56) {
              h = 56
              w = (props.width / props.height) * h
            }
            doc.addImage(logoDataUrl, margin, y - 14, w, h)
            textX = margin + w + 16
            logoBottom = y - 14 + h
          } catch {
            // logo non leggibile: solo i dati
          }
        }
        const address = [issuer?.address, [issuer?.postal_code, issuer?.city].filter(Boolean).join(' '), issuer?.province ? `(${issuer.province})` : '']
          .filter(Boolean)
          .join(', ')
        const lines = [issuer?.company_name, address, issuer?.vat_number, [issuer?.phone, issuer?.email].filter(Boolean).join(' · ')].filter(Boolean) as string[]
        let ty = y
        lines.forEach((line, i) => {
          doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
          doc.setFontSize(i === 0 ? 12 : 9)
          doc.setTextColor(...((i === 0 ? [23, 23, 23] : [110, 110, 110]) as [number, number, number]))
          doc.text(line, textX, ty)
          ty += i === 0 ? 14 : 11.5
        })
        y = Math.max(ty, logoBottom) + 16
        doc.setDrawColor(210, 210, 210)
        doc.line(margin, y - 8, pageWidth - margin, y - 8)
        y += 22
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(23, 23, 23) // --ink
      doc.text(t('pdfDocumentTitle'), margin, y)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(90, 90, 90)
      y += 20
      doc.text(`${t('templateLabel')}: ${t(`template_${receipt.template}`)}`, margin, y)
      y += 16
      doc.text(`${t('pdfCodeLabel')}: ${receipt.code}`, margin, y)
      y += 16
      if (!showIssuer && issuedByName) {
        doc.text(`${t('pdfIssuedByLabel')}: ${issuedByName}`, margin, y)
        y += 16
      }
      doc.text(`${t('pdfIssuedOnLabel')}: ${formatDate(receipt.created_at)}`, margin, y)

      doc.setDrawColor(210, 210, 210)
      y += 14
      doc.line(margin, y, pageWidth - margin, y)
      y += 26

      const field = (label: string, value: string | null) => {
        if (!value) return
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        doc.text(label, margin, y)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(20, 20, 20)
        const lines = doc.splitTextToSize(value, pageWidth - margin * 2 - 160)
        doc.text(lines, margin + 160, y)
        y += Math.max(16, lines.length * 14)
      }

      field(t('objectField'), receipt.object_name)
      field(t('serialField'), receipt.serial_number)
      field(t.has(`recipientField_${receipt.template}`) ? t(`recipientField_${receipt.template}`) : t('recipientField'), receipt.recipient_name)
      field(t('dateField'), formatDate(receipt.delivery_date))
      field(t('reasonField'), receipt.reason)
      field(t('quantityField'), receipt.quantity != null ? String(receipt.quantity) : null)
      field(
        t.has(`valueField_${receipt.template}`) ? t(`valueField_${receipt.template}`) : t('valueField'),
        receipt.declared_value != null ? formatReceiptValue(receipt.declared_value, receipt.vat_mode, locale, { plus: t('vatPlus'), included: t('vatIncluded') }) : null
      )
      if (receipt.template === 'loan') {
        field(t('expectedReturnField'), receipt.expected_return_date ? formatDate(receipt.expected_return_date) : null)
      }
      field(t('notesField'), receipt.notes)

      y += 6
      field(t('pdfStatusLabel'), statusLabel)

      if (receipt.confirmed_at) {
        doc.text(t('confirmedOn', { date: formatDate(receipt.confirmed_at) }), margin, y)
        y += 16
      }
      if (receipt.returned_at) {
        doc.text(t('returnedOn', { date: formatDate(receipt.returned_at) }), margin, y)
        y += 16
      }

      y += 10
      if (photoDataUrl) {
        try {
          const imgProps = doc.getImageProperties(photoDataUrl)
          const maxW = 220
          const w = maxW
          const h = (imgProps.height / imgProps.width) * w
          doc.addImage(photoDataUrl, margin, y, w, h)
          y += h + 20
        } catch {
          // Skip embedding if the format isn't supported by jsPDF
        }
      }

      const qrSize = 110
      const qrX = pageWidth - margin - qrSize
      const qrY = doc.internal.pageSize.getHeight() - 190
      doc.addImage(qrDataUrl, qrX, qrY, qrSize, qrSize)
      doc.setFontSize(8)
      doc.setTextColor(90, 90, 90)
      doc.text(t('pdfVerifyLabel'), qrX, qrY + qrSize + 14, { maxWidth: qrSize })
      doc.setFontSize(7)
      doc.text(receiptUrl, margin, doc.internal.pageSize.getHeight() - 60, { maxWidth: pageWidth - margin * 2 - qrSize - 20 })

      doc.setFontSize(7)
      doc.setTextColor(140, 140, 140)
      const disclaimerLines = doc.splitTextToSize(t('disclaimer'), pageWidth - margin * 2 - qrSize - 20)
      doc.text(disclaimerLines, margin, doc.internal.pageSize.getHeight() - 40)

      doc.save(`receipt-${receipt.code}.pdf`)
    } catch (err) {
      console.error(err)
      alert(t('pdfError'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <button data-guest-hide
      onClick={handleDownload}
      disabled={generating}
      className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
    >
      {generating ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {generating ? t('generatingPdf') : t('downloadPdf')}
    </button>
  )
}

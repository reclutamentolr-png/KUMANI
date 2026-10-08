import { jsPDF } from 'jspdf'
import { sectionLines, type QuoteSection } from '@/lib/quotes'
import type { QuotePdfLabels } from '@/lib/pdfHelpers'
import { INK, MUTED, accentRgb, drawLogo, formatClientAddressLine, formatIssuerAddressLine, type IssuerForPdf, type QuoteForPdf } from '@/lib/quotePdfShared'

// PDF del preventivo descrittivo (lettera a sezioni), sul modello dei
// preventivi scritti in Word: logo in ogni pagina nella posizione scelta,
// destinatario, luogo e data, oggetto, lettera, sezioni con testo o elenco e
// importo, totale, chiusura e dati dell'azienda; in fondo all'ultima pagina,
// sempre allo stesso posto, modalità di pagamento, note e «Per accettazione».

export function generateDescriptiveQuotePdfBlob(params: {
  quote: QuoteForPdf
  issuer: IssuerForPdf
  logoDataUrl: string | null
  labels: QuotePdfLabels
  formatDate: (iso: string) => string
  formatCurrency: (n: number) => string
}): Blob {
  const { quote, issuer, logoDataUrl, labels, formatDate, formatCurrency } = params
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 50
  const width = pageWidth - margin * 2
  const accent = accentRgb(issuer)
  const position = quote.logo_position ?? 'center'
  const vat = quote.vat_mode === 'plus' ? ` ${labels.vatPlus}` : quote.vat_mode === 'included' ? ` ${labels.vatIncluded}` : ''

  // ── Fondo fisso dell'ultima pagina: pagamento, note, firma ──
  const footerBlocks = [
    quote.payment_info ? { label: labels.paymentInfoLabel, lines: doc.splitTextToSize(quote.payment_info, width * 0.62) as string[] } : null,
    quote.notes ? { label: labels.notesLabel, lines: doc.splitTextToSize(quote.notes, width * 0.62) as string[] } : null,
  ].filter(Boolean) as { label: string; lines: string[] }[]
  const blocksHeight = footerBlocks.reduce((h, b) => h + 14 + b.lines.length * 12.5 + 12, 0)
  const signatureHeight = quote.signature !== false ? 70 : 0
  const footerHeight = Math.max(blocksHeight, signatureHeight)
  const pageNumberSpace = 22
  const rowsBottom = pageHeight - margin - pageNumberSpace
  const footerTop = rowsBottom - footerHeight

  let y = 0
  const newPage = (first = false) => {
    if (!first) doc.addPage()
    y = drawLogo(doc, logoDataUrl, position, accent, margin)
  }
  const ensure = (h: number) => {
    if (y + h > rowsBottom) newPage()
  }
  const paragraph = (text: string, size: number, color: [number, number, number], style: 'normal' | 'bold' | 'italic' = 'normal', indent = 0, lineGap = 1.35) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, width - indent) as string[]
    for (const line of lines) {
      ensure(size * lineGap)
      doc.text(line, margin + indent, y)
      y += size * lineGap
    }
  }

  newPage(true)

  // ── Destinatario ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(labels.dearLabel, margin, y)
  y += 14
  paragraph(quote.client_name, 12, INK, 'bold')
  const clientLines = [
    formatClientAddressLine(quote),
    quote.client_vat ? `${labels.vatLabel}: ${quote.client_vat}` : null,
    quote.client_pec ? `${labels.pecLabel}: ${quote.client_pec}` : null,
    quote.client_email,
  ].filter(Boolean) as string[]
  for (const line of clientLines) paragraph(line, 9.5, INK)
  y += 12

  // ── Luogo e data, numero ──
  const place = issuer?.city ? `${issuer.city}, ` : ''
  paragraph(`${place}${formatDate(quote.issue_date)}`, 9.5, INK, 'bold')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...accent)
  ensure(14)
  doc.text(labels.documentTitle(quote.quote_number), margin, y)
  y += 13
  if (quote.valid_until) paragraph(`${labels.validUntilLabel}: ${formatDate(quote.valid_until)}`, 9, MUTED)
  y += 14

  // ── Oggetto e lettera ──
  if (quote.subject?.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...INK)
    const label = `${labels.subjectLabel}: `
    const labelW = doc.getTextWidth(label)
    const lines = doc.splitTextToSize(quote.subject.trim(), width - labelW) as string[]
    ensure(14)
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'normal')
    lines.forEach((line, i) => {
      if (i > 0) ensure(14)
      doc.text(line, margin + labelW, y)
      y += 14
    })
    y += 8
  }
  if (quote.intro?.trim()) {
    paragraph(quote.intro.trim(), 10.5, INK)
    y += 12
  }

  // ── Sezioni ──
  const sections = (quote.sections ?? []) as QuoteSection[]
  for (const s of sections) {
    const title = s.title?.trim()
    if (title) {
      ensure(40)
      y += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12.5)
      doc.setTextColor(...INK)
      for (const line of doc.splitTextToSize(title, width) as string[]) {
        ensure(16)
        doc.text(line, margin, y)
        y += 16
      }
      doc.setDrawColor(...accent)
      doc.setLineWidth(1.2)
      doc.line(margin, y - 10, margin + 34, y - 10)
      y += 4
    }
    if (s.kind === 'text') {
      if (s.body.trim()) {
        for (const para of s.body.trim().split(/\n{2,}/)) {
          paragraph(para.replace(/\n/g, ' '), 10, INK)
          y += 4
        }
      }
    } else {
      sectionLines(s.body).forEach((line, i) => {
        const marker = s.kind === 'numbered' ? `${i + 1}.` : '•'
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(...INK)
        const lines = doc.splitTextToSize(line, width - 22) as string[]
        lines.forEach((l, j) => {
          ensure(13.5)
          if (j === 0) doc.text(marker, margin + 4, y)
          doc.text(l, margin + 22, y)
          y += 13.5
        })
      })
    }
    if (typeof s.amount === 'number') {
      ensure(22)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...accent)
      doc.text(`${formatCurrency(s.amount)}${vat}`, pageWidth - margin, y, { align: 'right' })
      y += 8
    }
    y += 12
  }

  // ── Totale ──
  if (quote.show_total !== false && sections.some((s) => typeof s.amount === 'number')) {
    ensure(34)
    doc.setFillColor(240, 240, 238)
    doc.rect(margin, y - 4, width, 28, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.setTextColor(...INK)
    doc.text(labels.totalLabel, margin + 10, y + 14)
    doc.text(`${formatCurrency(quote.total)}${vat}`, pageWidth - margin - 10, y + 14, { align: 'right' })
    y += 44
  }

  // ── Chiusura e dati dell'azienda ──
  if (quote.closing?.trim()) {
    paragraph(quote.closing.trim(), 10.5, INK)
    y += 10
  }
  const issuerLines = [
    issuer?.company_name,
    formatIssuerAddressLine(issuer),
    issuer?.vat_number,
    [issuer?.phone, issuer?.email].filter(Boolean).join(' · ') || null,
    issuer?.pec ? `${labels.pecLabel}: ${issuer.pec}` : null,
  ].filter(Boolean) as string[]
  issuerLines.forEach((line, i) => paragraph(line, i === 0 ? 10.5 : 9.5, i === 0 ? INK : MUTED, i === 0 ? 'bold' : 'normal'))

  // ── Fondo fisso: se non c'è posto sotto il testo, pagina nuova ──
  if (footerHeight > 0) {
    if (y + 10 > footerTop) newPage()
    let fy = footerTop
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.5)
    doc.line(margin, fy - 10, pageWidth - margin, fy - 10)
    fy += 6
    for (const block of footerBlocks) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      doc.text(block.label.toUpperCase(), margin, fy)
      fy += 14
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.text(block.lines, margin, fy)
      fy += block.lines.length * 12.5 + 12
    }
    if (quote.signature !== false) {
      const sx = pageWidth - margin - 170
      const sy = footerTop + 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...INK)
      doc.text(labels.signatureLabel, sx + 85, sy, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTED)
      doc.text(labels.signatureHint, sx + 85, sy + 13, { align: 'center' })
      doc.setDrawColor(...INK)
      doc.setLineWidth(0.7)
      doc.line(sx, sy + 52, sx + 170, sy + 52)
    }
  }

  // Numero di pagina
  const pages = doc.getNumberOfPages()
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(labels.pageOf(p, pages), pageWidth / 2, pageHeight - margin + 8, { align: 'center' })
    }
  }
  return doc.output('blob')
}

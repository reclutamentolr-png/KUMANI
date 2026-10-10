import { jsPDF } from 'jspdf'
import { generateDescriptiveQuotePdfBlob } from '@/lib/quotePdfDescriptive'
import { INK, GOLD, MUTED, accentRgb, drawLogo, formatClientAddressLine, formatIssuerAddressLine, type IssuerForPdf, type QuoteForPdf } from '@/lib/quotePdfShared'
import type { QuotePdfLabels } from '@/lib/pdfHelpers'
import { quoteVatBreakdown } from '@/lib/quotes'

// Helper senza jsPDF ri-esportati per chi li importava da qui
export { buildQuotePdfLabels, loadImageAsDataUrl } from '@/lib/pdfHelpers'

export type { QuoteForPdf, IssuerForPdf } from '@/lib/quotePdfShared'

type PdfLabels = QuotePdfLabels

/**
 * Hard character-count wrap (default 65/line) instead of jsPDF's
 * width-based splitTextToSize — a long unbroken token (a code, a URL) can't
 * be split on whitespace and was overflowing into the Quantity column, so
 * every line is now force-capped at maxChars regardless of font metrics.
 */
function wrapTextByChars(text: string, maxChars = 65): string[] {
  if (!text) return []
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    let remaining = word
    while (remaining.length > maxChars) {
      if (current) {
        lines.push(current)
        current = ''
      }
      lines.push(remaining.slice(0, maxChars))
      remaining = remaining.slice(maxChars)
    }
    const candidate = current ? `${current} ${remaining}` : remaining
    if (candidate.length > maxChars) {
      lines.push(current)
      current = remaining
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Shared jsPDF layout used by both the download button and the
 * share/print flow, so the two never drift apart. Returns the Blob
 * (`doc.output('blob')`) — the caller decides whether to save it, wrap it
 * in a File for navigator.share, or open it in a new tab.
 *
 * Two-column header (issuer left / doc number+date+client right), modeled
 * after a real invoicing PDF the client shared as a reference, plus a
 * footer band for payment details + notes.
 */
export function generateQuotePdfBlob(params: {
  quote: QuoteForPdf
  issuer: IssuerForPdf
  logoDataUrl: string | null
  labels: PdfLabels
  formatDate: (iso: string) => string
  formatCurrency: (n: number) => string
  // Immagini delle sezioni del preventivo descrittivo (percorso → data URL)
  sectionImages?: Record<string, string>
}): Blob {
  const { quote, issuer, logoDataUrl, labels, formatDate, formatCurrency } = params
  // Preventivo descrittivo: impaginazione a sezioni
  if (quote.layout === 'descriptive') return generateDescriptiveQuotePdfBlob(params)
  const position = quote.logo_position ?? 'left'

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 44
  const rightEdge = pageWidth - margin
  const colGap = 20
  const leftW = (pageWidth - margin * 2 - colGap) * 0.48
  const rightW = pageWidth - margin * 2 - colGap - leftW

  // ── Header, left column: logo + issuer ──
  // Logo al centro, a destra o sulla fascia: sopra, a tutta larghezza; le
  // due colonne (azienda e cliente) partono sotto
  // (+16: i testi si scrivono sulla riga di base, il titolo grande sale di circa 16 pt)
  const headerTop = position === 'left' ? margin + 6 : drawLogo(doc, logoDataUrl, position, accentRgb(issuer), margin, quote.band_style) + 16
  let leftY = headerTop
  if (logoDataUrl && position === 'left') {
    try {
      const imgProps = doc.getImageProperties(logoDataUrl)
      const w = 64
      const h = (imgProps.height / imgProps.width) * w
      doc.addImage(logoDataUrl, margin, leftY, w, h)
      leftY += h + 10
    } catch {
      // Skip embedding if the format isn't supported by jsPDF
    }
  }

  const issuerLines = [
    issuer?.company_name,
    formatIssuerAddressLine(issuer),
    issuer?.vat_number,
    issuer?.email,
    issuer?.pec ? `${labels.pecLabel}: ${issuer.pec}` : null,
    issuer?.phone,
  ].filter(Boolean) as string[]
  issuerLines.forEach((line, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
    doc.setFontSize(i === 0 ? 13 : 9)
    doc.setTextColor(...(i === 0 ? INK : MUTED))
    const wrapped = doc.splitTextToSize(line, leftW)
    doc.text(wrapped, margin, leftY)
    leftY += wrapped.length * (i === 0 ? 15 : 12) + (i === 0 ? 4 : 0)
  })

  // ── Header, right column: big title + number/date + client ("attn:") ──
  let rightY = headerTop
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...INK)
  doc.text(labels.bigTitle, rightEdge, rightY, { align: 'right' })
  rightY += 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...GOLD)
  doc.text(labels.documentTitle(quote.quote_number), rightEdge, rightY, { align: 'right' })
  rightY += 13

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(`${labels.issueDateLabel}: ${formatDate(quote.issue_date)}`, rightEdge, rightY, { align: 'right' })
  rightY += 12
  if (quote.valid_until) {
    doc.text(`${labels.validUntilLabel}: ${formatDate(quote.valid_until)}`, rightEdge, rightY, { align: 'right' })
    rightY += 12
  }

  rightY += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(labels.attentionLabel, rightEdge, rightY, { align: 'right' })
  rightY += 13

  const clientLines = [
    quote.client_name,
    formatClientAddressLine(quote),
    quote.client_vat ? `${labels.vatLabel}: ${quote.client_vat}` : null,
    quote.client_email,
    quote.client_pec ? `${labels.pecLabel}: ${quote.client_pec}` : null,
    quote.client_phone,
  ].filter(Boolean) as string[]
  clientLines.forEach((line, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
    doc.setFontSize(i === 0 ? 12 : 9.5)
    doc.setTextColor(...INK)
    const wrapped = doc.splitTextToSize(line, rightW)
    doc.text(wrapped, rightEdge, rightY, { align: 'right' })
    rightY += wrapped.length * (i === 0 ? 14 : 12)
  })

  let y = Math.max(leftY, rightY) + 20
  doc.setDrawColor(210, 210, 210)
  doc.line(margin, y, pageWidth - margin, y)
  y += 26

  // ── Items table ──
  // Colonne: i numeri allineati a destra, ognuno nel suo spazio
  const col = {
    desc: margin,
    qty: pageWidth - margin - 170,
    price: pageWidth - margin - 85,
    total: pageWidth - margin - 6,
  }

  // ── Fondo dell'ultima pagina: modalità di pagamento e note sempre allo
  // stesso posto, qualunque sia il numero di righe ──
  // «Per accettazione (Timbro e Firma)» a destra: pagamento e note più stretti
  const signature = quote.signature !== false
  const textWidth = (pageWidth - margin * 2) * (signature ? 0.62 : 1)
  const footerBlocks = [
    quote.payment_info ? { label: labels.paymentInfoLabel, lines: doc.splitTextToSize(quote.payment_info, textWidth) as string[] } : null,
    quote.notes ? { label: labels.notesLabel, lines: doc.splitTextToSize(quote.notes, textWidth) as string[] } : null,
  ].filter(Boolean) as { label: string; lines: string[] }[]
  const footerHeight = Math.max(footerBlocks.reduce((h, b) => h + 14 + b.lines.length * 13 + 14, 0), signature ? 70 : 0)
  const pageNumberSpace = 22
  // Note molto lunghe: il fondo prende al massimo metà pagina, poi va su una pagina sua
  const footerOwnPage = footerHeight > (pageHeight - margin * 2) * 0.5
  const footerTop = footerOwnPage ? margin + 18 : pageHeight - margin - pageNumberSpace - footerHeight
  const rowsBottom = pageHeight - margin - pageNumberSpace

  const tableHeader = () => {
    doc.setFillColor(...INK)
    doc.rect(margin, y - 12, pageWidth - margin * 2, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(labels.descriptionHeader, col.desc + 6, y + 2)
    doc.text(labels.quantityHeader, col.qty, y + 2, { align: 'right' })
    doc.text(labels.unitPriceHeader, col.price, y + 2, { align: 'right' })
    doc.text(labels.totalHeader, col.total, y + 2, { align: 'right' })
    y += 22
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
  }
  tableHeader()

  quote.items.forEach((item, i) => {
    const descLines = wrapTextByChars(item.description || '', 50)
    const rowHeight = Math.max(18, descLines.length * 12 + 6)
    // Riga che non ci sta: si continua nella pagina successiva, con i titoli delle colonne
    if (y + rowHeight > rowsBottom) {
      doc.addPage()
      y = margin + 18
      tableHeader()
    }

    if (i % 2 === 1) {
      doc.setFillColor(247, 247, 245)
      doc.rect(margin, y - 12, pageWidth - margin * 2, rowHeight, 'F')
    }

    doc.setFontSize(9.5)
    doc.text(descLines, col.desc + 6, y)
    doc.text(String(item.quantity), col.qty, y, { align: 'right' })
    doc.text(formatCurrency(item.unitPrice), col.price, y, { align: 'right' })
    doc.text(formatCurrency(item.quantity * item.unitPrice), col.total, y, { align: 'right' })
    y += rowHeight
  })

  // Il totale deve stare sopra al fondo fisso: se non c'è posto, pagina nuova
  const breakdown = quoteVatBreakdown(quote.total, quote.vat_mode, quote.vat_rate)
  if (y + (breakdown ? 64 : 30) > (footerOwnPage ? rowsBottom : footerTop)) {
    doc.addPage()
    y = margin + 18
  }

  // ── Imponibile e IVA sopra al totale, quando c'è l'aliquota ──
  if (breakdown) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...MUTED)
    for (const [label, value] of [[labels.netLabel, breakdown.net], [labels.vatRateLabel(breakdown.rate), breakdown.vat]] as const) {
      doc.text(label, margin + 10, y)
      doc.text(formatCurrency(value), pageWidth - margin - 10, y, { align: 'right' })
      y += 16
    }
    y += 6
  }

  // ── Total — a shaded band closing the table, like the reference's "Totale dovuto" row ──
  doc.setFillColor(240, 240, 238)
  doc.rect(margin, y - 12, pageWidth - margin * 2, 26, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(labels.totalLabel, margin + 10, y + 4)
  const vatSuffix = breakdown ? '' : quote.vat_mode === 'plus' ? ` ${labels.vatPlus}` : quote.vat_mode === 'included' ? ` ${labels.vatIncluded}` : ''
  const totalValue = `${formatCurrency(breakdown ? breakdown.gross : quote.total)}${vatSuffix}`
  doc.text(totalValue, pageWidth - margin - 10 - doc.getTextWidth(totalValue), y + 4)

  // ── Fondo fisso: modalità di pagamento + note, firma per accettazione ──
  if (footerBlocks.length || signature) {
    if (footerOwnPage) doc.addPage()
    let fy = footerTop
    doc.setDrawColor(210, 210, 210)
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
      fy += block.lines.length * 13 + 14
    }
    if (signature) {
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

  // Numero di pagina (solo se le pagine sono più di una)
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

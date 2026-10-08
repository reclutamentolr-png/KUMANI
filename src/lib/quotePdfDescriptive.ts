import { jsPDF } from 'jspdf'
import { sectionLines, type QuoteLayer, type QuoteSection } from '@/lib/quotes'
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
  // Immagini delle sezioni già caricate (percorso → data URL)
  sectionImages?: Record<string, string>
}): Blob {
  const { quote, issuer, logoDataUrl, labels, formatDate, formatCurrency } = params
  const sectionImages = params.sectionImages ?? {}
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
    // Disegno o immagine: il titolo va nella stessa pagina (mai da solo in fondo)
    let block = 0
    if (s.kind === 'layers' && (s.layers ?? []).some((l) => l.label.trim())) {
      block = drawLayers(doc, (s.layers ?? []).filter((l) => l.label.trim()), margin, 0, width, true) + 6
    } else if (s.kind === 'image' && s.image && sectionImages[s.image]) {
      try {
        const props = doc.getImageProperties(sectionImages[s.image])
        block = Math.min((props.height / props.width) * width, 330) + 8
      } catch {
        block = 0
      }
    }
    if (title) {
      ensure(40 + block)
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
    if (s.kind === 'image') {
      const data = s.image ? sectionImages[s.image] : undefined
      if (data) {
        try {
          const props = doc.getImageProperties(data)
          let w = width
          let h = (props.height / props.width) * w
          const maxH = 330
          if (h > maxH) {
            h = maxH
            w = (props.width / props.height) * h
          }
          ensure(h + 8)
          doc.addImage(data, margin + (width - w) / 2, y, w, h)
          y += h + 10
        } catch {
          // immagine non leggibile: si salta
        }
      }
      if (s.body.trim()) paragraph(s.body.trim(), 9, MUTED, 'italic')
    } else if (s.kind === 'layers') {
      const layers = (s.layers ?? []).filter((l) => l.label.trim())
      if (layers.length) {
        const h = drawLayers(doc, layers, margin, 0, width, true)
        ensure(h + 6)
        drawLayers(doc, layers, margin, y, width, false)
        y += h + 8
      }
      if (s.body.trim()) paragraph(s.body.trim(), 9, MUTED, 'italic')
    } else if (s.kind === 'text') {
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

const hexRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16)
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [207, 207, 207]
}
const darker = ([r, g, b]: [number, number, number]): [number, number, number] => [Math.round(r * 0.72), Math.round(g * 0.72), Math.round(b * 0.72)]

/**
 * Stratigrafia: il primo strato è il supporto (blocco in basso a tutta
 * larghezza, con il nome dentro); gli altri sono fasce sottili sovrapposte a
 * scaletta, ognuna indicata da un riquadro con il suo nome e una freccia.
 * Con `measure` calcola solo l'altezza, senza disegnare.
 */
function drawLayers(doc: jsPDF, layers: QuoteLayer[], x: number, y: number, width: number, measure: boolean): number {
  const [base, ...upper] = layers
  const m = upper.length
  const boxW = Math.min(215, width * 0.44)
  const stepX = m > 1 ? Math.max(20, Math.min(62, (width - boxW - 60) / (m - 1))) : 0
  const layerStep = m > 0 ? Math.min(42, (width * 0.55) / m) : 0
  const thick = 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)

  // Riquadri delle etichette, a scaletta verso il basso a destra
  let cursor = y
  const boxes = upper.map((layer, i) => {
    const lines = doc.splitTextToSize(layer.label, boxW - 14) as string[]
    const h = lines.length * 10.5 + 9
    const bx = Math.min(x + 46 + i * stepX, x + width - boxW)
    const box = { x: bx, y: cursor, h, lines }
    cursor += h + 7
    return box
  })
  const stackTop = (m > 0 ? cursor : y) + 18
  const baseY = stackTop + m * thick
  const baseH = 40
  const total = baseY + baseH - y + 4
  if (measure) return total

  // Strati sopra il supporto (dal più alto, disegnati dopo così restano sopra)
  upper.forEach((layer, i) => {
    const j = i + 1
    const ly = baseY - j * thick
    const lx = x + 26 + i * layerStep
    const color = hexRgb(layer.color)
    doc.setFillColor(...color)
    doc.setDrawColor(...darker(color))
    doc.setLineWidth(0.6)
    doc.rect(lx, ly, x + width - lx, thick, 'FD')
  })
  // Supporto
  const baseColor = hexRgb(base.color)
  doc.setFillColor(...baseColor)
  doc.setDrawColor(...darker(baseColor))
  doc.setLineWidth(0.8)
  doc.rect(x, baseY, width, baseH, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const lum = baseColor[0] * 0.3 + baseColor[1] * 0.59 + baseColor[2] * 0.11
  doc.setTextColor(...((lum < 120 ? [255, 255, 255] : [30, 30, 30]) as [number, number, number]))
  doc.text(doc.splitTextToSize(base.label, width - 20) as string[], x + 10, baseY + 16)

  // Riquadri e frecce verso l'inizio di ogni strato
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  boxes.forEach((box, i) => {
    const j = i + 1
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(0.6)
    doc.setFillColor(255, 255, 255)
    doc.rect(box.x, box.y, boxW, box.h, 'FD')
    doc.setTextColor(30, 30, 30)
    doc.text(box.lines, box.x + 7, box.y + 12)
    const fromX = box.x + 14
    const fromY = box.y + box.h
    const toX = x + 26 + i * layerStep + 10
    const toY = baseY - j * thick
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(0.7)
    doc.line(fromX, fromY, toX, toY)
    // Punta della freccia sullo strato
    const ang = Math.atan2(toY - fromY, toX - fromX)
    const a1 = ang + Math.PI - 0.35
    const a2 = ang + Math.PI + 0.35
    doc.setFillColor(40, 40, 40)
    doc.triangle(toX, toY, toX + 6 * Math.cos(a1), toY + 6 * Math.sin(a1), toX + 6 * Math.cos(a2), toY + 6 * Math.sin(a2), 'F')
  })
  return total
}

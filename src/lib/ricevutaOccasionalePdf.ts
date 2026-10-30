import { jsPDF } from 'jspdf'
import { RO_WITHHOLDING_PERCENT, centsIt, dateIt, type OccasionalReceipt } from '@/lib/ricevutaOccasionale'

// PDF A4 della ricevuta per prestazione occasionale, sempre in italiano
// (documento fiscale italiano). Si carica con import() solo al clic.
// Coordinate dall'alto; il testo lungo va a pagina nuova da solo.

type RGB = [number, number, number]
const INK: RGB = [23, 23, 23]
const TEXT: RGB = [55, 55, 55]
const MUTED: RGB = [115, 115, 115]
const RULE: RGB = [205, 205, 205]
const GOLD: RGB = [199, 161, 90]
const PALE: RGB = [250, 246, 236]
const RED: RGB = [185, 28, 28]

const A4_W = 595.28
const A4_H = 841.89
const M = 50
const W = A4_W - M * 2
const BOTTOM = A4_H - 60

async function fontBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`font ${url}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

const euro = (cents: number) => `€ ${centsIt(cents)}`

class Page {
  y = M
  constructor(
    public doc: jsPDF,
    private onNewPage: () => void,
  ) {}

  font(bold: boolean, size: number, color: RGB = TEXT) {
    this.doc.setFont('Inter', bold ? 'bold' : 'normal')
    this.doc.setFontSize(size)
    this.doc.setTextColor(...color)
  }

  /** Spazio per h punti, altrimenti pagina nuova */
  need(h: number) {
    if (this.y + h > BOTTOM) {
      this.doc.addPage()
      this.y = M
      this.onNewPage()
    }
  }

  lines(text: string, width: number, bold: boolean, size: number): string[] {
    this.font(bold, size)
    return this.doc.splitTextToSize(text, width) as string[]
  }

  /** Paragrafo a capo da solo, anche su più pagine */
  para(text: string, o: { size?: number; bold?: boolean; color?: RGB; x?: number; width?: number; lh?: number; keep?: boolean } = {}) {
    const size = o.size ?? 10
    const lh = o.lh ?? size * 1.45
    const x = o.x ?? M
    const lines = this.lines(text, o.width ?? W, !!o.bold, size)
    if (o.keep) this.need(lines.length * lh)
    for (const line of lines) {
      this.need(lh)
      this.font(!!o.bold, size, o.color ?? TEXT)
      this.doc.text(line, x, this.y + size * 0.8)
      this.y += lh
    }
  }

  rule(color: RGB = RULE, width = 0.6) {
    this.doc.setDrawColor(...color)
    this.doc.setLineWidth(width)
    this.doc.line(M, this.y, M + W, this.y)
  }
}

export async function buildReceiptPdfBlob(r: OccasionalReceipt): Promise<Blob> {
  const [regular, bold] = await Promise.all([fontBase64('/fonts/inter/Inter-Regular.ttf'), fontBase64('/fonts/inter/Inter-Bold.ttf')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.addFileToVFS('Inter-Regular.ttf', regular)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.addFileToVFS('Inter-Bold.ttf', bold)
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold')
  doc.setProperties({ title: `Ricevuta n. ${r.number}/${r.year}`, author: r.issuer_name, subject: 'Ricevuta per prestazione occasionale' })

  const docNumber = `${r.number}/${r.year}`
  const p = new Page(doc, () => {
    // Pagine dopo la prima: richiamo del numero in alto
    p.font(true, 9, MUTED)
    doc.text(`Ricevuta n. ${docNumber} (segue)`, M, p.y + 8)
    p.y += 24
  })

  // ─── Intestazione ───
  p.font(true, 16, INK)
  doc.text('RICEVUTA PER PRESTAZIONE', M, p.y + 13)
  doc.text('OCCASIONALE', M, p.y + 33)
  p.font(true, 14, INK)
  doc.text(`N. ${docNumber}`, M + W, p.y + 13, { align: 'right' })
  p.font(false, 10, TEXT)
  doc.text(`Data: ${dateIt(r.issue_date)}`, M + W, p.y + 31, { align: 'right' })
  p.y += 46
  p.rule(GOLD, 1.5)
  p.y += 14

  if (r.cancelled_at) {
    p.font(true, 12, RED)
    doc.text('RICEVUTA ANNULLATA', M, p.y + 10)
    p.y += 22
  }

  // ─── Prestatore e committente ───
  const colW = (W - 16) / 2
  const block = (title: string, rows: { text: string; bold?: boolean }[]) => {
    const out: { text: string; bold: boolean; size: number }[] = [{ text: title, bold: true, size: 8 }]
    for (const row of rows) for (const l of p.lines(row.text, colW - 20, !!row.bold, 10)) out.push({ text: l, bold: !!row.bold, size: 10 })
    return out
  }
  const issuer = block('PRESTATORE (chi rilascia la ricevuta)', [
    { text: r.issuer_name, bold: true },
    { text: `Codice fiscale: ${r.issuer_tax_code}` },
    ...(r.issuer_address ? [{ text: r.issuer_address }] : []),
    ...(r.issuer_city ? [{ text: r.issuer_city }] : []),
  ])
  const clientTaxLabel = r.client_tax_id && /^\d{11}$/.test(r.client_tax_id) ? 'C.F./Partita IVA' : 'Codice fiscale'
  const client = block('COMMITTENTE (chi paga)', [
    { text: r.client_name, bold: true },
    ...(r.client_tax_id ? [{ text: `${clientTaxLabel}: ${r.client_tax_id}` }] : []),
    ...(r.client_address ? [{ text: r.client_address }] : []),
    ...(r.client_city ? [{ text: r.client_city }] : []),
  ])
  const boxH = Math.max(issuer.length, client.length) * 14 + 20
  p.need(boxH)
  const drawBox = (x: number, rows: typeof issuer) => {
    doc.setFillColor(...PALE)
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.6)
    doc.roundedRect(x, p.y, colW, boxH, 6, 6, 'FD')
    let yy = p.y + 12
    for (const row of rows) {
      p.font(row.bold, row.size, row.size === 8 ? MUTED : row.bold ? INK : TEXT)
      doc.text(row.text, x + 10, yy + row.size * 0.8)
      yy += 14
    }
  }
  drawBox(M, issuer)
  drawBox(M + colW + 16, client)
  p.y += boxH + 20

  // ─── Prestazione ───
  p.need(40)
  p.font(true, 8, MUTED)
  doc.text('DESCRIZIONE DELLA PRESTAZIONE', M, p.y + 7)
  p.y += 16
  p.para(r.description, { size: 10.5, color: INK })
  if (r.period_from || r.period_to) {
    const period =
      r.period_from && r.period_to
        ? r.period_from === r.period_to
          ? `il ${dateIt(r.period_from)}`
          : `dal ${dateIt(r.period_from)} al ${dateIt(r.period_to)}`
        : r.period_from
          ? `dal ${dateIt(r.period_from)}`
          : `fino al ${dateIt(r.period_to)}`
    p.y += 4
    p.para(`Periodo della prestazione: ${period}`, { size: 10 })
  }
  p.y += 14

  // ─── Importi ───
  type Row = { label: string; value: string; bold?: boolean; note?: string }
  const rows: Row[] = [{ label: 'Compenso lordo', value: euro(r.gross_cents) }]
  if (r.expenses_cents > 0)
    rows.push({
      label: 'Rimborso spese',
      value: euro(r.expenses_cents),
      note: r.expenses_on_behalf ? 'Spese anticipate in nome e per conto del committente, documentate: escluse dalla ritenuta' : undefined,
    })
  if (r.stamp_cents > 0) rows.push({ label: 'Rimborso marca da bollo', value: euro(r.stamp_cents) })
  rows.push({ label: 'Totale ricevuta', value: euro(r.total_cents), bold: true })
  if (r.withholding) {
    const base = r.gross_cents + (r.expenses_on_behalf ? 0 : r.expenses_cents)
    rows.push({ label: `Ritenuta d'acconto ${RO_WITHHOLDING_PERCENT}% su ${euro(base)}`, value: `− ${euro(r.withholding_cents)}` })
  }
  const noteLines = (row: Row) => (row.note ? p.lines(row.note, W - 150, false, 8).length : 0)
  const tableH = rows.reduce((h, row) => h + 22 + noteLines(row) * 11, 0) + 44
  p.need(tableH)
  p.rule()
  for (const row of rows) {
    p.font(!!row.bold, 10.5, row.bold ? INK : TEXT)
    doc.text(row.label, M, p.y + 15)
    doc.text(row.value, M + W, p.y + 15, { align: 'right' })
    // Nota sotto la voce (es. spese escluse dalla ritenuta)
    const notes = row.note ? p.lines(row.note, W - 150, false, 8) : []
    notes.forEach((l, i) => {
      p.font(false, 8, MUTED)
      doc.text(l, M, p.y + 28 + i * 11)
    })
    p.y += 22 + notes.length * 11
    p.rule()
  }
  // Netto in evidenza
  doc.setFillColor(...INK)
  doc.roundedRect(M, p.y + 6, W, 34, 6, 6, 'F')
  p.font(true, 12, [255, 255, 255])
  doc.text('NETTO DA PAGARE', M + 12, p.y + 28)
  p.font(true, 14, GOLD)
  doc.text(euro(r.net_cents), M + W - 12, p.y + 28, { align: 'right' })
  p.y += 56

  // ─── Diciture ───
  const notes: string[] = [
    "Prestazione occasionale ai sensi dell'art. 2222 del Codice Civile, esclusa dal campo di applicazione IVA ai sensi dell'art. 5 del D.P.R. 633/1972 per mancanza del requisito dell'abitualità.",
    r.withholding
      ? "Il committente, in qualità di sostituto d'imposta, versa la ritenuta d'acconto del 20% ai sensi dell'art. 25 del D.P.R. 600/1973."
      : "Compenso non soggetto a ritenuta d'acconto: il committente non è sostituto d'imposta.",
  ]
  if (r.stamp_required)
    notes.push(
      r.stamp_id
        ? `Imposta di bollo di € 2,00 assolta sull'originale (marca n. ${r.stamp_id})${r.stamp_charge === 'client' ? ', addebitata al committente' : ''}.`
        : `Imposta di bollo di € 2,00 da applicare sull'originale${r.stamp_charge === 'client' ? ', addebitata al committente' : ''}.`,
    )
  if (r.paid_on) notes.push(`Il sottoscritto dichiara di aver ricevuto la somma netta di ${euro(r.net_cents)} in data ${dateIt(r.paid_on)}.`)
  else if (r.issuer_iban) notes.push(`Pagamento con bonifico sull'IBAN ${r.issuer_iban.replace(/(.{4})/g, '$1 ').trim()} intestato a ${r.issuer_name}.`)
  if (r.note) notes.push(r.note)
  for (const n of notes) {
    p.para(n, { size: 9, lh: 13 })
    p.y += 5
  }
  p.y += 12

  // ─── Luogo, data, firma e marca da bollo (sempre insieme) ───
  const stampW = 78
  const stampH = 92
  p.need(Math.max(stampH, 80) + 10)
  const top = p.y
  const place = r.place ? `${r.place}, ${dateIt(r.issue_date)}` : dateIt(r.issue_date)
  p.font(false, 9, MUTED)
  doc.text('Luogo e data', M, top + 8)
  p.font(false, 10.5, INK)
  doc.text(place, M, top + 24)
  const signX = r.stamp_required ? M + W - stampW - 200 : M + W - 200
  p.font(false, 9, MUTED)
  doc.text('Firma del prestatore', signX, top + 8)
  doc.setDrawColor(...TEXT)
  doc.setLineWidth(0.6)
  doc.line(signX, top + 62, signX + 180, top + 62)
  p.font(false, 8, MUTED)
  doc.text(r.issuer_name, signX, top + 74)
  if (r.stamp_required) {
    const sx = M + W - stampW
    doc.setDrawColor(...MUTED)
    doc.setLineDashPattern([3, 3], 0)
    doc.rect(sx, top, stampW, stampH)
    doc.setLineDashPattern([], 0)
    p.font(false, 8, MUTED)
    const label = doc.splitTextToSize('Spazio per la marca da bollo da € 2,00', stampW - 12) as string[]
    label.forEach((l, i) => doc.text(l, sx + stampW / 2, top + stampH / 2 - 8 + i * 10, { align: 'center' }))
  }
  p.y = top + Math.max(stampH, 80)

  // ─── Piè di pagina su tutte le pagine ───
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.5)
    doc.line(M, A4_H - 40, M + W, A4_H - 40)
    p.font(false, 8, MUTED)
    doc.text(`Ricevuta n. ${docNumber} – ${r.issuer_name}`, M, A4_H - 27)
    doc.text(`Pagina ${i} di ${pages}`, M + W, A4_H - 27, { align: 'right' })
  }

  return doc.output('blob')
}

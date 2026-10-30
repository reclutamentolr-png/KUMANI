import { jsPDF } from 'jspdf'
import {
  computeTotals,
  formatCents,
  formatDay,
  formatKm,
  formatRate,
  itemKm,
  routeText,
  sortItems,
  type ExpenseCategory,
  type ExpenseItem,
  type ExpenseReport,
} from '@/lib/noteSpese'

// PDF A4 della nota spese, creato nel browser (questo file si carica con
// import() solo al clic): intestazione, tabella delle voci, totali, spazio
// per le firme e in fondo le foto degli scontrini come allegati.
// Caratteri Inter (anche per il russo), numero di pagina su ogni pagina.

export type ExpensePdfLabels = {
  docTitle: string
  employee: string
  recipient: string
  period: string
  status: string
  statusText: string
  colNumber: string
  colDate: string
  colCategory: string
  colDescription: string
  colAttachment: string
  colAmount: string
  category: (c: ExpenseCategory) => string
  roundTrip: string
  perKm: string
  totalsTitle: string
  totalKm: string
  totalExpenses: string
  advance: string
  due: string
  dueBack: string
  notes: string
  signEmployee: string
  signManager: string
  signDate: string
  attachmentsTitle: string
  attachment: (n: number) => string
  noItems: string
  pageOf: (page: number, pages: number) => string
}

type RGB = [number, number, number]
const INK: RGB = [23, 23, 23]
const MUTED: RGB = [110, 110, 110]
const GOLD: RGB = [176, 141, 60]
const LINE: RGB = [220, 214, 200]
const SHADE: RGB = [249, 246, 238]

const A4_W = 595.28
const A4_H = 841.89
const M = 40
const W = A4_W - M * 2
const BOTTOM = A4_H - 50

type Photo = { dataUrl: string; w: number; h: number }

async function fontBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`font ${url}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

// Foto dello scontrino → JPEG (jsPDF non legge il WebP), lato lungo al massimo 1600 px
async function loadPhoto(url: string): Promise<Photo | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bitmap = await createImageBitmap(await res.blob())
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.8), w: canvas.width, h: canvas.height }
  } catch {
    return null
  }
}

export async function generateExpensePdf({
  report,
  items: rawItems,
  labels,
  locale,
}: {
  report: ExpenseReport
  items: ExpenseItem[]
  labels: ExpensePdfLabels
  locale: string
}): Promise<{ blob: Blob; missingPhotos: number }> {
  const items = sortItems(rawItems)
  const withReceipt = items.filter((i) => i.receipt_url)
  const [regular, bold, ...photoList] = await Promise.all([
    fontBase64('/fonts/inter/Inter-Regular.ttf'),
    fontBase64('/fonts/inter/Inter-Bold.ttf'),
    ...withReceipt.map((i) => loadPhoto(i.receipt_url!)),
  ])
  const photos = new Map<string, Photo>()
  withReceipt.forEach((it, idx) => {
    const p = photoList[idx] as Photo | null
    if (p) photos.set(it.id, p)
  })
  // Numero di allegato per ogni voce con la foto
  const attachNo = new Map<string, number>()
  items.forEach((it) => {
    if (photos.has(it.id)) attachNo.set(it.id, attachNo.size + 1)
  })

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.addFileToVFS('Inter-Regular.ttf', regular as string)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.addFileToVFS('Inter-Bold.ttf', bold as string)
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold')

  const money = (cents: number) => formatCents(cents, locale)
  const font = (style: 'normal' | 'bold', size: number, color: RGB = INK) => {
    doc.setFont('Inter', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }
  const lines = (text: string, width: number): string[] => doc.splitTextToSize(text, width) as string[]

  let y = M
  const newPage = () => {
    doc.addPage()
    y = M
  }
  const need = (h: number) => {
    if (y + h > BOTTOM) {
      newPage()
      return true
    }
    return false
  }

  // ——— Intestazione ———
  doc.setFillColor(...GOLD)
  doc.rect(M, y, 46, 3, 'F')
  y += 14
  font('bold', 10, GOLD)
  doc.text(labels.docTitle.toUpperCase(), M, y + 8, { charSpace: 1.2 })
  y += 18
  font('bold', 20)
  for (const line of lines(report.title, W)) {
    doc.text(line, M, y + 16)
    y += 24
  }
  y += 6

  const period = [formatDay(report.period_from, locale), formatDay(report.period_to, locale)].filter(Boolean)
  const info: [string, string][] = [
    [labels.employee, report.employee_name ?? ''],
    [labels.recipient, report.recipient ?? ''],
    [labels.period, period.length === 2 && period[0] !== period[1] ? `${period[0]} – ${period[1]}` : (period[0] ?? '')],
    [labels.status, labels.statusText],
  ].filter(([, v]) => v) as [string, string][]
  const colW = W / 2
  for (let i = 0; i < info.length; i += 2) {
    const pair = info.slice(i, i + 2)
    let rowH = 0
    pair.forEach(([label, value], j) => {
      const x = M + j * colW
      font('normal', 7.5, MUTED)
      doc.text(label.toUpperCase(), x, y + 7, { charSpace: 0.6 })
      font('bold', 10.5)
      const vl = lines(value, colW - 12).slice(0, 3)
      vl.forEach((l, k) => doc.text(l, x, y + 22 + k * 13))
      rowH = Math.max(rowH, 18 + vl.length * 13)
    })
    y += rowH + 8
  }
  y += 6

  // ——— Tabella delle voci ———
  const cols = [
    { key: 'n', w: 24, align: 'left' as const, label: labels.colNumber },
    { key: 'date', w: 60, align: 'left' as const, label: labels.colDate },
    { key: 'cat', w: 84, align: 'left' as const, label: labels.colCategory },
    { key: 'desc', w: W - 24 - 60 - 84 - 36 - 70, align: 'left' as const, label: labels.colDescription },
    { key: 'att', w: 36, align: 'center' as const, label: labels.colAttachment },
    { key: 'amt', w: 70, align: 'right' as const, label: labels.colAmount },
  ]
  const PAD = 5
  const tableHead = () => {
    doc.setFillColor(...INK)
    doc.rect(M, y, W, 20, 'F')
    font('bold', 7.5, [255, 255, 255])
    let x = M
    for (const c of cols) {
      const tx = c.align === 'right' ? x + c.w - PAD : c.align === 'center' ? x + c.w / 2 : x + PAD
      doc.text(c.label.toUpperCase(), tx, y + 13, { align: c.align })
      x += c.w
    }
    y += 20
  }

  need(60)
  tableHead()
  if (!items.length) {
    font('normal', 9, MUTED)
    doc.text(labels.noItems, M + PAD, y + 16)
    y += 26
  }
  items.forEach((it, idx) => {
    const descParts: string[] = []
    if (it.category === 'mileage') {
      const route = routeText(it)
      if (route) descParts.push(route)
      if (it.description) descParts.push(it.description)
      const kmLine = `${formatKm(it.km ?? 0, locale)} km${it.round_trip ? ` × 2 (${labels.roundTrip}) = ${formatKm(itemKm(it), locale)} km` : ''} · ${formatRate(it.km_rate ?? 0, locale)} ${labels.perKm}`
      descParts.push(kmLine)
    } else if (it.description) descParts.push(it.description)
    font('normal', 8.5)
    const descW = cols[3].w - PAD * 2
    const descLines = descParts.flatMap((p) => lines(p, descW))
    const catLines = lines(labels.category(it.category), cols[2].w - PAD * 2)
    const rowH = Math.max(descLines.length, catLines.length, 1) * 11 + 10
    if (need(rowH)) tableHead()
    if (idx % 2 === 1) {
      doc.setFillColor(...SHADE)
      doc.rect(M, y, W, rowH, 'F')
    }
    let x = M
    const base = y + 14
    font('normal', 8.5, MUTED)
    doc.text(String(idx + 1), x + PAD, base)
    x += cols[0].w
    font('normal', 8.5)
    doc.text(formatDay(it.spent_on, locale), x + PAD, base)
    x += cols[1].w
    catLines.forEach((l, k) => doc.text(l, x + PAD, base + k * 11))
    x += cols[2].w
    descLines.forEach((l, k) => {
      font('normal', 8.5, it.category === 'mileage' && k === descLines.length - 1 ? MUTED : INK)
      doc.text(l, x + PAD, base + k * 11)
    })
    x += cols[3].w
    const n = attachNo.get(it.id)
    if (n) {
      font('bold', 8.5, GOLD)
      doc.text(String(n), x + cols[4].w / 2, base, { align: 'center' })
    }
    x += cols[4].w
    font('bold', 9)
    doc.text(money(it.amount_cents), x + cols[5].w - PAD, base, { align: 'right' })
    y += rowH
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.5)
    doc.line(M, y, M + W, y)
  })
  y += 18

  // ——— Totali ———
  const totals = computeTotals(items, report.advance_cents)
  const totalRows: { label: string; value: string; strong?: boolean }[] = [
    ...totals.byCategory.map((c) => ({ label: `${labels.category(c.category)} (${c.count})`, value: money(c.cents) })),
  ]
  if (totals.totalKm > 0) totalRows.push({ label: labels.totalKm, value: `${formatKm(totals.totalKm, locale)} km` })
  totalRows.push({ label: labels.totalExpenses, value: money(totals.totalCents), strong: true })
  if (totals.advanceCents > 0) totalRows.push({ label: labels.advance, value: `− ${money(totals.advanceCents)}` })
  const boxW = 260
  const boxX = M + W - boxW
  const boxH = 30 + totalRows.length * 16 + 34
  need(boxH + 10)
  font('bold', 8, GOLD)
  doc.text(labels.totalsTitle.toUpperCase(), boxX, y + 8, { charSpace: 0.8 })
  y += 18
  for (const r of totalRows) {
    font(r.strong ? 'bold' : 'normal', r.strong ? 10 : 9, r.strong ? INK : [60, 60, 60])
    doc.text(lines(r.label, boxW - 100)[0], boxX, y + 10)
    doc.text(r.value, boxX + boxW, y + 10, { align: 'right' })
    y += 16
  }
  y += 4
  doc.setFillColor(...INK)
  doc.roundedRect(boxX - 8, y, boxW + 16, 28, 4, 4, 'F')
  font('bold', 10.5, [255, 255, 255])
  doc.text(totals.dueCents >= 0 ? labels.due : labels.dueBack, boxX, y + 18)
  font('bold', 12, [232, 200, 110])
  doc.text(money(Math.abs(totals.dueCents)), boxX + boxW, y + 18.5, { align: 'right' })
  y += 44

  // ——— Note ———
  if (report.notes) {
    font('normal', 9)
    const nl = lines(report.notes, W)
    need(20 + Math.min(nl.length, 6) * 12)
    font('bold', 8, MUTED)
    doc.text(labels.notes.toUpperCase(), M, y + 8, { charSpace: 0.6 })
    y += 16
    font('normal', 9)
    for (const l of nl) {
      need(12)
      doc.text(l, M, y + 9)
      y += 12
    }
    y += 12
  }

  // ——— Firme ———
  need(100)
  y += 10
  const signW = (W - 30) / 2
  ;[labels.signEmployee, labels.signManager].forEach((label, j) => {
    const x = M + j * (signW + 30)
    font('bold', 8, MUTED)
    doc.text(label.toUpperCase(), x, y + 8, { charSpace: 0.6 })
    doc.setDrawColor(...INK)
    doc.setLineWidth(0.6)
    doc.line(x, y + 54, x + signW, y + 54)
    font('normal', 8, MUTED)
    doc.text(`${labels.signDate}  ____ / ____ / ________`, x, y + 74)
  })
  y += 90

  // ——— Allegati: foto degli scontrini, due per pagina ———
  const attached = items.filter((i) => photos.has(i.id))
  if (attached.length) {
    const slotH = (BOTTOM - M - 30) / 2
    attached.forEach((it, idx) => {
      if (idx % 2 === 0) {
        newPage()
        font('bold', 10, GOLD)
        doc.text(labels.attachmentsTitle.toUpperCase(), M, y + 8, { charSpace: 1 })
        y += 26
      }
      const photo = photos.get(it.id)!
      const caption = [labels.attachment(attachNo.get(it.id)!), formatDay(it.spent_on, locale), labels.category(it.category), it.description, money(it.amount_cents)]
        .filter(Boolean)
        .join(' · ')
      font('bold', 9)
      const cap = lines(caption, W)[0]
      doc.text(cap, M, y + 9)
      const maxH = slotH - 26
      const scale = Math.min(W / photo.w, maxH / photo.h)
      const w = photo.w * scale
      const h = photo.h * scale
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.5)
      doc.addImage(photo.dataUrl, 'JPEG', M + (W - w) / 2, y + 16, w, h)
      doc.rect(M + (W - w) / 2, y + 16, w, h)
      y += slotH
    })
  }

  // ——— Piè di pagina su ogni pagina ———
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.5)
    doc.line(M, A4_H - 34, M + W, A4_H - 34)
    font('normal', 7.5, MUTED)
    doc.text(lines(`${labels.docTitle} – ${report.title}`, W - 120)[0], M, A4_H - 22)
    doc.text(labels.pageOf(p, pages), M + W, A4_H - 22, { align: 'right' })
  }

  return { blob: doc.output('blob'), missingPhotos: withReceipt.length - photos.size }
}

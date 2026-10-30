import { jsPDF } from 'jspdf'
import {
  addDays,
  endsNextDay,
  formatDay,
  formatDecimalHours,
  formatEuro,
  formatHM,
  holidayOf,
  monthBounds,
  romeTime,
  weekdayOf,
  workedMinutes,
  type HolidayKey,
  type MonthSummary,
  type WorkPlace,
} from '@/lib/registroOre'

// PDF del mese del Registro ore: A4, tabella giorno per giorno (tutti i giorni
// del mese), totali, settimane e spazio per le firme. Va a pagina nuova da
// solo e ripete l'intestazione della tabella; numero di pagina in fondo.
// Si carica con import() solo al clic (jsPDF è pesante).

export type RegistroPdfLabels = {
  title: string
  monthLabel: string
  personLabel: string
  placeLabel: string
  colDay: string
  colPlace: string
  colTime: string
  colBreak: string
  colHours: string
  colOvertime: string
  colNotes: string
  nextDay: string
  holidayMark: string
  nightMark: string
  holidayName: (key: HolidayKey) => string
  totalsTitle: string
  totalWorked: string
  ordinary: string
  overtime: string
  sundays: string
  holidays: string
  night: string
  shiftsCount: string
  grossEstimate: string
  grossNote: string
  grossPartial: string
  weeksTitle: string
  weekLine: (from: string, to: string, worked: string, threshold: string, place: string) => string
  weekOver: (over: string) => string
  weekCrossesMonth: string
  hoursUnit: string
  signatureWorker: string
  signatureEmployer: string
  footer: string
  pageOf: (page: number, pages: number) => string
}

type RGB = [number, number, number]
const INK: RGB = [23, 23, 23]
const MUTED: RGB = [110, 110, 110]
const GOLD: RGB = [176, 141, 38]
const LINE: RGB = [215, 215, 215]
const SOFT: RGB = [250, 245, 228]

const W = 595.28
const H = 841.89
const M = 40
const BOTTOM = H - 50

async function fontBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`font ${url}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export async function buildRegistroPdf(params: {
  year: number
  month: number
  locale: string
  personName: string
  places: WorkPlace[]
  /** posti che compaiono nel PDF (filtro attivo o tutti) */
  shownPlaces: WorkPlace[]
  summary: MonthSummary
  labels: RegistroPdfLabels
}): Promise<Blob> {
  const { year, month, locale, personName, places, shownPlaces, summary, labels: L } = params
  const [regular, bold] = await Promise.all([fontBase64('/fonts/inter/Inter-Regular.ttf'), fontBase64('/fonts/inter/Inter-Bold.ttf')])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.addFileToVFS('Inter-Regular.ttf', regular)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.addFileToVFS('Inter-Bold.ttf', bold)
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold')

  const font = (b: boolean, size: number, color: RGB = INK) => {
    doc.setFont('Inter', b ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }
  const placeById = new Map(places.map((p) => [p.id, p]))
  const multiPlace = shownPlaces.length > 1

  // ─── Intestazione ───
  let y = M
  font(true, 18)
  doc.text(L.title, M, y + 14)
  font(false, 11, GOLD)
  doc.text(L.monthLabel, W - M, y + 14, { align: 'right' })
  y += 30
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1.2)
  doc.line(M, y, W - M, y)
  y += 16
  const field = (label: string, value: string) => {
    font(true, 9, MUTED)
    doc.text(label, M, y + 8)
    font(false, 10)
    const lines = doc.splitTextToSize(value || '—', W - 2 * M - 110) as string[]
    doc.text(lines, M + 110, y + 8)
    y += Math.max(1, lines.length) * 13 + 3
  }
  field(L.personLabel, personName)
  field(L.placeLabel, shownPlaces.map((p) => p.name).join(', '))
  y += 8

  // ─── Tabella ───
  const cols = multiPlace
    ? [
        { key: 'day', w: 72 },
        { key: 'place', w: 78 },
        { key: 'time', w: 88 },
        { key: 'break', w: 42 },
        { key: 'hours', w: 44 },
        { key: 'over', w: 50 },
        { key: 'notes', w: 141 },
      ]
    : [
        { key: 'day', w: 82 },
        { key: 'time', w: 98 },
        { key: 'break', w: 48 },
        { key: 'hours', w: 50 },
        { key: 'over', w: 56 },
        { key: 'notes', w: 181 },
      ]
  const headerText: Record<string, string> = {
    day: L.colDay,
    place: L.colPlace,
    time: L.colTime,
    break: L.colBreak,
    hours: L.colHours,
    over: L.colOvertime,
    notes: L.colNotes,
  }
  const rightCols = new Set(['break', 'hours', 'over'])
  const colX: Record<string, number> = {}
  {
    let x = M
    for (const c of cols) {
      colX[c.key] = x
      x += c.w
    }
  }
  const colW = Object.fromEntries(cols.map((c) => [c.key, c.w])) as Record<string, number>

  const drawHeader = () => {
    doc.setFillColor(...INK)
    doc.rect(M, y, W - 2 * M, 18, 'F')
    font(true, 8, [255, 255, 255])
    for (const c of cols) {
      const text = headerText[c.key]
      if (rightCols.has(c.key)) doc.text(text, colX[c.key] + c.w - 4, y + 12, { align: 'right' })
      else doc.text(text, colX[c.key] + 4, y + 12)
    }
    y += 18
  }
  // Dentro la tabella la pagina nuova ripete l'intestazione delle colonne
  let inTable = true
  const newPage = () => {
    doc.addPage()
    y = M
    if (inTable) drawHeader()
  }
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage()
  }

  drawHeader()
  const { first, last } = monthBounds(year, month)
  const dayMap = new Map(summary.days.map((d) => [d.date, d]))
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const day = dayMap.get(date)
    const holiday = holidayOf(date)
    const special = !!holiday || weekdayOf(date) === 0
    const dayLabel = formatDay(date, locale, { weekday: 'short', day: '2-digit', month: '2-digit' })
    type Row = { cells: Record<string, string>; notes: string[] }
    const rows: Row[] = []
    if (!day || !day.shifts.length) {
      rows.push({ cells: { day: dayLabel }, notes: holiday ? [L.holidayName(holiday)] : [] })
    } else {
      day.shifts.forEach((s, index) => {
        const marks = [
          index === 0 && holiday ? L.holidayName(holiday) : '',
          s.is_holiday ? L.holidayMark : '',
          s.is_night ? L.nightMark : '',
          s.notes ?? '',
        ].filter(Boolean)
        const over = day.shiftOvertime[s.id] ?? 0
        rows.push({
          cells: {
            day: index === 0 ? dayLabel : '',
            place: placeById.get(s.place_id)?.name ?? '',
            time: `${romeTime(s.starts_at)}–${romeTime(s.ends_at!)}${endsNextDay(s) ? ` ${L.nextDay}` : ''}`,
            break: s.break_minutes ? String(s.break_minutes) : '',
            hours: formatHM(workedMinutes(s)),
            over: over ? formatHM(over) : '',
          },
          notes: [marks.join(' · ')],
        })
      })
    }
    for (const row of rows) {
      font(false, 8)
      const noteLines = row.notes.length && row.notes[0] ? (doc.splitTextToSize(row.notes[0], colW.notes - 8) as string[]) : []
      const placeLines = multiPlace && row.cells.place ? (doc.splitTextToSize(row.cells.place, colW.place - 8) as string[]) : []
      const h = Math.max(16, Math.max(noteLines.length, placeLines.length, 1) * 10 + 6)
      ensure(h)
      if (special) {
        doc.setFillColor(...SOFT)
        doc.rect(M, y, W - 2 * M, h, 'F')
      }
      for (const c of cols) {
        if (c.key === 'notes') {
          font(false, 8, MUTED)
          if (noteLines.length) doc.text(noteLines, colX.notes + 4, y + 11)
          continue
        }
        if (c.key === 'place') {
          font(false, 8)
          if (placeLines.length) doc.text(placeLines, colX.place + 4, y + 11)
          continue
        }
        const text = row.cells[c.key] ?? ''
        if (!text) continue
        font(c.key === 'hours' || c.key === 'day', 8.5, c.key === 'day' && !day ? MUTED : INK)
        if (rightCols.has(c.key)) doc.text(text, colX[c.key] + c.w - 4, y + 11, { align: 'right' })
        else doc.text(text, colX[c.key] + 4, y + 11)
      }
      y += h
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.4)
      doc.line(M, y, W - M, y)
    }
  }

  inTable = false

  // ─── Totali ───
  const t = summary.totals
  const hoursText = (min: number) => `${formatHM(min)} (${formatDecimalHours(min, locale)} ${L.hoursUnit})`
  const totalRows: [string, string, boolean][] = [
    [L.totalWorked, hoursText(t.worked), true],
    [L.ordinary, hoursText(t.ordinary), false],
    [L.overtime, hoursText(t.overtime), false],
    [L.sundays, hoursText(t.sunday), false],
    [L.holidays, hoursText(t.holiday), false],
  ]
  if (t.night) totalRows.push([L.night, hoursText(t.night), false])
  totalRows.push([L.shiftsCount, String(t.shifts), false])
  if (t.gross !== null) totalRows.push([L.grossEstimate, formatEuro(t.gross, locale), true])

  y += 18
  ensure(24 + totalRows.length * 15 + 30)
  font(true, 11)
  doc.text(L.totalsTitle, M, y + 10)
  y += 20
  for (const [label, value, strong] of totalRows) {
    font(strong, 9.5, strong ? INK : MUTED)
    doc.text(label, M, y + 10)
    font(strong, 9.5)
    doc.text(value, M + 260, y + 10, { align: 'right' })
    y += 15
  }
  if (t.gross !== null) {
    font(false, 7.5, MUTED)
    const note = doc.splitTextToSize(`${L.grossNote}${t.grossPartial ? ` ${L.grossPartial}` : ''}`, W - 2 * M) as string[]
    ensure(note.length * 10 + 4)
    doc.text(note, M, y + 8)
    y += note.length * 10 + 4
  }

  // ─── Settimane ───
  if (summary.weeks.length) {
    y += 12
    ensure(36)
    font(true, 11)
    doc.text(L.weeksTitle, M, y + 10)
    y += 20
    for (const w of summary.weeks) {
      ensure(14)
      font(false, 8.5, w.over ? INK : MUTED)
      const line =
        L.weekLine(
          formatDay(w.monday, locale, { day: '2-digit', month: '2-digit' }),
          formatDay(w.sunday, locale, { day: '2-digit', month: '2-digit' }) + (w.crossesMonth ? '*' : ''),
          formatHM(w.worked),
          formatHM(w.threshold),
          multiPlace ? placeById.get(w.placeId)?.name ?? '' : '',
        ) + (w.over ? ` · ${L.weekOver(formatHM(w.over))}` : '')
      const lines = doc.splitTextToSize(line, W - 2 * M) as string[]
      doc.text(lines, M, y + 9)
      y += lines.length * 11 + 2
    }
    if (summary.weeks.some((w) => w.crossesMonth)) {
      font(false, 7.5, MUTED)
      const note = doc.splitTextToSize(`* ${L.weekCrossesMonth}`, W - 2 * M) as string[]
      ensure(note.length * 10 + 4)
      doc.text(note, M, y + 8)
      y += note.length * 10 + 4
    }
  }

  // ─── Firme ───
  y += 24
  ensure(70)
  const boxW = (W - 2 * M - 30) / 2
  for (const [i, label] of [L.signatureWorker, L.signatureEmployer].entries()) {
    const x = M + i * (boxW + 30)
    font(false, 8.5, MUTED)
    doc.text(label, x, y + 10)
    doc.setDrawColor(...INK)
    doc.setLineWidth(0.6)
    doc.line(x, y + 52, x + boxW, y + 52)
  }

  // ─── Piè di pagina ───
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.4)
    doc.line(M, H - 34, W - M, H - 34)
    font(false, 7.5, MUTED)
    doc.text(`${L.footer} · ${L.monthLabel}`, M, H - 22)
    doc.text(L.pageOf(p, pages), W - M, H - 22, { align: 'right' })
  }
  return doc.output('blob')
}

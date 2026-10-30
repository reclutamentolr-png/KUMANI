import { jsPDF } from 'jspdf'
import { nameLines, type CvTemplate } from '@/lib/cv'
import { getCvLabels } from '@/lib/cvLabels'
import {
  A4_H,
  A4_W,
  ELEG_TEXT,
  EU_BLUE,
  FONT_FILES,
  Flow,
  GOLD,
  INK,
  LIGHT_RULE,
  MUTED,
  NAVY,
  PAPER,
  Pager,
  SKY,
  TEXT,
  WHITE,
  fontBase64,
  registerFonts,
  type CvFonts,
  type FontKey,
  type RGB,
} from '@/lib/cvPdf'
import { letterModel, type CoverLetterForm, type LetterModel } from '@/lib/letteraPresentazione'

// PDF A4 della Lettera di presentazione, con lo stesso aspetto del modello
// del CV scelto. Si cerca di farla stare in una pagina (testo un poco più
// piccolo se manca poco); se non basta, va a pagina nuova da sola.

const SERIF_TEMPLATES: CvTemplate[] = ['elegante', 'classic']

async function loadLetterFonts(template: CvTemplate): Promise<CvFonts> {
  const serif = SERIF_TEMPLATES.includes(template)
  const [regular, bold, serifRegular, serifBold] = await Promise.all([
    fontBase64(FONT_FILES.regular),
    fontBase64(FONT_FILES.bold),
    serif ? fontBase64(FONT_FILES.serif) : Promise.resolve(undefined),
    serif ? fontBase64(FONT_FILES.serifBold) : Promise.resolve(undefined),
  ])
  return { regular, bold, serif: serifRegular, serifBold }
}

type Style = {
  text: RGB // testo della lettera
  strong: RGB // oggetto, azienda, firma
  regular: FontKey
  bold: FontKey
}

type Area = { x: number; w: number; top: number; topNext: number }

// Corpo della lettera, uguale in tutti i modelli: destinatario, luogo e
// data, oggetto, saluto, paragrafi, chiusura, firma e allegato
function drawBody(pg: Pager, area: Area, model: LetterModel, s: Style, fs: number) {
  const { L } = model
  const lh = fs * 1.48
  const f = new Flow(pg, area.x, area.w, 1, area.top, area.topNext)

  if (model.recipient.length) {
    const rx = L.recipientRight ? area.x + area.w * 0.5 : area.x
    const rw = L.recipientRight ? area.w * 0.5 : area.w * 0.6
    const r = new Flow(pg, rx, rw, f.page, f.y, area.topNext)
    model.recipient.forEach((line) => r.text(line.text, { size: fs, font: line.bold ? s.bold : s.regular, color: line.bold ? s.strong : s.text, lh }))
    f.page = r.page
    f.y = r.y + fs * 2
  }
  if (model.placeDate) {
    f.text(model.placeDate, { size: fs, font: s.regular, color: s.text, lh, align: L.dateLeft ? 'left' : 'right' })
    f.gap(fs * 1.6)
  }
  if (model.subject) {
    f.text([L.subjectPrefix, model.subject].filter(Boolean).join(' '), { size: fs, font: s.bold, color: s.strong, lh })
    f.gap(fs * 1.5)
  }
  if (model.greeting) {
    f.text(model.greeting, { size: fs, font: s.regular, color: s.text, lh })
    f.gap(fs * 0.8)
  }
  model.paragraphs.forEach((p) => {
    f.text(p, { size: fs, font: s.regular, color: s.text, lh })
    f.gap(fs * 0.75)
  })
  // Chiusura e firma restano insieme sulla stessa pagina
  const closingLines = model.closing ? f.wrap(model.closing, f.w, { size: fs, font: s.regular }).length : 0
  f.gap(fs * 0.6)
  f.need(closingLines * lh + 40 + lh)
  if (model.closing) f.text(model.closing, { size: fs, font: s.regular, color: s.text, lh })
  // Spazio per la firma a mano
  f.gap(34)
  if (model.signature) f.text(model.signature, { size: fs, font: s.bold, color: s.strong, lh })
  if (model.enclosure) {
    f.gap(fs * 2)
    f.text(model.enclosure, { size: fs * 0.85, font: s.regular, color: MUTED, lh: fs * 1.25 })
  }
}

const contactLine = (m: LetterModel) => m.contacts.join('   ·   ')

// ─── Intestazioni dei modelli ─────────────────────────────────────────────
// Ognuna disegna nome, mestiere e contatti e restituisce dove inizia il testo.

type Head = { pg: Pager; area: Area; style: Style }

function headModerno(doc: jsPDF, m: LetterModel): Head {
  const mg = 56
  const pg = new Pager(doc, () => {})
  const contactsW = m.contacts.length ? 170 : 0
  const head = new Flow(pg, mg + 14, A4_W - mg * 2 - 14 - (contactsW ? contactsW + 20 : 0), 1, 48, 48)
  head.name(m.name || m.L.namePlaceholder, { max: 24, font: 'bold', color: INK, upper: true, cs: 1.4, oneLineMax: 16, maxLines: 2 })
  if (m.role) head.text(m.role, { size: 10.5, color: MUTED, upper: true, cs: 1.4, lh: 14 })
  doc.setFillColor(...INK)
  doc.rect(mg, 48, 3, head.y - 48, 'F')
  let bottom = head.y
  if (contactsW) {
    const c = new Flow(pg, A4_W - mg - contactsW, contactsW, 1, 50, 48)
    m.contacts.forEach((x) => c.fit(x, { size: 8.8, color: TEXT, lh: 12.5, align: 'right' }))
    bottom = Math.max(bottom, c.y)
  }
  doc.setDrawColor(...LIGHT_RULE)
  doc.setLineWidth(0.7)
  doc.line(mg, bottom + 14, A4_W - mg, bottom + 14)
  return { pg, area: { x: mg, w: A4_W - mg * 2, top: bottom + 40, topNext: 56 }, style: { text: TEXT, strong: INK, regular: 'regular', bold: 'bold' } }
}

function headProfessionale(doc: jsPDF, m: LetterModel): Head {
  const mg = 56
  const pg = new Pager(doc, () => {
    // Pagine dopo la prima: sottile fascia blu in alto
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, A4_W, 12, 'F')
  })
  const contactsW = m.contacts.length ? 180 : 0
  const nameW = A4_W - mg * 2 - (contactsW ? contactsW + 24 : 0)
  // Altezza della fascia calcolata prima di disegnarla (il testo va sopra)
  const probe = new Flow(pg, mg, nameW, 1, 0, 0)
  const name = m.name || m.L.namePlaceholder
  const lines = nameLines(name, 16, 2)
  const nameSize = probe.fitSize(lines, { font: 'bold', upper: true }, 22)
  const roleLines = m.role ? probe.wrap(m.role, nameW, { size: 10.5 }).length : 0
  const textH = lines.length * nameSize * 1.15 + roleLines * 14.5
  const contactsH = m.contacts.length * 13
  const bandH = 36 + Math.max(textH, contactsH) + 30
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, A4_W, bandH, 'F')
  const head = new Flow(pg, mg, nameW, 1, 36, 50)
  head.name(name, { max: 22, font: 'bold', color: WHITE, upper: true, oneLineMax: 16, maxLines: 2 })
  if (m.role) head.text(m.role, { size: 10.5, color: SKY, lh: 14.5 })
  if (contactsW) {
    const c = new Flow(pg, A4_W - mg - contactsW, contactsW, 1, 36 + Math.max(0, (textH - contactsH) / 2), 50)
    m.contacts.forEach((x) => c.fit(x, { size: 8.8, color: WHITE, lh: 13, align: 'right' }))
  }
  return { pg, area: { x: mg, w: A4_W - mg * 2, top: bandH + 36, topNext: 48 }, style: { text: TEXT, strong: NAVY, regular: 'regular', bold: 'bold' } }
}

function headElegante(doc: jsPDF, m: LetterModel, hasSerif: boolean): Head {
  const mg = 58
  const paint = () => {
    doc.setFillColor(...PAPER)
    doc.rect(0, 0, A4_W, A4_H, 'F')
  }
  paint()
  const pg = new Pager(doc, paint)
  const head = new Flow(pg, mg, A4_W - mg * 2, 1, 50, 56)
  if (m.role) {
    head.text(m.role, { size: 8.5, color: MUTED, upper: true, cs: 2.4, lh: 13 })
    head.gap(4)
  }
  head.name(m.name || m.L.namePlaceholder, { max: 30, font: hasSerif ? 'serif' : 'regular', color: [50, 50, 50], upper: true, cs: 0.8, oneLineMax: 22, maxLines: 2, lhRatio: 1.08 })
  head.gap(10)
  head.rule(LIGHT_RULE, 0.6)
  head.gap(10)
  if (m.contacts.length) head.fit(m.contacts.join('   |   '), { size: 8.6, color: ELEG_TEXT, lh: 12.5 })
  return { pg, area: { x: mg, w: A4_W - mg * 2, top: head.y + 30, topNext: 56 }, style: { text: ELEG_TEXT, strong: [45, 45, 45], regular: 'regular', bold: 'bold' } }
}

function headEuropeo(doc: jsPDF, m: LetterModel): Head {
  const mg = 56
  const pg = new Pager(doc, () => {})
  const head = new Flow(pg, mg, A4_W - mg * 2, 1, 44, 52)
  head.text(m.L.docTitle, { size: 7.8, color: MUTED, upper: true, cs: 1.2, lh: 12 })
  head.gap(3)
  head.name(m.name || m.L.namePlaceholder, { max: 22, font: 'bold', color: INK, oneLineMax: 40 })
  if (m.role) head.text(m.role, { size: 11, color: EU_BLUE, lh: 15 })
  head.gap(8)
  doc.setDrawColor(...EU_BLUE)
  doc.setLineWidth(1.6)
  doc.line(mg, head.y, A4_W - mg, head.y)
  head.gap(10)
  if (m.contacts.length) head.fit(contactLine(m), { size: 8.8, color: TEXT, lh: 12.5 })
  return { pg, area: { x: mg, w: A4_W - mg * 2, top: head.y + 30, topNext: 52 }, style: { text: TEXT, strong: EU_BLUE, regular: 'regular', bold: 'bold' } }
}

function headMinimalClassic(doc: jsPDF, m: LetterModel, classic: boolean, hasSerif: boolean): Head {
  const mg = 56
  const pg = new Pager(doc, () => {})
  const serif = classic && hasSerif
  const align = classic ? 'center' : 'left'
  const head = new Flow(pg, mg, A4_W - mg * 2, 1, 50, 52)
  head.name(m.name || m.L.namePlaceholder, { max: 22, font: serif ? 'serifBold' : 'bold', color: INK, align, oneLineMax: 40 })
  if (m.role) head.text(m.role, { size: 11.5, font: serif ? 'serif' : 'regular', color: GOLD, align, lh: 16 })
  if (m.contacts.length) {
    head.gap(2)
    head.fit(contactLine(m), { size: 8.5, font: serif ? 'serif' : 'regular', color: MUTED, align })
  }
  if (classic) {
    head.gap(10)
    head.rule(GOLD, 0.8, head.w / 2 - 30, head.w / 2 + 30)
    head.gap(4)
  }
  return {
    pg,
    area: { x: mg, w: A4_W - mg * 2, top: head.y + 30, topNext: 52 },
    style: { text: TEXT, strong: INK, regular: serif ? 'serif' : 'regular', bold: serif ? 'serifBold' : 'bold' },
  }
}

const SIDE_W = 150

function headSidebar(doc: jsPDF, m: LetterModel): Head {
  const paint = () => {
    doc.setFillColor(...INK)
    doc.rect(0, 0, SIDE_W, A4_H, 'F')
  }
  paint()
  const pg = new Pager(doc, paint)
  if (m.contacts.length) {
    const side = new Flow(pg, 24, SIDE_W - 44, 1, 52, 52)
    side.text(getCvLabels(m.lang).contact, { size: 9, font: 'bold', color: GOLD, upper: true, cs: 0.8, lh: 13 })
    side.gap(6)
    ;[m.email, m.phone, m.city].filter(Boolean).forEach((c) => {
      side.fit(c, { size: 8.4, color: WHITE, lh: 12 }, 6.2)
      side.gap(3)
    })
  }
  const x = SIDE_W + 36
  const w = A4_W - x - 48
  const head = new Flow(pg, x, w, 1, 48, 52)
  head.name(m.name || m.L.namePlaceholder, { max: 21, font: 'bold', color: INK, oneLineMax: 22 })
  if (m.role) head.text(m.role, { size: 11.5, color: GOLD, lh: 16 })
  return { pg, area: { x, w, top: head.y + 30, topNext: 52 }, style: { text: TEXT, strong: INK, regular: 'regular', bold: 'bold' } }
}

function render(form: CoverLetterForm, fonts: CvFonts, fs: number): jsPDF {
  const model = letterModel(form)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  registerFonts(doc, fonts)
  const author = model.name || undefined
  doc.setProperties({ title: [model.L.docTitle, model.name].filter(Boolean).join(' – '), author, subject: model.subject || model.L.docTitle })

  const hasSerif = !!fonts.serif
  const t = form.template
  const head =
    t === 'moderno'
      ? headModerno(doc, model)
      : t === 'professionale'
        ? headProfessionale(doc, model)
        : t === 'elegante'
          ? headElegante(doc, model, hasSerif)
          : t === 'europeo'
            ? headEuropeo(doc, model)
            : t === 'sidebar'
              ? headSidebar(doc, model)
              : headMinimalClassic(doc, model, t === 'classic', hasSerif)
  drawBody(head.pg, head.area, model, head.style, fs)

  // Numero di pagina solo se le pagine sono più di una
  const pages = doc.getNumberOfPages()
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p)
      doc.setFont('Inter', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(`${p} / ${pages}`, head.area.x + head.area.w, A4_H - 34, { align: 'right' })
    }
  }
  return doc
}

/** PDF della lettera dai dati del modulo (anche non ancora salvati). */
export async function buildLetterPdfBlob(form: CoverLetterForm): Promise<Blob> {
  const fonts = await loadLetterFonts(form.template)
  // Prima si prova a farla stare in una pagina con il testo un poco più piccolo
  for (const fs of [10.5, 10, 9.5]) {
    const doc = render(form, fonts, fs)
    if (doc.getNumberOfPages() === 1) return doc.output('blob')
  }
  return render(form, fonts, 10.5).output('blob')
}

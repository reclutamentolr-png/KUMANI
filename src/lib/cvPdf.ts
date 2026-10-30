import { jsPDF } from 'jspdf'
import {
  CEFR_SKILLS,
  byMostRecent,
  cefrFor,
  descriptionLines,
  formatCvDate,
  nameLines,
  type CvTemplate,
  type CvLink,
  type CvExperience,
  type CvEducation,
  type CvSkill,
  type CvLanguage,
  type CvCertification,
  type CvExtras,
} from '@/lib/cv'
import { formatBirthDate, getCvLabels, type CvLabels } from '@/lib/cvLabels'
import { loadImageAsDataUrl } from '@/lib/pdfHelpers'

export type CvForPdf = {
  code: string
  title: string
  template: CvTemplate
  content_language: string
  full_name: string
  role_title: string | null
  summary: string | null
  email: string | null
  phone: string | null
  location: string | null
  links: CvLink[]
  experiences: CvExperience[]
  education: CvEducation[]
  skills: CvSkill[]
  languages: CvLanguage[]
  certifications: CvCertification[]
  extras?: CvExtras | null
}

// Helper senza jsPDF ri-esportato per chi lo importava da qui
export { loadInterFontBase64 } from '@/lib/pdfHelpers'

type RGB = [number, number, number]
type FontKey = 'regular' | 'bold' | 'serif' | 'serifBold'
type CvFonts = { regular: string; bold: string; serif?: string; serifBold?: string }

const FONT_FILES: Record<FontKey, string> = {
  regular: '/fonts/inter/Inter-Regular.ttf',
  bold: '/fonts/inter/Inter-Bold.ttf',
  serif: '/fonts/ptserif/PTSerif-Regular.ttf',
  serifBold: '/fonts/ptserif/PTSerif-Bold.ttf',
}

async function fontBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`font ${url}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

// Caratteri del PDF: Inter normale e grassetto, PT Serif solo per «Elegante»
async function loadCvFonts(template: CvTemplate): Promise<CvFonts> {
  const serif = template === 'elegante'
  const [regular, bold, serifRegular, serifBold] = await Promise.all([
    fontBase64(FONT_FILES.regular),
    fontBase64(FONT_FILES.bold),
    serif ? fontBase64(FONT_FILES.serif) : Promise.resolve(undefined),
    serif ? fontBase64(FONT_FILES.serifBold) : Promise.resolve(undefined),
  ])
  return { regular, bold, serif: serifRegular, serifBold }
}

// Foto ritagliata al centro (senza deformarla) e, se serve, rotonda
async function preparePhoto(dataUrl: string, shape: 'circle' | 'square' | 'portrait'): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = dataUrl
    })
    const ratio = shape === 'portrait' ? 0.8 : 1
    const outW = 480
    const outH = Math.round(outW / ratio)
    let sw = img.naturalWidth
    let sh = sw / ratio
    if (sh > img.naturalHeight) {
      sh = img.naturalHeight
      sw = sh * ratio
    }
    const sx = (img.naturalWidth - sw) / 2
    // Ritratto: si tiene la parte alta, dove di solito c'è il viso
    const sy = shape === 'portrait' ? Math.max(0, (img.naturalHeight - sh) * 0.25) : (img.naturalHeight - sh) / 2
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if (shape === 'circle') {
      ctx.beginPath()
      ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2)
      ctx.clip()
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, outW, outH)
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
    return shape === 'circle' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    return null
  }
}

const PHOTO_SHAPE: Record<CvTemplate, 'circle' | 'square' | 'portrait'> = {
  moderno: 'circle',
  professionale: 'circle',
  elegante: 'circle',
  europeo: 'portrait',
  minimal: 'square',
  classic: 'circle',
  sidebar: 'square',
}

/** Tutto il PDF del CV: caratteri, foto, QR e impaginazione. */
export async function buildCvPdfBlob(params: { cv: CvForPdf; photoUrl: string | null; publicUrl: string }): Promise<Blob> {
  const { cv, photoUrl, publicUrl } = params
  const QRCode = (await import('qrcode')).default
  const [fonts, rawPhoto, qrDataUrl] = await Promise.all([
    loadCvFonts(cv.template),
    photoUrl ? loadImageAsDataUrl(photoUrl) : Promise.resolve(null),
    QRCode.toDataURL(publicUrl, { width: 240, margin: 1, errorCorrectionLevel: 'H' }),
  ])
  const photo = rawPhoto ? await preparePhoto(rawPhoto, PHOTO_SHAPE[cv.template] || 'square') : null
  return generateCvPdfBlob({ cv, photoDataUrl: photo, fonts, publicUrl, qrDataUrl })
}

// ─── Impaginazione ────────────────────────────────────────────────────────
// Coordinate dall'alto: «y» è il bordo superiore della riga successiva.
// Ogni colonna (Flow) va a pagina nuova da sola quando finisce lo spazio.

const A4_W = 595.28
const A4_H = 841.89
const FOOTER_H = 62

class Pager {
  maxY: Record<number, number> = {}
  constructor(
    public doc: jsPDF,
    public decorate: (page: number) => void,
  ) {}
  get bottom() {
    return A4_H - FOOTER_H
  }
  ensure(page: number) {
    while (this.doc.getNumberOfPages() < page) {
      this.doc.addPage()
      this.decorate(this.doc.getNumberOfPages())
    }
    this.doc.setPage(page)
  }
  mark(page: number, y: number) {
    this.maxY[page] = Math.max(this.maxY[page] ?? 0, y)
  }
}

type TextOpts = {
  size?: number
  font?: FontKey
  color?: RGB
  lh?: number
  indent?: number
  cs?: number
  upper?: boolean
  align?: 'left' | 'right' | 'center'
  keep?: boolean // tutte le righe sulla stessa pagina
  url?: string
}

class Flow {
  constructor(
    public pg: Pager,
    public x: number,
    public w: number,
    public page: number,
    public y: number,
    public topNext: number,
  ) {}

  get doc() {
    return this.pg.doc
  }

  need(h: number) {
    if (this.y + h > this.pg.bottom && this.y > this.topNext + 1) {
      this.page += 1
      this.y = this.topNext
    }
    this.pg.ensure(this.page)
  }

  gap(h: number) {
    this.y += h
  }

  setFont(font: FontKey, size: number, color: RGB) {
    const family = font === 'serif' || font === 'serifBold' ? 'PTSerif' : 'Inter'
    this.doc.setFont(family, font === 'bold' || font === 'serifBold' ? 'bold' : 'normal')
    this.doc.setFontSize(size)
    this.doc.setTextColor(...color)
  }

  wrap(text: string, width: number, o: TextOpts): string[] {
    const size = o.size ?? 9
    this.setFont(o.font ?? 'regular', size, o.color ?? INK)
    const t = o.upper ? text.toUpperCase() : text
    // Con la spaziatura tra le lettere la riga è più lunga di quanto misura jsPDF
    const effective = o.cs ? width / (1 + (o.cs * 1.6) / size) : width
    return this.doc.splitTextToSize(t, effective) as string[]
  }

  text(text: string, o: TextOpts = {}) {
    if (!text) return
    const size = o.size ?? 9
    const lh = o.lh ?? size * 1.4
    const indent = o.indent ?? 0
    const lines = this.wrap(text, this.w - indent, o)
    if (o.keep) this.need(lines.length * lh)
    for (const line of lines) {
      this.need(lh)
      this.setFont(o.font ?? 'regular', size, o.color ?? INK)
      const base = this.y + size * 0.8
      if (o.align === 'right') this.doc.text(line, this.x + this.w, base, { align: 'right', charSpace: o.cs })
      else if (o.align === 'center') this.doc.text(line, this.x + this.w / 2, base, { align: 'center', charSpace: o.cs })
      else if (o.url) this.doc.textWithLink(line, this.x + indent, base, { url: o.url })
      else this.doc.text(line, this.x + indent, base, { charSpace: o.cs })
      this.y += lh
    }
    this.pg.mark(this.page, this.y)
  }

  // Grandezza con cui tutte le righe stanno nella larghezza della colonna
  fitSize(lines: string[], o: TextOpts, max: number): number {
    let size = max
    for (const raw of lines) {
      const t = o.upper ? raw.toUpperCase() : raw
      this.setFont(o.font ?? 'regular', 10, o.color ?? INK)
      const per = this.doc.getTextWidth(t) / 10
      const room = this.w - (o.indent ?? 0) - (o.cs ?? 0) * t.length
      if (per > 0) size = Math.min(size, room / per)
    }
    return size
  }

  // Nome della persona: righe tra le parole e grandezza adattata, mai spezzato
  name(text: string, o: TextOpts & { max: number; oneLineMax?: number; maxLines?: number; lhRatio?: number }) {
    const lines = nameLines(text || '—', o.oneLineMax ?? 16, o.maxLines ?? 2)
    const size = this.fitSize(lines, o, o.max)
    lines.forEach((l) => this.text(l, { ...o, size, lh: size * (o.lhRatio ?? 1.15) }))
  }

  // Una riga sola (email, link): si rimpicciolisce fino a «min», poi va a capo
  fit(text: string, o: TextOpts, min = 6.8) {
    const size = o.size ?? 9
    const fitted = Math.max(min, Math.min(size, this.fitSize([text], o, size)))
    this.text(text, { ...o, size: fitted, lh: o.lh ?? size * 1.4 })
  }

  bullets(items: string[], o: TextOpts & { bullet?: string } = {}) {
    const size = o.size ?? 9
    const lh = o.lh ?? size * 1.4
    const indent = o.indent ?? 0
    for (const item of items) {
      const lines = this.wrap(item, this.w - indent - 10, o)
      lines.forEach((line, i) => {
        this.need(lh)
        this.setFont(o.font ?? 'regular', size, o.color ?? INK)
        const base = this.y + size * 0.8
        if (i === 0) this.doc.text(o.bullet ?? '•', this.x + indent, base)
        this.doc.text(line, this.x + indent + 10, base)
        this.y += lh
      })
      this.y += 1.5
    }
    this.pg.mark(this.page, this.y)
  }

  // Testo a sinistra e, sulla prima riga, un testo corto allineato a destra (le date)
  row(left: string, right: string, lo: TextOpts, ro: TextOpts) {
    const lsize = lo.size ?? 9
    const lh = lo.lh ?? lsize * 1.4
    this.setFont(ro.font ?? 'regular', ro.size ?? 8, ro.color ?? MUTED)
    const rw = right ? this.doc.getTextWidth(right) + 10 : 0
    const lines = this.wrap(left, this.w - rw - (lo.indent ?? 0), lo)
    lines.forEach((line, i) => {
      this.need(lh)
      const base = this.y + lsize * 0.8
      if (i === 0 && right) {
        this.setFont(ro.font ?? 'regular', ro.size ?? 8, ro.color ?? MUTED)
        this.doc.text(right, this.x + this.w, base, { align: 'right' })
      }
      this.setFont(lo.font ?? 'regular', lsize, lo.color ?? INK)
      this.doc.text(line, this.x + (lo.indent ?? 0), base, { charSpace: lo.cs })
      this.y += lh
    })
    this.pg.mark(this.page, this.y)
  }

  rule(color: RGB, width = 0.6, from = 0, to = this.w) {
    this.need(2)
    this.doc.setDrawColor(...color)
    this.doc.setLineWidth(width)
    this.doc.line(this.x + from, this.y, this.x + to, this.y)
  }

  // Descrizione: elenco puntato se le righe iniziano con il trattino
  description(text: string, o: TextOpts = {}) {
    if (!text?.trim()) return
    const { bullets, lines } = descriptionLines(text)
    if (bullets) this.bullets(lines, o)
    else lines.forEach((l) => this.text(l, o))
  }

  // Voce su una linea del tempo: pallino all'inizio e riga verticale a sinistra
  timelineItem(draw: () => void, t: { lineColor: RGB; dot: (x: number, y: number) => void; offset?: number }) {
    const lx = this.x - (t.offset ?? 12)
    this.need(14)
    const start = { page: this.page, y: this.y }
    draw()
    const end = { page: this.page, y: this.y }
    for (let p = start.page; p <= end.page; p++) {
      this.pg.ensure(p)
      this.doc.setDrawColor(...t.lineColor)
      this.doc.setLineWidth(1)
      const y1 = p === start.page ? start.y + 4 : this.topNext
      const y2 = p === end.page ? end.y + 2 : this.pg.bottom
      this.doc.line(lx, y1, lx, y2)
    }
    this.pg.ensure(start.page)
    t.dot(lx, start.y + 4.5)
    this.pg.ensure(this.page)
  }
}

const INK: RGB = [23, 23, 23]
const TEXT: RGB = [55, 55, 55]
const MUTED: RGB = [115, 115, 115]
const LIGHT_RULE: RGB = [205, 205, 205]
const WHITE: RGB = [255, 255, 255]
const GOLD: RGB = [199, 161, 90]

function registerFonts(doc: jsPDF, fonts: CvFonts) {
  doc.addFileToVFS('Inter-Regular.ttf', fonts.regular)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.addFileToVFS('Inter-Bold.ttf', fonts.bold)
  doc.addFont('Inter-Bold.ttf', 'Inter', 'bold')
  if (fonts.serif && fonts.serifBold) {
    doc.addFileToVFS('PTSerif-Regular.ttf', fonts.serif)
    doc.addFont('PTSerif-Regular.ttf', 'PTSerif', 'normal')
    doc.addFileToVFS('PTSerif-Bold.ttf', fonts.serifBold)
    doc.addFont('PTSerif-Bold.ttf', 'PTSerif', 'bold')
  }
  doc.setFont('Inter', 'normal')
}

function addImageSafe(doc: jsPDF, dataUrl: string | null, x: number, y: number, w: number, h: number) {
  if (!dataUrl) return false
  try {
    doc.addImage(dataUrl, dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG', x, y, w, h)
    return true
  } catch {
    return false
  }
}

type Ctx = {
  cv: CvForPdf
  L: CvLabels
  lang: string
  extras: CvExtras
  experiences: CvExperience[]
  education: CvEducation[]
  personal: { label: string; value: string }[]
  digital: string[]
  interests: string[]
  range: (item: CvExperience | CvEducation) => string
  date: (iso: string) => string
}

function splitList(text: string | undefined): string[] {
  return (text || '')
    .split(/\r?\n|,|;/)
    .map((x) => x.replace(/^[-•*–]\s*/, '').trim())
    .filter(Boolean)
}

function makeCtx(cv: CvForPdf): Ctx {
  const L = getCvLabels(cv.content_language)
  const lang = cv.content_language
  const extras = cv.extras || {}
  const range = (item: CvExperience | CvEducation) => {
    const s = formatCvDate(item.startDate, lang)
    const e = item.current ? L.present : formatCvDate(item.endDate, lang)
    return s && e ? `${s} – ${e}` : s || e
  }
  return {
    cv,
    L,
    lang,
    extras,
    experiences: byMostRecent(cv.experiences || []),
    education: byMostRecent(cv.education || []),
    personal: [
      extras.birthDate ? { label: L.birthDate, value: formatBirthDate(extras.birthDate, lang) } : null,
      extras.nationality ? { label: L.nationality, value: extras.nationality } : null,
      extras.drivingLicence ? { label: L.drivingLicence, value: extras.drivingLicence } : null,
    ].filter((x): x is { label: string; value: string } => !!x),
    digital: splitList(extras.digitalSkills),
    interests: splitList(extras.interests),
    range,
    date: (iso: string) => formatCvDate(iso, lang),
  }
}

const langLevel = (l: CvLanguage, L: CvLabels) => (l.native ? L.motherTongue : l.level)
const certLine = (c: CvCertification, ctx: Ctx) => [c.issuer, c.date ? ctx.date(c.date) : ''].filter(Boolean).join(' · ')

// Frase privacy dopo tutte le colonne, a tutta larghezza
function drawPrivacy(pg: Pager, ctx: Ctx, x: number, w: number, topNext: number, color: RGB = MUTED) {
  if (ctx.extras.privacyConsent !== true) return
  const last = pg.doc.getNumberOfPages()
  const flow = new Flow(pg, x, w, last, (pg.maxY[last] ?? topNext) + 16, topNext)
  flow.text(ctx.L.privacy, { size: 7, color, lh: 9.5 })
}

// Piede di ogni pagina: link al CV sempre aggiornato, QR sulla prima, numero di pagina.
// Nei modelli con la colonna scura parte dopo la colonna.
function drawFooters(doc: jsPDF, L: CvLabels, publicUrl: string, qrDataUrl: string | null, startX: number, margin: number) {
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    const top = A4_H - FOOTER_H + 10
    doc.setDrawColor(225, 225, 225)
    doc.setLineWidth(0.5)
    doc.line(startX, top, A4_W - margin, top)
    if (p === 1) addImageSafe(doc, qrDataUrl, A4_W - margin - 38, top + 6, 38, 38)
    doc.setFont('Inter', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(L.poweredBy, startX, top + 18)
    doc.setTextColor(...GOLD)
    doc.textWithLink(publicUrl, startX, top + 29, { url: publicUrl })
    if (pages > 1) {
      doc.setTextColor(...MUTED)
      doc.text(`${p} / ${pages}`, A4_W - margin - 50, top + 29, { align: 'right' })
    }
  }
}

// ─── Modello Moderno ──────────────────────────────────────────────────────

function drawModerno(doc: jsPDF, ctx: Ctx, photo: string | null) {
  const { cv, L } = ctx
  const m = 44
  const pg = new Pager(doc, () => {})
  const photoSize = 84
  const head = new Flow(pg, m + 14, A4_W - m * 2 - 14 - (photo ? photoSize + 20 : 0), 1, 46, 44)
  head.name(cv.full_name, { max: 24, font: 'bold', color: INK, upper: true, cs: 1.4, oneLineMax: 14, maxLines: 3 })
  if (cv.role_title) head.text(cv.role_title, { size: 11, color: MUTED, upper: true, cs: 1.6, lh: 15 })
  doc.setFillColor(...INK)
  doc.rect(m, 46, 3, head.y - 46, 'F')
  if (photo) addImageSafe(doc, photo, A4_W - m - photoSize, 36, photoSize, photoSize)
  const top = Math.max(head.y, photo ? 36 + photoSize : 0) + 24

  const leftW = 160
  const left = new Flow(pg, m, leftW, 1, top, 48)
  const right = new Flow(pg, m + leftW + 26, A4_W - m * 2 - leftW - 26, 1, top, 48)

  const heading = (f: Flow, title: string) => {
    f.need(40)
    f.text(title, { size: 10, font: 'bold', color: INK, upper: true, cs: 1.3, lh: 13 })
    f.gap(2)
    f.rule(LIGHT_RULE, 0.7)
    f.gap(9)
  }
  const dot = (x: number, y: number) => {
    doc.setFillColor(...WHITE)
    doc.setDrawColor(...INK)
    doc.setLineWidth(1.4)
    doc.circle(x, y, 3.2, 'FD')
  }
  const tl = { lineColor: LIGHT_RULE, dot, offset: -3 }

  // Colonna sinistra
  const contacts = [cv.phone, cv.email, cv.location].filter(Boolean) as string[]
  if (contacts.length || cv.links.length) {
    heading(left, L.contact)
    contacts.forEach((c) => left.fit(c, { size: 8.8, color: TEXT }))
    cv.links.forEach((l) => left.fit(l.label || l.url, { size: 8.8, color: TEXT, url: l.url }))
    left.gap(12)
  }
  if (ctx.personal.length) {
    heading(left, L.personalShort)
    ctx.personal.forEach((p) => {
      left.text(p.label, { size: 7, color: MUTED, upper: true, cs: 0.5, lh: 9.5 })
      left.text(p.value, { size: 8.8, color: TEXT })
      left.gap(3)
    })
    left.gap(9)
  }
  if (ctx.education.length) {
    heading(left, L.educationShort)
    const inner = new Flow(pg, left.x + 12, left.w - 12, left.page, left.y, left.topNext)
    ctx.education.forEach((ed) => {
      inner.timelineItem(() => {
        inner.text([ed.degree, ed.field].filter(Boolean).join(' – '), { size: 8.5, font: 'bold', color: INK, upper: true, lh: 11.5 })
        inner.text(ctx.range(ed), { size: 8, color: MUTED })
        if (ed.institution) inner.text(ed.institution, { size: 8.6, color: TEXT })
      }, { ...tl, offset: 9 })
      inner.gap(8)
    })
    left.page = inner.page
    left.y = inner.y + 6
  }
  if (cv.skills.length) {
    heading(left, L.skills)
    left.bullets(cv.skills.map((s) => s.name), { size: 8.8, color: TEXT })
    left.gap(10)
  }
  if (cv.languages.length) {
    heading(left, L.languagesShort)
    cv.languages.forEach((l) => left.row(l.name, langLevel(l, L), { size: 8.8, color: TEXT }, { size: 8.3, color: MUTED }))
    left.gap(10)
  }
  if (ctx.interests.length) {
    heading(left, L.interests)
    left.text(ctx.interests.join(' · '), { size: 8.8, color: TEXT })
  }

  // Colonna destra
  if (cv.summary) {
    heading(right, L.profile)
    right.text(cv.summary, { size: 9, color: TEXT, lh: 13 })
    right.gap(12)
  }
  if (ctx.experiences.length) {
    heading(right, L.experience)
    const inner = new Flow(pg, right.x + 14, right.w - 14, right.page, right.y, right.topNext)
    ctx.experiences.forEach((exp) => {
      inner.timelineItem(() => {
        inner.text([exp.role, exp.company].filter(Boolean).join(' – '), { size: 9.3, font: 'bold', color: INK, upper: true, cs: 0.3, lh: 12.5 })
        inner.text([ctx.range(exp), exp.location].filter(Boolean).join(' · '), { size: 8, color: MUTED, lh: 12 })
        inner.gap(1)
        inner.description(exp.description, { size: 8.8, color: TEXT, lh: 12 })
      }, { ...tl, offset: 10 })
      inner.gap(10)
    })
    right.page = inner.page
    right.y = inner.y + 4
  }
  if (cv.certifications.length) {
    heading(right, L.certifications)
    cv.certifications.forEach((c) => {
      right.text(c.name, { size: 9, font: 'bold', color: INK })
      const sub = certLine(c, ctx)
      if (sub) right.text(sub, { size: 8, color: MUTED })
      right.gap(4)
    })
    right.gap(8)
  }
  if (ctx.digital.length) {
    heading(right, L.digitalSkills)
    right.bullets(ctx.digital, { size: 8.8, color: TEXT })
  }
  drawPrivacy(pg, ctx, m, A4_W - m * 2, 48)
}

// ─── Modello Professionale ────────────────────────────────────────────────

const NAVY: RGB = [15, 42, 74]
const NAVY_SOFT: RGB = [44, 74, 110]
const SKY: RGB = [176, 214, 243]
const SKY_LINE: RGB = [186, 214, 238]
const BLUE_DOT: RGB = [47, 111, 179]

function drawProfessionale(doc: jsPDF, ctx: Ctx, photo: string | null) {
  const { cv, L } = ctx
  const sideW = 200
  const paintSide = () => {
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, sideW, A4_H, 'F')
  }
  paintSide()
  const pg = new Pager(doc, paintSide)
  const side = new Flow(pg, 26, sideW - 50, 1, 36, 40)
  if (photo) {
    addImageSafe(doc, photo, 26, 36, 92, 92)
    side.y = 36 + 92 + 16
  }
  side.name(cv.full_name, { max: 17, font: 'bold', color: WHITE, upper: true, oneLineMax: 0, maxLines: 3, lhRatio: 1.18 })
  if (cv.role_title) side.text(cv.role_title, { size: 9.5, color: SKY, lh: 13 })
  side.gap(8)
  side.rule(NAVY_SOFT, 0.8)
  side.gap(10)
  ;[cv.location, cv.phone, cv.email].filter(Boolean).forEach((c) => side.fit(c as string, { size: 8.5, color: WHITE, lh: 12 }))
  cv.links.forEach((l) => side.fit(l.label || l.url, { size: 8.5, color: WHITE, lh: 12, url: l.url }))
  side.gap(14)

  const sideHeading = (title: string) => {
    side.need(40)
    side.pg.ensure(side.page)
    doc.setFillColor(...NAVY_SOFT)
    doc.circle(side.x + 7, side.y + 5.5, 7, 'F')
    doc.setFillColor(...SKY)
    doc.circle(side.x + 7, side.y + 5.5, 2.2, 'F')
    const f = new Flow(pg, side.x + 20, side.w - 20, side.page, side.y + 0.5, side.topNext)
    f.text(title, { size: 9, font: 'bold', color: SKY, upper: true, cs: 0.9, lh: 12 })
    side.page = f.page
    side.y = Math.max(f.y, side.y + 14) + 7
  }

  if (ctx.personal.length) {
    sideHeading(L.personalShort)
    ctx.personal.forEach((p) => {
      side.text(p.label, { size: 7, color: SKY, upper: true, cs: 0.4, lh: 9.5 })
      side.text(p.value, { size: 8.6, color: WHITE, lh: 12 })
      side.gap(3)
    })
    side.gap(10)
  }
  if (ctx.education.length) {
    sideHeading(L.educationShort)
    ctx.education.forEach((ed) => {
      side.text(ctx.range(ed), { size: 7.8, color: SKY, lh: 11 })
      side.text([ed.degree, ed.field].filter(Boolean).join(' – '), { size: 8.8, font: 'bold', color: WHITE, lh: 12 })
      if (ed.institution) side.text(ed.institution, { size: 8.4, color: WHITE, lh: 11.5 })
      side.gap(6)
    })
    side.gap(8)
  }
  if (cv.skills.length) {
    sideHeading(L.skills)
    cv.skills.forEach((s) => {
      side.text(s.name, { size: 8.6, color: WHITE, lh: 11.5 })
      side.need(8)
      doc.setFillColor(...NAVY_SOFT)
      doc.rect(side.x, side.y, side.w, 2.6, 'F')
      doc.setFillColor(125, 196, 245)
      doc.rect(side.x, side.y, (side.w * s.level) / 4, 2.6, 'F')
      side.gap(8)
    })
    side.gap(8)
  }
  if (cv.languages.length) {
    sideHeading(L.languagesShort)
    cv.languages.forEach((l) => side.row(l.name, langLevel(l, L), { size: 8.6, font: 'bold', color: WHITE, lh: 12.5 }, { size: 8.3, color: SKY }))
  }

  // Colonna principale
  const main = new Flow(pg, sideW + 30, A4_W - sideW - 30 - 38, 1, 42, 44)
  const mainHeading = (title: string) => {
    main.need(44)
    doc.setFillColor(224, 238, 251)
    doc.circle(main.x + 8, main.y + 6.5, 8, 'F')
    doc.setFillColor(...NAVY)
    doc.circle(main.x + 8, main.y + 6.5, 2.6, 'F')
    main.setFont('bold', 11.5, NAVY)
    const t = title.toUpperCase()
    doc.text(t, main.x + 24, main.y + 10.5, { charSpace: 0.6 })
    const tw = doc.getTextWidth(t) + t.length * 0.6
    doc.setDrawColor(...SKY_LINE)
    doc.setLineWidth(0.8)
    if (main.x + 24 + tw + 10 < main.x + main.w) doc.line(main.x + 24 + tw + 10, main.y + 6.5, main.x + main.w, main.y + 6.5)
    main.y += 24
    pg.mark(main.page, main.y)
  }
  if (cv.summary) {
    mainHeading(L.profile)
    main.text(cv.summary, { size: 9, color: TEXT, lh: 13 })
    main.gap(14)
  }
  if (ctx.experiences.length) {
    mainHeading(L.experience)
    const inner = new Flow(pg, main.x + 18, main.w - 18, main.page, main.y, main.topNext)
    const dot = (x: number, y: number) => {
      doc.setFillColor(...WHITE)
      doc.circle(x, y, 5, 'F')
      doc.setFillColor(...BLUE_DOT)
      doc.circle(x, y, 3.4, 'F')
    }
    ctx.experiences.forEach((exp) => {
      inner.timelineItem(() => {
        const title = [exp.role, exp.company].filter(Boolean).join(' – ') + (exp.location ? ` (${exp.location})` : '')
        inner.text(title, { size: 9.2, font: 'bold', color: NAVY, upper: true, cs: 0.2, lh: 12.5 })
        inner.text(ctx.range(exp), { size: 8, color: MUTED, lh: 12 })
        inner.gap(1)
        inner.description(exp.description, { size: 8.8, color: TEXT, lh: 12 })
      }, { lineColor: SKY_LINE, dot, offset: 10 })
      inner.gap(11)
    })
    main.page = inner.page
    main.y = inner.y + 4
  }
  if (cv.certifications.length) {
    mainHeading(L.certifications)
    cv.certifications.forEach((c) => {
      main.text(c.name, { size: 9, font: 'bold', color: NAVY })
      const sub = certLine(c, ctx)
      if (sub) main.text(sub, { size: 8, color: MUTED })
      main.gap(4)
    })
    main.gap(8)
  }
  if (ctx.digital.length) {
    mainHeading(L.digitalSkills)
    main.bullets(ctx.digital, { size: 8.8, color: TEXT })
    main.gap(8)
  }
  if (ctx.interests.length) {
    mainHeading(L.interests)
    main.text(ctx.interests.join(' · '), { size: 8.8, color: TEXT })
  }
  // Privacy nella colonna principale, non sopra la colonna blu
  if (ctx.extras.privacyConsent === true) {
    main.gap(14)
    main.text(L.privacy, { size: 7, color: MUTED, lh: 9.5 })
  }
}

// ─── Modello Elegante ─────────────────────────────────────────────────────

const PAPER: RGB = [251, 251, 250]
const ELEG_TEXT: RGB = [75, 75, 75]
const ELEG_HEAD: RGB = [60, 60, 60]

function drawElegante(doc: jsPDF, ctx: Ctx, photo: string | null, hasSerif: boolean) {
  const { cv, L } = ctx
  const m = 46
  const paint = () => {
    doc.setFillColor(...PAPER)
    doc.rect(0, 0, A4_W, A4_H, 'F')
  }
  paint()
  const pg = new Pager(doc, paint)
  const photoSize = 84
  const head = new Flow(pg, m, A4_W - m * 2 - (photo ? photoSize + 20 : 0), 1, 48, 44)
  if (cv.role_title) {
    head.text(cv.role_title, { size: 8.5, color: MUTED, upper: true, cs: 2.4, lh: 13 })
    head.gap(4)
  }
  head.name(cv.full_name, { max: 32, font: hasSerif ? 'serif' : 'regular', color: [50, 50, 50], upper: true, cs: 0.8, oneLineMax: 0, maxLines: 3, lhRatio: 1.08 })
  if (photo) addImageSafe(doc, photo, A4_W - m - photoSize, 40, photoSize, photoSize)
  const ruleY = Math.max(head.y + 8, photo ? 40 + photoSize + 12 : 0)
  doc.setDrawColor(...LIGHT_RULE)
  doc.setLineWidth(0.6)
  doc.line(m, ruleY, A4_W - m, ruleY)
  const top = ruleY + 22

  const leftW = 150
  const divider = m + leftW + 16
  const left = new Flow(pg, m, leftW, 1, top, 50)
  const right = new Flow(pg, divider + 18, A4_W - m - divider - 18, 1, top, 50)

  const heading = (f: Flow, title: string) => {
    f.need(36)
    f.text(title, { size: 8.6, font: 'bold', color: ELEG_HEAD, upper: true, cs: 2.2, lh: 12 })
    f.gap(8)
  }
  const sep = (f: Flow) => {
    f.gap(4)
    f.rule(LIGHT_RULE, 0.6)
    f.gap(16)
  }

  const contacts = [cv.email, cv.phone, cv.location].filter(Boolean) as string[]
  if (contacts.length || cv.links.length) {
    heading(left, L.contact)
    contacts.forEach((c) => left.fit(c, { size: 8.6, color: ELEG_TEXT, lh: 12.5 }))
    cv.links.forEach((l) => left.fit(l.label || l.url, { size: 8.6, color: ELEG_TEXT, lh: 12.5, url: l.url }))
    left.gap(14)
  }
  if (ctx.personal.length) {
    heading(left, L.personalShort)
    ctx.personal.forEach((p) => {
      left.text(p.label, { size: 7.3, color: MUTED, lh: 10 })
      left.text(p.value, { size: 8.6, color: ELEG_TEXT, lh: 12.5 })
      left.gap(3)
    })
    left.gap(11)
  }
  if (cv.skills.length) {
    heading(left, L.skills)
    left.bullets(cv.skills.map((s) => s.name), { size: 8.6, color: ELEG_TEXT, bullet: '–', lh: 12.5 })
    left.gap(12)
  }
  if (cv.languages.length) {
    heading(left, L.languagesShort)
    cv.languages.forEach((l) => left.text(`${l.name}  |  ${langLevel(l, L)}`, { size: 8.6, color: ELEG_TEXT, lh: 13 }))
    left.gap(12)
  }
  if (ctx.digital.length) {
    heading(left, L.digitalSkills)
    left.bullets(ctx.digital, { size: 8.6, color: ELEG_TEXT, bullet: '–', lh: 12.5 })
    left.gap(12)
  }
  if (ctx.interests.length) {
    heading(left, L.interests)
    left.text(ctx.interests.join(', '), { size: 8.6, color: ELEG_TEXT, lh: 12.5 })
  }

  if (cv.summary) {
    heading(right, L.profile)
    right.text(cv.summary, { size: 9, color: ELEG_TEXT, lh: 13.5 })
    sep(right)
  }
  if (ctx.experiences.length) {
    heading(right, L.experience)
    ctx.experiences.forEach((exp, i) => {
      right.need(40)
      right.text(exp.role, { size: 9.2, font: 'bold', color: [45, 45, 45], upper: true, cs: 0.4, lh: 12.5 })
      const where = [exp.company, exp.location].filter(Boolean).join(', ')
      right.text([where, ctx.range(exp)].filter(Boolean).join('  |  '), { size: 8.3, color: MUTED, lh: 12 })
      right.gap(2)
      right.description(exp.description, { size: 8.8, color: ELEG_TEXT, lh: 12.5 })
      if (i < ctx.experiences.length - 1) right.gap(10)
    })
    sep(right)
  }
  if (ctx.education.length) {
    heading(right, L.educationShort)
    ctx.education.forEach((ed) => {
      right.need(30)
      right.text([ed.degree, ed.field].filter(Boolean).join(' – '), { size: 9.2, font: 'bold', color: [45, 45, 45], upper: true, cs: 0.4, lh: 12.5 })
      right.text([ed.institution, ctx.range(ed)].filter(Boolean).join('  |  '), { size: 8.3, color: MUTED, lh: 12 })
      right.gap(8)
    })
  }
  if (cv.certifications.length) {
    right.gap(6)
    heading(right, L.certifications)
    cv.certifications.forEach((c) => {
      right.text(c.name, { size: 9, font: 'bold', color: [45, 45, 45] })
      const sub = certLine(c, ctx)
      if (sub) right.text(sub, { size: 8, color: MUTED })
      right.gap(4)
    })
  }

  // Riga verticale tra le colonne, su ogni pagina fin dove c'è testo
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...LIGHT_RULE)
    doc.setLineWidth(0.6)
    doc.line(divider, p === 1 ? ruleY : 44, divider, Math.min(pg.bottom, (pg.maxY[p] ?? top) + 4))
  }
  drawPrivacy(pg, ctx, m, A4_W - m * 2, 50)
}

// ─── Formato europeo ──────────────────────────────────────────────────────

const EU_BLUE: RGB = [29, 79, 145]

function drawEuropeo(doc: jsPDF, ctx: Ctx, photo: string | null) {
  const { cv, L } = ctx
  const m = 44
  const pg = new Pager(doc, () => {})
  const photoW = 70
  const photoH = 87.5
  const head = new Flow(pg, m, A4_W - m * 2 - (photo ? photoW + 20 : 0), 1, 42, 44)
  head.text(L.europeanFormat, { size: 7.8, color: MUTED, upper: true, cs: 1.2, lh: 12 })
  head.gap(3)
  head.name(cv.full_name, { max: 22, font: 'bold', color: INK, oneLineMax: 40 })
  if (cv.role_title) head.text(cv.role_title, { size: 11, color: EU_BLUE, lh: 15 })
  if (photo) addImageSafe(doc, photo, A4_W - m - photoW, 38, photoW, photoH)
  const ruleY = Math.max(head.y + 8, photo ? 38 + photoH + 8 : 0)
  doc.setDrawColor(...EU_BLUE)
  doc.setLineWidth(1.6)
  doc.line(m, ruleY, A4_W - m, ruleY)

  const labelW = 128
  const gapW = 16
  const content = new Flow(pg, m + labelW + gapW, A4_W - m * 2 - labelW - gapW, 1, ruleY + 18, 48)
  const full = () => new Flow(pg, m, A4_W - m * 2, content.page, content.y, 48)

  const section = (title: string) => {
    if (content.y > content.topNext + 2) content.gap(6)
    content.need(44)
    const f = full()
    f.setFont('bold', 10, EU_BLUE)
    const t = title.toUpperCase()
    doc.text(t, m, f.y + 8, { charSpace: 0.7 })
    const tw = doc.getTextWidth(t) + t.length * 0.7
    doc.setDrawColor(170, 190, 220)
    doc.setLineWidth(0.6)
    doc.line(m + tw + 10, f.y + 4.5, A4_W - m, f.y + 4.5)
    content.y += 22
    pg.mark(content.page, content.y)
  }
  // Etichetta a sinistra, allineata a destra, alla stessa altezza del contenuto
  const labeled = (label: string, draw: () => void) => {
    content.need(14)
    const startPage = content.page
    const startY = content.y
    const lf = new Flow(pg, m, labelW, startPage, startY, 48)
    // Periodo troppo lungo: va a capo tra le due date, non dentro una data
    const lo: TextOpts = { size: 8, color: MUTED, align: 'right', lh: 11 }
    const parts = label.includes(' – ') && lf.wrap(label, labelW, lo).length > 1 ? label.split(' – ').map((x, i, all) => (i < all.length - 1 ? `${x} –` : x)) : label ? [label] : []
    parts.forEach((x) => lf.text(x, lo))
    pg.ensure(content.page)
    draw()
    if (content.page === startPage) content.y = Math.max(content.y, lf.y)
    content.gap(7)
  }

  section(L.personal)
  if (cv.location) labeled(L.address, () => content.text(cv.location!, { size: 9, color: TEXT }))
  if (cv.phone) labeled(L.phone, () => content.text(cv.phone!, { size: 9, color: TEXT }))
  if (cv.email) labeled(L.email, () => content.fit(cv.email!, { size: 9, color: TEXT }))
  cv.links.forEach((l) => labeled(l.label || L.website, () => content.fit(l.url, { size: 9, color: EU_BLUE, url: l.url })))
  ctx.personal
    .filter((p) => p.label !== L.drivingLicence)
    .forEach((p) => labeled(p.label, () => content.text(p.value, { size: 9, color: TEXT })))
  content.gap(6)

  if (cv.summary) {
    section(L.profile)
    labeled('', () => content.text(cv.summary!, { size: 9, color: TEXT, lh: 13 }))
    content.gap(6)
  }
  if (ctx.experiences.length) {
    section(L.experience)
    ctx.experiences.forEach((exp) => {
      content.need(40)
      labeled(ctx.range(exp), () => {
        content.text(exp.role, { size: 9.4, font: 'bold', color: INK, lh: 12.5 })
        const where = [exp.company, exp.location].filter(Boolean).join(' – ')
        if (where) content.text(where, { size: 8.8, color: MUTED, lh: 12 })
        content.gap(1)
        content.description(exp.description, { size: 8.8, color: TEXT, lh: 12 })
      })
      content.gap(3)
    })
  }
  if (ctx.education.length) {
    section(L.education)
    ctx.education.forEach((ed) => {
      content.need(30)
      labeled(ctx.range(ed), () => {
        content.text([ed.degree, ed.field].filter(Boolean).join(' – '), { size: 9.4, font: 'bold', color: INK, lh: 12.5 })
        if (ed.institution) content.text(ed.institution, { size: 8.8, color: MUTED, lh: 12 })
      })
      content.gap(3)
    })
  }

  const native = (cv.languages || []).filter((l) => l.native)
  const foreign = (cv.languages || []).filter((l) => !l.native)
  if (native.length || foreign.length) {
    section(L.languages)
    if (native.length) labeled(L.motherTongue, () => content.text(native.map((l) => l.name).join(', '), { size: 9, font: 'bold', color: INK }))
    if (foreign.length) {
      labeled(L.otherLanguages, () => {
        const nameW = Math.min(90, content.w * 0.24)
        const cellW = (content.w - nameW) / 5
        const drawRow = (cells: string[], o: { bold?: boolean; fill?: RGB; color?: RGB; size?: number; spans?: number[] }) => {
          const size = o.size ?? 8
          content.setFont(o.bold ? 'bold' : 'regular', size, o.color ?? TEXT)
          // Celle: la prima per il nome, poi 5 colonne (o gruppi uniti con «spans»)
          const spans = o.spans ?? [1, 1, 1, 1, 1, 1]
          const widths = spans.map((s, i) => (i === 0 ? nameW : cellW * s))
          const wrapped = cells.map((c, i) => doc.splitTextToSize(c, widths[i] - 4) as string[])
          const h = Math.max(...wrapped.map((w) => w.length)) * (size * 1.25) + 7
          content.need(h)
          let x = content.x
          if (o.fill) {
            doc.setFillColor(...o.fill)
            doc.rect(content.x, content.y, content.w, h, 'F')
          }
          content.setFont(o.bold ? 'bold' : 'regular', size, o.color ?? TEXT)
          wrapped.forEach((lines, i) => {
            const cx = i === 0 ? x + 3 : x + widths[i] / 2
            lines.forEach((line, k) => doc.text(line, cx, content.y + 4 + size * 0.85 + k * size * 1.25, { align: i === 0 ? 'left' : 'center' }))
            x += widths[i]
          })
          content.y += h
          doc.setDrawColor(215, 222, 232)
          doc.setLineWidth(0.5)
          doc.line(content.x, content.y, content.x + content.w, content.y)
          pg.mark(content.page, content.y)
        }
        drawRow(['', L.understanding, L.speaking, L.writingGroup], { bold: true, fill: EU_BLUE, color: WHITE, size: 7.6, spans: [1, 2, 2, 1] })
        drawRow(['', ...CEFR_SKILLS.map((k) => L[k])], { fill: [232, 240, 250], color: [70, 70, 70], size: 7 })
        foreign.forEach((l) => drawRow([l.name, ...CEFR_SKILLS.map((k) => cefrFor(l, k))], { size: 8.4, color: INK }))
        content.gap(5)
        content.text(L.cefrNote, { size: 6.8, color: MUTED, lh: 9, keep: true })
      })
    }
  }
  if (ctx.digital.length) {
    section(L.digitalSkills)
    labeled('', () => content.text(ctx.digital.join(' · '), { size: 9, color: TEXT, lh: 13 }))
  }
  if (cv.skills.length) {
    section(L.skills)
    labeled('', () => content.bullets(cv.skills.map((s) => s.name), { size: 9, color: TEXT }))
  }
  if (ctx.extras.drivingLicence) {
    section(L.drivingLicence)
    labeled('', () => content.text(ctx.extras.drivingLicence!, { size: 9, color: TEXT }))
  }
  if (cv.certifications.length) {
    section(L.certifications)
    cv.certifications.forEach((c) =>
      labeled(c.date ? ctx.date(c.date) : '', () => {
        content.text(c.name, { size: 9, font: 'bold', color: INK })
        if (c.issuer) content.text(c.issuer, { size: 8.6, color: MUTED })
      }),
    )
  }
  if (ctx.interests.length) {
    section(L.interests)
    labeled('', () => content.text(ctx.interests.join(', '), { size: 9, color: TEXT }))
  }
  drawPrivacy(pg, ctx, m, A4_W - m * 2, 48)
}

// ─── Modelli Minimal, Classic e Sidebar ───────────────────────────────────

function drawClassicFamily(doc: jsPDF, ctx: Ctx, photo: string | null) {
  const { cv, L } = ctx
  const m = 44
  const sidebar = cv.template === 'sidebar'
  const sideW = 172
  const paint = () => {
    if (!sidebar) return
    doc.setFillColor(...INK)
    doc.rect(0, 0, sideW, A4_H, 'F')
  }
  paint()
  const pg = new Pager(doc, paint)

  const heading = (f: Flow, title: string) => {
    f.need(36)
    f.text(title, { size: 10, font: 'bold', color: GOLD, upper: true, cs: 0.8, lh: 13 })
    f.gap(6)
  }
  const skillDots = (f: Flow, s: CvSkill, light: boolean) => {
    f.need(14)
    f.setFont('regular', 8.8, light ? WHITE : INK)
    doc.text(s.name, f.x, f.y + 7, { maxWidth: f.w - 62 })
    for (let i = 0; i < 4; i++) {
      const cx = f.x + f.w - 52 + i * 14
      doc.setDrawColor(...(light ? WHITE : MUTED))
      doc.setFillColor(...GOLD)
      doc.setLineWidth(0.6)
      doc.circle(cx, f.y + 4, 3, i < s.level ? 'F' : 'S')
    }
    f.y += 15
    pg.mark(f.page, f.y)
  }
  const sideBlocks = (f: Flow, light: boolean) => {
    const text = light ? WHITE : INK
    const sub: RGB = light ? [210, 210, 210] : MUTED
    if (cv.skills.length) {
      heading(f, L.skills)
      cv.skills.forEach((s) => skillDots(f, s, light))
      f.gap(10)
    }
    if (cv.languages.length) {
      heading(f, L.languagesShort)
      cv.languages.forEach((l) => f.row(l.name, langLevel(l, L), { size: 8.8, color: text }, { size: 8.3, color: sub }))
      f.gap(10)
    }
    if (cv.certifications.length) {
      heading(f, L.certifications)
      cv.certifications.forEach((c) => {
        f.text(c.name, { size: 8.8, color: text })
        const s = certLine(c, ctx)
        if (s) f.text(s, { size: 7.8, color: sub })
        f.gap(4)
      })
      f.gap(8)
    }
    if (cv.links.length) {
      heading(f, L.links)
      cv.links.forEach((l) => f.fit(l.label || l.url, { size: 8.3, color: light ? WHITE : GOLD, url: l.url }))
      f.gap(10)
    }
    if (ctx.personal.length) {
      heading(f, L.personalShort)
      ctx.personal.forEach((p) => f.text(`${p.label}: ${p.value}`, { size: 8.5, color: text }))
      f.gap(10)
    }
    if (ctx.digital.length) {
      heading(f, L.digitalSkills)
      f.text(ctx.digital.join(' · '), { size: 8.5, color: text })
      f.gap(10)
    }
    if (ctx.interests.length) {
      heading(f, L.interests)
      f.text(ctx.interests.join(', '), { size: 8.5, color: text })
    }
  }
  const mainBlocks = (f: Flow) => {
    if (cv.summary) {
      f.text(cv.summary, { size: 9.2, color: TEXT, lh: 13 })
      f.gap(14)
    }
    if (ctx.experiences.length) {
      heading(f, L.experience)
      ctx.experiences.forEach((exp) => {
        f.need(36)
        f.row(exp.role, ctx.range(exp), { size: 10, font: 'bold', color: INK, lh: 13 }, { size: 8, color: MUTED })
        const where = [exp.company, exp.location].filter(Boolean).join(' · ')
        if (where) f.text(where, { size: 8.8, color: GOLD, lh: 12.5 })
        f.description(exp.description, { size: 8.8, color: TEXT, lh: 12.5 })
        f.gap(8)
      })
      f.gap(6)
    }
    if (ctx.education.length) {
      heading(f, L.educationShort)
      ctx.education.forEach((ed) => {
        f.need(30)
        f.row([ed.degree, ed.field].filter(Boolean).join(' — '), ctx.range(ed), { size: 10, font: 'bold', color: INK, lh: 13 }, { size: 8, color: MUTED })
        if (ed.institution) f.text(ed.institution, { size: 8.8, color: GOLD, lh: 12.5 })
        f.gap(8)
      })
      f.gap(6)
    }
  }

  if (sidebar) {
    const side = new Flow(pg, 26, sideW - 48, 1, 44, 40)
    if (photo && addImageSafe(doc, photo, 26, 44, 90, 90)) side.y = 44 + 90 + 16
    ;[cv.email, cv.phone, cv.location].filter(Boolean).forEach((c) => side.fit(c as string, { size: 8.6, color: WHITE, lh: 12 }))
    side.gap(14)
    sideBlocks(side, true)
    const main = new Flow(pg, sideW + 36, A4_W - sideW - 36 - m, 1, 44, 44)
    main.name(cv.full_name, { max: 21, font: 'bold', color: INK, oneLineMax: 22 })
    if (cv.role_title) main.text(cv.role_title, { size: 11.5, color: GOLD, lh: 16 })
    main.gap(12)
    mainBlocks(main)
    if (ctx.extras.privacyConsent === true) {
      main.gap(10)
      main.text(L.privacy, { size: 7, color: MUTED, lh: 9.5 })
    }
    return
  }

  const classic = cv.template === 'classic'
  const f = new Flow(pg, m, A4_W - m * 2, 1, 46, 46)
  if (classic) {
    if (photo) {
      addImageSafe(doc, photo, A4_W / 2 - 34, 36, 68, 68)
      f.y = 36 + 68 + 12
    }
    f.name(cv.full_name, { max: 22, font: 'bold', color: INK, align: 'center', oneLineMax: 40 })
    if (cv.role_title) f.text(cv.role_title, { size: 11.5, color: GOLD, align: 'center', lh: 16 })
    const contact = [cv.email, cv.phone, cv.location].filter(Boolean).join('   ·   ')
    if (contact) f.text(contact, { size: 8.5, color: MUTED, align: 'center' })
    f.gap(8)
    f.rule(GOLD, 0.8, f.w / 2 - 30, f.w / 2 + 30)
    f.gap(18)
  } else {
    const textW = photo ? f.w - 84 : f.w
    const head = new Flow(pg, m, textW, 1, 46, 46)
    head.name(cv.full_name, { max: 22, font: 'bold', color: INK, oneLineMax: 40 })
    if (cv.role_title) head.text(cv.role_title, { size: 11.5, color: GOLD, lh: 16 })
    const contact = [cv.email, cv.phone, cv.location].filter(Boolean).join('   ·   ')
    if (contact) head.text(contact, { size: 8.5, color: MUTED })
    if (photo) addImageSafe(doc, photo, A4_W - m - 68, 40, 68, 68)
    f.y = Math.max(head.y, photo ? 40 + 68 : 0) + 18
  }
  mainBlocks(f)
  sideBlocks(f, false)
  drawPrivacy(pg, ctx, m, A4_W - m * 2, 46)
}

/** Shared between the download button and the share/print flow. */
export function generateCvPdfBlob(params: {
  cv: CvForPdf
  photoDataUrl: string | null
  fonts: CvFonts
  publicUrl: string
  qrDataUrl: string | null
}): Blob {
  const { cv, photoDataUrl, fonts, publicUrl, qrDataUrl } = params
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  registerFonts(doc, fonts)
  doc.setProperties({ title: `${cv.full_name} – CV`, author: cv.full_name, subject: 'Curriculum vitae' })
  const ctx = makeCtx(cv)

  if (cv.template === 'moderno') drawModerno(doc, ctx, photoDataUrl)
  else if (cv.template === 'professionale') drawProfessionale(doc, ctx, photoDataUrl)
  else if (cv.template === 'elegante') drawElegante(doc, ctx, photoDataUrl, !!fonts.serif)
  else if (cv.template === 'europeo') drawEuropeo(doc, ctx, photoDataUrl)
  else drawClassicFamily(doc, ctx, photoDataUrl)

  const footerX = cv.template === 'professionale' ? 230 : cv.template === 'sidebar' ? 208 : 44
  drawFooters(doc, ctx.L, publicUrl, qrDataUrl, footerX, 44)
  return doc.output('blob')
}

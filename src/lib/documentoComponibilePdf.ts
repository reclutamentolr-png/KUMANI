// Documento componibile: PDF compilabile fatto nel browser (pdf-lib, caricato
// solo al clic). Le parti fisse (titoli, testi, immagini, spazio firma) sono
// disegnate sul foglio; le parti da compilare sono campi veri del PDF
// (AcroForm), che chi riceve il file compila con Adobe Reader, Anteprima del
// Mac, Chrome, Edge o dal telefono.
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { isField, pdfClean, pdfNeedsUnicode, winAnsiSupports, type DocBlock, type DocContent } from './documentoComponibile'

export type PdfLabels = {
  page: (n: number, total: number) => string // «Pagina 1 di 2»
  dateHint: string // «gg/mm/aaaa»
  signature: string // scritta sopra la firma se vuota
  fallbackTitle: string
}

const A4: [number, number] = [595.28, 841.89]
const M = 50 // margine
const W = A4[0] - M * 2
const BOTTOM = M + 30 // spazio per il piè di pagina
const INK = rgb(0.09, 0.09, 0.09)
const MUTED = rgb(0.42, 0.42, 0.42)
const LINE = rgb(0.78, 0.74, 0.66)
const FIELD_BG = rgb(0.98, 0.96, 0.9)
const GOLD = rgb(0.78, 0.6, 0.23)

// Quante lettere al massimo stanno (ricerca binaria: con Inter misurare il
// testo costa, e una parola di 3000 lettere senza spazi va spezzata in fretta)
function longestFit(s: string, fits: (n: number) => boolean): number {
  let lo = 1
  let hi = s.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (fits(mid)) lo = mid
    else hi = mid - 1
  }
  // Non si taglia a metà una coppia surrogata
  if (lo > 1 && lo < s.length) {
    const c = s.charCodeAt(lo - 1)
    if (c >= 0xd800 && c <= 0xdbff) lo--
  }
  return lo
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      out.push('')
      continue
    }
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= width) line = next
      else {
        if (line) out.push(line)
        // Parola più lunga della riga: si spezza
        let rest = word
        while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
          const i = longestFit(rest, (n) => font.widthOfTextAtSize(rest.slice(0, n), size) <= width)
          out.push(rest.slice(0, i))
          rest = rest.slice(i)
        }
        line = rest
      }
    }
    out.push(line)
  }
  return out
}

// Una riga sola: se non ci sta si accorcia con «…»
function fit(text: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text
  const n = longestFit(text, (k) => font.widthOfTextAtSize(`${text.slice(0, k)}…`, size) <= width)
  return `${text.slice(0, n).trimEnd()}…`
}

// Nome del campo nel PDF (lettere senza accenti, numeri e _; mai ripetuto)
function fieldName(label: string, used: Set<string>) {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'campo'
  let name = base
  let n = 2
  while (used.has(name)) name = `${base}_${n++}`
  used.add(name)
  return name
}

async function imageBytes(dataUrl: string): Promise<{ bytes: Uint8Array; png: boolean }> {
  const png = dataUrl.startsWith('data:image/png')
  const res = await fetch(dataUrl)
  return { bytes: new Uint8Array(await res.arrayBuffer()), png }
}

const textareaLines = (b: DocBlock) => Math.max(2, Math.min(12, b.lines || 4))

async function fontBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`font ${res.status}`)
  return res.arrayBuffer()
}

// Caratteri: Helvetica se il documento ha solo segni WinAnsi (PDF più leggero);
// altrimenti Inter (cirillico, Europa dell'Est). Il carattere dei campi si
// incorpora intero, così chi compila può scrivere anche lettere che nel
// documento non ci sono.
async function loadFonts(pdf: PDFDocument, doc: DocContent, labels: PdfLabels): Promise<{ font: PDFFont; bold: PDFFont; supports: (ch: string) => boolean }> {
  // Contano anche le scritte del sito (es. «Подпись» sotto una firma senza etichetta)
  const extra = [labels.page(1, 1), labels.dateHint, labels.signature]
  if (!pdfNeedsUnicode({ ...doc, footer: `${doc.footer} ${extra.join(' ')}` })) {
    return { font: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold), supports: winAnsiSupports }
  }
  const [{ default: fontkit }, regularBytes, boldBytes] = await Promise.all([
    import('@pdf-lib/fontkit'),
    fontBytes('/fonts/inter/Inter-Regular.ttf'),
    fontBytes('/fonts/inter/Inter-Bold.ttf'),
  ])
  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(regularBytes, { subset: false })
  // Anche il grassetto intero: con subset alcune lettere non si vedono
  const bold = await pdf.embedFont(boldBytes, { subset: false })
  // Solo i segni che ci sono in tutti e due i caratteri
  const inRegular = new Set(font.getCharacterSet())
  const inBold = new Set(bold.getCharacterSet())
  const supports = (ch: string) => {
    if (ch === '\n') return true
    const c = ch.codePointAt(0)!
    return inRegular.has(c) && inBold.has(c)
  }
  return { font, bold, supports }
}

export async function buildFillablePdf(doc: DocContent, labels: PdfLabels): Promise<Uint8Array> {
  const { blocks } = doc
  const pdf = await PDFDocument.create()
  pdf.setTitle(doc.title || labels.fallbackTitle)
  pdf.setCreator('KUMANI')
  pdf.setProducer('KUMANI')
  const { font, bold, supports } = await loadFonts(pdf, doc, labels)
  const clean = (s: string) => pdfClean(s, supports)
  const form = pdf.getForm()
  const used = new Set<string>()

  const pages: PDFPage[] = []
  let page = pdf.addPage(A4)
  pages.push(page)
  let y = A4[1] - M
  const newPage = () => {
    page = pdf.addPage(A4)
    pages.push(page)
    y = A4[1] - M
  }
  const ensure = (h: number) => {
    if (y - h < BOTTOM) newPage()
  }
  const text = (s: string, x: number, size: number, f: PDFFont, color = INK, width = W) => {
    for (const line of wrap(clean(s), f, size, width)) {
      ensure(size * 1.4)
      if (line) page.drawText(line, { x, y: y - size, size, font: f, color })
      y -= size * 1.4
    }
  }

  const hintOf = (b: DocBlock) => (b.type === 'date' ? b.hint || labels.dateHint : b.hint || '')
  const checkboxText = (b: DocBlock) => `${(b.text || '').trim() || (b.label || '').trim()}${b.required ? ' *' : ''}`
  const checkboxLines = (b: DocBlock, width: number) => wrap(clean(checkboxText(b)), font, 10, width - 22)
  const fieldHeight = (b: DocBlock, width: number) => {
    if (b.type === 'checkbox') return Math.max(18, checkboxLines(b, width).length * 13 + 4)
    const h = b.type === 'textarea' ? textareaLines(b) * 14 + 8 : 22
    return h + 14 + (hintOf(b) ? 11 : 0)
  }

  // Campo da compilare: etichetta sopra e riquadro. Restituisce dove finisce
  // (la y sotto il campo). Una casella con un testo molto lungo continua sul
  // foglio dopo (solo fuori dalle coppie «a metà», dove y si gestisce fuori).
  const field = (b: DocBlock, x: number, width: number, top: number, flow = false): number => {
    let cy = top
    const label = clean(b.label || '') + (b.required ? ' *' : '')
    if (b.type !== 'checkbox') {
      if (label.trim()) page.drawText(fit(label, bold, 9, width), { x, y: cy - 9, size: 9, font: bold, color: MUTED })
      cy -= 14
    }
    const name = fieldName(b.label || b.type, used)
    if (b.type === 'checkbox') {
      const cb = form.createCheckBox(name)
      cb.addToPage(page, { x, y: cy - 14, width: 14, height: 14, borderColor: LINE, borderWidth: 1, backgroundColor: FIELD_BG })
      if (b.checked) cb.check()
      if (b.required) cb.enableRequired()
      const lines = checkboxLines(b, width)
      let ly = cy // cima della riga
      let broke = false
      lines.forEach((line, i) => {
        if (i > 0) {
          ly -= 13
          if (flow && ly - 14 < BOTTOM) {
            newPage()
            ly = y
            broke = true
          }
        }
        if (line) page.drawText(line, { x: x + 22, y: ly - 11, size: 10, font, color: INK })
      })
      return broke ? ly - 17 : Math.min(cy - 18, ly - 17)
    }
    if (b.type === 'select') {
      const dd = form.createDropdown(name)
      const options = [...new Set((b.options || '').split('\n').map((o) => clean(o.trim())).filter(Boolean))]
      if (options.length) dd.addOptions(options)
      const value = clean(b.value || '')
      if (value && options.includes(value)) dd.select(value)
      if (b.required) dd.enableRequired()
      dd.addToPage(page, { x, y: cy - 22, width, height: 22, borderColor: LINE, borderWidth: 1, backgroundColor: FIELD_BG, font })
      dd.setFontSize(10)
      const hint = hintOf(b)
      if (hint) page.drawText(fit(clean(hint), font, 7.5, width), { x, y: cy - 22 - 10, size: 7.5, font, color: MUTED })
      return top - (22 + 14 + (hint ? 11 : 0))
    }
    const multi = b.type === 'textarea'
    const h = multi ? textareaLines(b) * 14 + 8 : 22
    const tf = form.createTextField(name)
    if (multi) tf.enableMultiline()
    const value = clean(multi ? b.value || '' : (b.value || '').replace(/\n+/g, ' '))
    if (value) tf.setText(value)
    if (b.required) tf.enableRequired()
    tf.addToPage(page, { x, y: cy - h, width, height: h, borderColor: LINE, borderWidth: 1, backgroundColor: FIELD_BG, font })
    tf.setFontSize(10)
    // Suggerimento sotto il riquadro (es. formato della data)
    const hint = hintOf(b)
    if (hint) page.drawText(fit(clean(hint), font, 7.5, width), { x, y: cy - h - 10, size: 7.5, font, color: MUTED })
    return top - (h + 14 + (hint ? 11 : 0))
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'title') {
      y -= 4
      text(b.text || '', M, 20, bold)
      ensure(8)
      page.drawRectangle({ x: M, y: y - 2, width: 40, height: 2.5, color: GOLD })
      y -= 14
    } else if (b.type === 'heading') {
      // Il sottotitolo non resta da solo in fondo al foglio
      ensure(60)
      y -= 6
      text((b.text || '').toUpperCase(), M, 11, bold, INK)
      y -= 4
    } else if (b.type === 'text') {
      text(b.text || '', M, 10.5, font, INK)
      y -= 8
    } else if (b.type === 'divider') {
      ensure(18)
      y -= 6
      page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: LINE })
      y -= 12
    } else if (b.type === 'image' && b.image) {
      try {
        const { bytes, png } = await imageBytes(b.image)
        const img = png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
        let width = (W * Math.max(15, Math.min(100, b.width || 40))) / 100
        let height = (img.height / img.width) * width
        // Immagine più alta del foglio: si riduce
        const maxH = A4[1] - M - BOTTOM - 12
        if (height > maxH) {
          width = (width * maxH) / height
          height = maxH
        }
        ensure(height + 12)
        const x = b.align === 'center' ? M + (W - width) / 2 : b.align === 'right' ? M + W - width : M
        page.drawImage(img, { x, y: y - height, width, height })
        y -= height + 12
      } catch {
        // immagine non leggibile: si salta
      }
    } else if (b.type === 'signature') {
      // Spazio firma: etichetta, riga a 4 cm circa per firmare, nota sotto
      ensure(70)
      const width = 220
      const sign = (s: DocBlock) => {
        const x = s.align === 'left' ? M : M + W - width
        page.drawText(fit(clean(s.label || labels.signature), bold, 9, width), { x, y: y - 9, size: 9, font: bold, color: MUTED })
        page.drawLine({ start: { x, y: y - 46 }, end: { x: x + width, y: y - 46 }, thickness: 0.8, color: INK })
        if (s.text) page.drawText(fit(clean(s.text), font, 8.5, width), { x, y: y - 58, size: 8.5, font, color: MUTED })
      }
      sign(b)
      // Due firme di fila, una a sinistra e una a destra: sulla stessa riga
      const next = blocks[i + 1]
      if (next?.type === 'signature' && (next.align === 'left') !== (b.align === 'left')) {
        sign(next)
        i++
      }
      y -= 70
    } else if (isField(b)) {
      // Due campi «a metà» di fila stanno sulla stessa riga
      const next = blocks[i + 1]
      const colW = (W - 14) / 2
      if (b.half && next && isField(next) && next.half) {
        const h = Math.max(fieldHeight(b, colW), fieldHeight(next, colW))
        ensure(h + 6)
        const top = y
        field(b, M, colW, top)
        field(next, M + colW + 14, colW, top)
        y -= h + 6
        i++
      } else {
        const width = b.half ? colW : W
        const h = fieldHeight(b, width)
        // Casella con un testo più lungo del foglio: continua sul foglio dopo
        ensure(Math.min(h + 6, A4[1] - M - BOTTOM))
        y = field(b, M, width, y, true) - 6
      }
    }
  }

  form.updateFieldAppearances(font)

  // Piè di pagina: testo scelto (o titolo) e numero di pagina
  pages.forEach((p, i) => {
    const num = labels.page(i + 1, pages.length)
    const numW = font.widthOfTextAtSize(clean(num), 8)
    p.drawText(clean(num), { x: M + W - numW, y: 28, size: 8, font, color: MUTED })
    const footer = clean((doc.footer || doc.title || '').replace(/\n+/g, ' '))
    if (footer.trim()) p.drawText(fit(footer, font, 8, W - numW - 20), { x: M, y: 28, size: 8, font, color: MUTED })
  })

  return pdf.save()
}

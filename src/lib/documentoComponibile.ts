// Documento componibile: blocchi del documento, limiti e controlli usati sia
// nel browser sia nel server (azioni in app/actions/documentoComponibile.ts).
// Le parti fisse (titoli, testi, immagini, spazio firma) vanno disegnate sul
// foglio; le parti da compilare diventano campi veri del PDF.

export type BlockType = 'title' | 'heading' | 'text' | 'image' | 'divider' | 'input' | 'textarea' | 'date' | 'checkbox' | 'select' | 'signature'
export type Align = 'left' | 'center' | 'right'

export type DocBlock = {
  id: string
  type: BlockType
  text?: string // titolo, testo fisso, testo accanto alla casella, nota sotto la firma
  label?: string // etichetta del campo o scritta sopra la firma
  value?: string // valore già scritto (si può cambiare)
  hint?: string // suggerimento sotto il campo
  options?: string // menu a scelta: una voce per riga
  lines?: number // righe del campo lungo
  required?: boolean
  checked?: boolean
  half?: boolean // mezza riga: due campi affiancati
  image?: string // data URL (JPEG o PNG)
  width?: number // immagine: larghezza in % del foglio
  align?: Align
}

export type DocContent = { title: string; footer: string; blocks: DocBlock[] }

export type ComposableDocRow = DocContent & { id: string; created_at: string; updated_at: string }
export type ComposableDocSummary = { id: string; title: string; field_count: number; updated_at: string }

export const FIXED_TYPES: BlockType[] = ['title', 'heading', 'text', 'image', 'divider', 'signature']
export const FIELD_TYPES: BlockType[] = ['input', 'textarea', 'date', 'checkbox', 'select']
const ALL_TYPES = new Set<BlockType>([...FIXED_TYPES, ...FIELD_TYPES])

export const isField = (b: Pick<DocBlock, 'type'>) => FIELD_TYPES.includes(b.type)
// Mezza riga: solo per i campi brevi (non per caselle e campi lunghi)
export const canBeHalf = (type: BlockType) => type === 'input' || type === 'date' || type === 'select'

// Stessi limiti nella migrazione 20270627100000_documento_componibile.sql
export const DOC_LIMITS = {
  title: 120,
  footer: 160,
  blocks: 150,
  images: 6,
  bytes: 2_500_000, // peso del documento salvato (immagini comprese)
  imageChars: 1_400_000, // una sola immagine
  heading: 300,
  text: 3000,
  label: 200,
  value: 1000,
  hint: 200,
  options: 2000,
  optionLines: 50,
} as const

export const uid = () => Math.random().toString(36).slice(2, 10)

// Taglio senza lasciare mezza emoji in fondo
const cut = (text: string, max: number) => text.slice(0, max).replace(/[\uD800-\uDBFF]$/, '')
const str = (v: unknown, max: number, multiline = false) => {
  if (typeof v !== 'string') return ''
  const s = v.replace(/\r\n?/g, '\n').split('\u0000').join('')
  return cut(multiline ? s : s.replace(/\n+/g, ' '), max)
}
const intIn = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.min(max, Math.max(min, n))
}
const IMAGE_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/
// Data URL PNG o JPEG, e i primi byte devono essere davvero di un PNG
// (iVBORw0KGgo = \x89PNG\r\n\x1a\n) o di un JPEG (/9j/ = FF D8 FF)
function isImageDataUrl(s: string): boolean {
  const m = IMAGE_RE.exec(s)
  if (!m) return false
  const data = s.slice(s.indexOf(',') + 1)
  return m[1] === 'png' ? data.startsWith('iVBORw0KGgo') : data.startsWith('/9j/')
}
const ID_RE = /^[a-z0-9]{1,16}$/

// Peso del documento come lo salva il database (byte del testo JSON)
export function docBytes(blocks: DocBlock[]): number {
  return new TextEncoder().encode(JSON.stringify(blocks)).length
}

export type BlocksError = 'tooManyBlocks' | 'tooManyImages' | 'tooBig' | 'badImage' | 'badBlocks'

// Pulizia dei blocchi: tipi ammessi, solo i dati che servono a ogni tipo,
// lunghezze e numeri nei limiti. Serve al server prima di salvare.
export function normalizeBlocks(input: unknown): { ok: true; blocks: DocBlock[] } | { ok: false; error: BlocksError } {
  if (!Array.isArray(input)) return { ok: false, error: 'badBlocks' }
  if (input.length > DOC_LIMITS.blocks) return { ok: false, error: 'tooManyBlocks' }
  const ids = new Set<string>()
  const out: DocBlock[] = []
  let images = 0
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'badBlocks' }
    const r = raw as Record<string, unknown>
    const type = r.type as BlockType
    if (!ALL_TYPES.has(type)) return { ok: false, error: 'badBlocks' }
    let id = typeof r.id === 'string' && ID_RE.test(r.id) ? r.id : uid()
    while (ids.has(id)) id = uid()
    ids.add(id)
    const b: DocBlock = { id, type }
    const align = r.align === 'center' || r.align === 'right' || r.align === 'left' ? r.align : undefined
    switch (type) {
      case 'title':
      case 'heading':
        b.text = str(r.text, DOC_LIMITS.heading)
        break
      case 'text':
        b.text = str(r.text, DOC_LIMITS.text, true)
        break
      case 'divider':
        break
      case 'image': {
        if (r.image !== undefined && r.image !== '') {
          if (typeof r.image !== 'string' || r.image.length > DOC_LIMITS.imageChars || !isImageDataUrl(r.image)) return { ok: false, error: 'badImage' }
          b.image = r.image
          images++
        }
        b.width = intIn(r.width, 15, 100, 40)
        b.align = align ?? 'left'
        break
      }
      case 'signature':
        b.label = str(r.label, DOC_LIMITS.label)
        b.text = str(r.text, DOC_LIMITS.label)
        b.align = align === 'left' ? 'left' : 'right'
        break
      default: {
        // Campi da compilare
        b.label = str(r.label, DOC_LIMITS.label)
        if (r.required === true) b.required = true
        if (type === 'checkbox') {
          b.text = str(r.text, DOC_LIMITS.text, true)
          if (r.checked === true) b.checked = true
          break
        }
        b.hint = str(r.hint, DOC_LIMITS.hint)
        if (type === 'select') {
          b.options = str(r.options, DOC_LIMITS.options, true)
            .split('\n')
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, DOC_LIMITS.optionLines)
            .join('\n')
          b.value = str(r.value, DOC_LIMITS.label).trim()
        } else {
          b.value = str(r.value, DOC_LIMITS.value, type === 'textarea')
        }
        if (type === 'textarea') b.lines = intIn(r.lines, 2, 12, 4)
        if (canBeHalf(type) && r.half === true) b.half = true
      }
    }
    out.push(b)
  }
  if (images > DOC_LIMITS.images) return { ok: false, error: 'tooManyImages' }
  if (docBytes(out) > DOC_LIMITS.bytes) return { ok: false, error: 'tooBig' }
  return { ok: true, blocks: out }
}

export const countFields = (blocks: DocBlock[]) => blocks.filter(isField).length
export const countImages = (blocks: DocBlock[]) => blocks.filter((b) => b.type === 'image' && b.image).length

// ---------------------------------------------------------------------------
// Caratteri del PDF: i caratteri standard (Helvetica) coprono l'italiano e le
// lingue dell'Europa occidentale (codifica WinAnsi). Se nel documento ci sono
// altri segni, il PDF usa il carattere Inter (public/fonts/inter), che copre
// anche il cirillico e le lettere dell'Europa dell'Est. Gli altri segni
// (emoji, greco, cinese…) nel PDF diventano «?».

const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
export function winAnsiSupports(ch: string): boolean {
  if (ch === '\n') return true
  const c = ch.codePointAt(0)!
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.includes(ch)
}
// Segni che il PDF sa scrivere (con Inter quando servono): Latino esteso,
// cirillico di base (russo, ucraino…), trattini e virgolette, «№»
export function pdfSupports(ch: string): boolean {
  if (winAnsiSupports(ch)) return true
  const c = ch.codePointAt(0)!
  return (c >= 0x100 && c <= 0x24f && c !== 0x149 && c !== 0x1c4) || (c >= 0x400 && c <= 0x45f) || (c >= 0x2010 && c <= 0x2027) || (c >= 0x2030 && c <= 0x203a) || c === 0x2116
}
// Il documento ha segni fuori da WinAnsi che Inter sa scrivere: serve Inter
// (per le sole emoji no: diventerebbero «?» comunque)
export function pdfNeedsUnicode(doc: DocContent): boolean {
  const all = [doc.title, doc.footer, ...doc.blocks.flatMap((b) => [b.text, b.label, b.value, b.hint, b.options])]
  return all.some((t) => !!t && [...t].some((ch) => !winAnsiSupports(ch) && pdfSupports(ch)))
}

// Testo pronto per il PDF: tabulazioni come spazi, segni mancanti come «?»
export function pdfClean(text: string, supports: (ch: string) => boolean = pdfSupports): string {
  return [...text.replace(/\t/g, ' ').replace(/\r/g, '')].map((ch) => (supports(ch) ? ch : '?')).join('')
}

export type PdfIssue = { where: 'title' | 'footer' | 'block'; index: number; type?: BlockType; text: string; replaced: string }

// Parti del documento con segni che il PDF non sa scrivere (da mostrare prima di scaricare)
export function pdfIssues(doc: DocContent): PdfIssue[] {
  const issues: PdfIssue[] = []
  const check = (text: string | undefined, where: PdfIssue['where'], index: number, type?: BlockType) => {
    if (!text) return
    const replaced = pdfClean(text)
    if (replaced !== text.replace(/\t/g, ' ').replace(/\r/g, '')) issues.push({ where, index, type, text, replaced })
  }
  check(doc.footer || doc.title, doc.footer ? 'footer' : 'title', -1)
  doc.blocks.forEach((b, i) => {
    for (const t of [b.text, b.label, b.value, b.hint, b.options]) check(t, 'block', i, b.type)
  })
  return issues
}

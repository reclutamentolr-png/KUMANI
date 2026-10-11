// FIRMA PDF: il documento si apre, si firma e si salva nel browser.
// Il file non viene mai caricato sui server. Firma, data e testo diventano
// immagini PNG ad alta risoluzione (qualsiasi alfabeto, nessun font da
// incorporare) e vengono disegnati nella pagina con pdf-lib.

export type FieldKind = 'signature' | 'date' | 'text'

// Posizione in frazioni della pagina come la si vede (0–1, origine in alto a sinistra)
export type PdfField = {
  id: string
  page: number
  kind: FieldKind
  x: number
  y: number
  w: number
  // altezza/larghezza dell'immagine: l'altezza segue sempre la larghezza
  ratio: number
  png: string
  // valori per poter modificare data e testo
  value?: string
  format?: DateFormat
}

export type DateFormat = 'numeric' | 'long'

export const PDF_MAX_BYTES = 30 * 1024 * 1024
export const PDF_MAX_PAGES = 200
export const SIGNATURE_UPLOAD_MAX = 5 * 1024 * 1024
export const TEXT_MAX = 200
export const SIGNATURE_STORAGE_KEY = 'kumani:firma-pdf:signature'

export const INK_COLORS = { black: '#111111', blue: '#1a3c8f' } as const
export type InkColor = keyof typeof INK_COLORS

export const newFieldId = () => Math.random().toString(36).slice(2, 10)

export function formatDate(iso: string, format: DateFormat, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  return format === 'long'
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
    : new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function todayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Ritaglia una tela sul tratto (pixel non trasparenti), con un piccolo margine
export function trimCanvas(source: HTMLCanvasElement, padding = 8): HTMLCanvasElement | null {
  const ctx = source.getContext('2d')
  if (!ctx) return null
  const { width, height } = source
  const data = ctx.getImageData(0, 0, width, height).data
  let top = height
  let left = width
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < 0) return null
  left = Math.max(0, left - padding)
  top = Math.max(0, top - padding)
  right = Math.min(width - 1, right + padding)
  bottom = Math.min(height - 1, bottom + padding)
  const out = document.createElement('canvas')
  out.width = right - left + 1
  out.height = bottom - top + 1
  out.getContext('2d')?.drawImage(source, left, top, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

// Testo (firma digitata, data o testo libero) → PNG trasparente
export async function textToPng(text: string, font: string, color: string, size = 96): Promise<{ png: string; ratio: number } | null> {
  const value = text.trim()
  if (!value) return null
  try {
    await document.fonts.load(`${size}px ${font}`, value)
  } catch {
    // si usa il carattere di riserva
  }
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.font = `${size}px ${font}`
  const width = Math.ceil(ctx.measureText(value).width) + size
  canvas.width = Math.min(width, 6000)
  canvas.height = Math.ceil(size * 1.8)
  ctx.font = `${size}px ${font}`
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(value, size / 2, canvas.height / 2)
  const trimmed = trimCanvas(canvas, Math.round(size * 0.12))
  if (!trimmed) return null
  return { png: trimmed.toDataURL('image/png'), ratio: trimmed.height / trimmed.width }
}

// Foto della firma su carta: lo sfondo chiaro diventa trasparente e l'inchiostro scuro resta
export async function imageToSignature(file: File): Promise<{ png: string; ratio: number } | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = image.data
    for (let i = 0; i < d.length; i += 4) {
      const light = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
      // chiaro → trasparente, con passaggio morbido per non avere bordi seghettati
      if (light > 200) d[i + 3] = 0
      else if (light > 150) d[i + 3] = Math.round(d[i + 3] * ((200 - light) / 50))
    }
    ctx.putImageData(image, 0, 0)
    const trimmed = trimCanvas(canvas)
    if (!trimmed) return null
    return { png: trimmed.toDataURL('image/png'), ratio: trimmed.height / trimmed.width }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Scrive i campi nel PDF e restituisce il nuovo file
export async function signPdf(bytes: ArrayBuffer, fields: PdfField[]): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib')
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const pages = doc.getPages()
  const images = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>()
  for (const field of fields) {
    const page = pages[field.page]
    if (!page) continue
    let image = images.get(field.png)
    if (!image) {
      image = await doc.embedPng(field.png)
      images.set(field.png, image)
    }
    const crop = page.getCropBox()
    const W = crop.width
    const H = crop.height
    const rotation = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270
    // Dimensioni della pagina come la si vede (ruotata)
    const displayW = rotation % 180 === 0 ? W : H
    const displayH = rotation % 180 === 0 ? H : W
    const bw = field.w * displayW
    const bh = bw * field.ratio
    const X = field.x * displayW
    // angolo in basso a sinistra del riquadro, come lo si vede
    const Yb = field.y * displayH + bh
    let x: number
    let y: number
    if (rotation === 90) {
      x = Yb
      y = X
    } else if (rotation === 180) {
      x = W - X
      y = Yb
    } else if (rotation === 270) {
      x = W - Yb
      y = H - X
    } else {
      x = X
      y = H - Yb
    }
    page.drawImage(image, { x: crop.x + x, y: crop.y + y, width: bw, height: bh, rotate: degrees(rotation) })
  }
  return doc.save()
}

// Funzioni di disegno per Documento Sicuro: tutto avviene nel browser.

export type Rect = { x: number; y: number; w: number; h: number } // valori 0..1 rispetto alla foto
export type WatermarkColor = 'dark' | 'light' | 'red'

export type Watermark = {
  text: string
  opacity: number // 0..1
  size: number // percentuale del lato corto
  color: WatermarkColor
}

const MAX_SIDE = 3000

const COLORS: Record<WatermarkColor, { fill: string; outline: string }> = {
  dark: { fill: '#111111', outline: 'rgba(255,255,255,0.55)' },
  light: { fill: '#ffffff', outline: 'rgba(0,0,0,0.55)' },
  red: { fill: '#d11a1a', outline: 'rgba(255,255,255,0.45)' },
}

// Decodifica la foto già girata nel verso giusto e ridotta a max 3000 px
export async function decodeImage(file: File): Promise<HTMLCanvasElement> {
  let source: ImageBitmap | HTMLImageElement
  let cleanup = () => {}
  try {
    if (typeof createImageBitmap !== 'function') throw new Error('no-bitmap')
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    source = bitmap
    cleanup = () => bitmap.close()
  } catch {
    // browser più vecchi: l'<img> applica comunque l'orientamento EXIF
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch (error) {
      URL.revokeObjectURL(url)
      throw error
    }
    source = img
    cleanup = () => URL.revokeObjectURL(url)
  }

  try {
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height
    if (!width || !height) throw new Error('empty')
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no-context')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    cleanup()
  }
}

// Disegna foto + zone oscurate + filigrana sul canvas visibile (che è anche quello esportato)
export function renderDocument(target: HTMLCanvasElement, base: HTMLCanvasElement, rects: Rect[], watermark: Watermark) {
  const { width, height } = base
  if (target.width !== width) target.width = width
  if (target.height !== height) target.height = height
  const ctx = target.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(base, 0, 0)

  ctx.fillStyle = '#000000'
  for (const rect of rects) ctx.fillRect(rect.x * width, rect.y * height, rect.w * width, rect.h * height)

  const text = watermark.text.trim()
  if (!text) return

  const fontSize = Math.max(10, (Math.min(width, height) * watermark.size) / 100)
  const colors = COLORS[watermark.color]
  ctx.save()
  ctx.globalAlpha = watermark.opacity
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, fontSize / 14)
  ctx.strokeStyle = colors.outline
  ctx.fillStyle = colors.fill
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 6)

  // il testo si ripete su righe sfalsate che coprono tutta la diagonale
  const diagonal = Math.hypot(width, height)
  const stepX = ctx.measureText(text).width + fontSize * 2
  const stepY = fontSize * 3
  let row = 0
  for (let y = -diagonal / 2; y <= diagonal / 2; y += stepY) {
    const shift = row % 2 ? stepX / 2 : 0
    for (let x = -diagonal / 2 - stepX + shift; x <= diagonal / 2; x += stepX) {
      ctx.strokeText(text, x, y)
      ctx.fillText(text, x, y)
    }
    row++
  }
  ctx.restore()
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('export'))), 'image/jpeg', 0.9)
  })
}

export function exportFileName(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `documento-protetto-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.jpg`
}

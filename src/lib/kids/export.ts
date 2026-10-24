// Angolo Bambini: il disegno diventa un'immagine (PNG) o un PDF da stampare,
// tutto nel telefono: niente viene caricato sul server di KUMANI.

const W = 1200
const H = 1320
const FOOT = 150

// Stile fisso per l'immagine (le animazioni non servono)
const STATIC_CSS = `
.f { stroke: #2B2D52; stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; }
.ink { fill: #2B2D52; } .hl { fill: #FFFFFF; }
.stroke { fill: none; stroke: #2B2D52; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
[data-role="zzz"] { display: none; }
`

// SVG da disegnare: le parti con il loro colore (bianco se vuoto o se si
// vuole il disegno da colorare a mano)
export function standaloneSvg(svgInner: string, fills: Record<string, string>, blank = false) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440">${svgInner}</svg>`, 'image/svg+xml')
  doc.querySelectorAll('[data-r]').forEach((el) => {
    const region = el.getAttribute('data-r') ?? ''
    el.setAttribute('fill', blank ? '#FFFFFF' : (fills[region] ?? '#FFFFFF'))
  })
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = STATIC_CSS
  doc.documentElement.insertBefore(style, doc.documentElement.firstChild)
  return new XMLSerializer().serializeToString(doc)
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

// Immagine del disegno con la firma del bambino sotto
export async function drawingPng(svg: string, caption: string, subcaption: string): Promise<Blob> {
  const img = await loadImage(svg)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H + FOOT
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, W, H)
  ctx.fillStyle = '#2B2D52'
  ctx.textAlign = 'center'
  ctx.font = '800 54px "Baloo 2", "Arial Rounded MT Bold", system-ui, sans-serif'
  ctx.fillText(caption, W / 2, H + 72, W - 80)
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.fillStyle = '#61648A'
  ctx.fillText(subcaption, W / 2, H + 120, W - 80)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'))
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

// PDF A4 da stampare (il disegno colorato, oppure quello da colorare a mano)
export async function drawingPdf(png: Blob): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 12
  const w = pageW - margin * 2
  const h = (w * (H + FOOT)) / W
  const y = Math.max(margin, (pageH - h) / 2)
  pdf.addImage(await blobToDataUrl(png), 'PNG', margin, y, w, Math.min(h, pageH - margin * 2), undefined, 'FAST')
  return pdf.output('blob')
}

// Salva o condivide un file: menu del telefono (WhatsApp, Foto, Stampa…) se
// c'è, altrimenti lo scarica
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text })
      return 'shared'
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

export const safeFileName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'disegno'

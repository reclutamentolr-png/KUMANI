// SCANNER E PDF: il foglio fotografato diventa una pagina dritta e pulita.
// Tutto nel browser, senza librerie esterne: bordi del foglio, raddrizzamento
// (prospettiva), luce uniforme e filtri. Le foto non lasciano il dispositivo.

export type Pt = { x: number; y: number }
// Angoli del foglio: alto-sinistra, alto-destra, basso-destra, basso-sinistra
export type Quad = [Pt, Pt, Pt, Pt]
export type ScanFilter = 'original' | 'color' | 'gray' | 'bw'
export const SCAN_FILTERS: ScanFilter[] = ['color', 'bw', 'gray', 'original']

// Lato lungo massimo della foto lavorata e della pagina finale (circa 250 dpi su A4)
export const SOURCE_MAX = 2600
export const PAGE_MAX = 2400

export const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

export async function loadImage(file: Blob, maxSide = SOURCE_MAX): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const c = canvasOf(bitmap.width * k, bitmap.height * k)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, c.width, c.height)
  bitmap.close()
  return c
}

export const fullQuad = (w: number, h: number): Quad => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
]

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

// Soglia di Otsu: separa i chiari (il foglio) dagli scuri (il tavolo)
function otsu(hist: number[], total: number) {
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 128
  for (let i = 0; i < 256; i++) {
    wB += hist[i]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += i * hist[i]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > best) {
      best = between
      threshold = i
    }
  }
  return threshold
}

// Bordi del foglio: la zona chiara più grande, i suoi 4 punti estremi.
// Funziona con un foglio chiaro su un piano più scuro; se non trova nulla di
// credibile restituisce null (si usa tutta la foto, l'utente sposta gli angoli).
export function detectQuad(source: HTMLCanvasElement): Quad | null {
  const k = 640 / Math.max(source.width, source.height)
  const w = Math.max(8, Math.round(source.width * k))
  const h = Math.max(8, Math.round(source.height * k))
  const small = canvasOf(w, h)
  const sctx = small.getContext('2d')!
  sctx.filter = 'blur(1px)'
  sctx.drawImage(source, 0, 0, w, h)
  sctx.filter = 'none'
  const px = sctx.getImageData(0, 0, w, h).data
  const gray = new Uint8Array(w * h)
  const hist = new Array(256).fill(0)
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2])
    gray[i] = v
    hist[v]++
  }
  const th = otsu(hist, w * h)
  // Zone chiare collegate (riempimento a pila)
  const label = new Int32Array(w * h).fill(-1)
  let bestArea = 0
  let bestLabel = -1
  let next = 0
  const stack: number[] = []
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || gray[start] <= th) continue
    let area = 0
    label[start] = next
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()!
      area++
      const x = i % w
      const y = (i - x) / w
      const visit = (j: number) => {
        if (label[j] !== -1 || gray[j] <= th) return
        label[j] = next
        stack.push(j)
      }
      if (x > 0) visit(i - 1)
      if (x < w - 1) visit(i + 1)
      if (y > 0) visit(i - w)
      if (y < h - 1) visit(i + w)
    }
    if (area > bestArea) {
      bestArea = area
      bestLabel = next
    }
    next++
  }
  // Un foglio occupa almeno il 15% della foto e non tutta (altrimenti non c'è un bordo da trovare)
  if (bestLabel < 0 || bestArea < w * h * 0.15 || bestArea > w * h * 0.97) return null
  let tl = { s: Infinity, x: 0, y: 0 }
  let br = { s: -Infinity, x: 0, y: 0 }
  let tr = { s: -Infinity, x: 0, y: 0 }
  let bl = { s: Infinity, x: 0, y: 0 }
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== bestLabel) continue
    const x = i % w
    const y = (i - x) / w
    if (x + y < tl.s) tl = { s: x + y, x, y }
    if (x + y > br.s) br = { s: x + y, x, y }
    if (x - y > tr.s) tr = { s: x - y, x, y }
    if (x - y < bl.s) bl = { s: x - y, x, y }
  }
  // Angoli un filo verso l'interno: meglio perdere un millimetro di foglio che lasciare un pezzo di tavolo
  const cx = (tl.x + tr.x + br.x + bl.x) / 4
  const cy = (tl.y + tr.y + br.y + bl.y) / 4
  const quad: Quad = [tl, tr, br, bl].map((p) => {
    const x = p.x + (cx - p.x) * 0.012
    const y = p.y + (cy - p.y) * 0.012
    return { x: Math.min(source.width, Math.max(0, (x + 0.5) / k)), y: Math.min(source.height, Math.max(0, (y + 0.5) / k)) }
  }) as Quad
  // Quadrilatero troppo stretto o storto: meglio lasciar fare all'utente
  const minSide = Math.min(dist(quad[0], quad[1]), dist(quad[1], quad[2]), dist(quad[2], quad[3]), dist(quad[3], quad[0]))
  if (minSide < Math.max(source.width, source.height) * 0.12) return null
  return quad
}

// Omografia che porta il rettangolo (0,0)-(w,h) sul quadrilatero della foto
function homography(w: number, h: number, q: Quad) {
  const src = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const { x: u, y: v } = q[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  // Eliminazione di Gauss
  for (let c = 0; c < 8; c++) {
    let piv = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r
    ;[A[c], A[piv]] = [A[piv], A[c]]
    ;[b[c], b[piv]] = [b[piv], b[c]]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]
      b[r] -= f * b[c]
    }
  }
  return b.map((v, i) => v / A[i][i])
}

// Foglio raddrizzato: misure dai lati del quadrilatero, lato lungo al massimo maxSide
export function warp(source: HTMLCanvasElement, q: Quad, maxSide = PAGE_MAX): HTMLCanvasElement {
  let w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]))
  let h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]))
  const k = Math.min(1.25, maxSide / Math.max(w, h))
  w = Math.max(16, Math.round(w * k))
  h = Math.max(16, Math.round(h * k))
  const H = homography(w, h, q)
  const sw = source.width
  const sh = source.height
  const sdata = source.getContext('2d')!.getImageData(0, 0, sw, sh).data
  const out = canvasOf(w, h)
  const octx = out.getContext('2d')!
  const img = octx.createImageData(w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    const yc = y + 0.5
    for (let x = 0; x < w; x++) {
      const xc = x + 0.5
      const z = H[6] * xc + H[7] * yc + 1
      let u = (H[0] * xc + H[1] * yc + H[2]) / z - 0.5
      let v = (H[3] * xc + H[4] * yc + H[5]) / z - 0.5
      u = Math.min(sw - 1.001, Math.max(0, u))
      v = Math.min(sh - 1.001, Math.max(0, v))
      const x0 = u | 0
      const y0 = v | 0
      const ax = u - x0
      const ay = v - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = i00 + 4
      const i01 = i00 + sw * 4
      const i11 = i01 + 4
      const o = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const top = sdata[i00 + c] * (1 - ax) + sdata[i10 + c] * ax
        const bot = sdata[i01 + c] * (1 - ax) + sdata[i11 + c] * ax
        d[o + c] = top * (1 - ay) + bot * ay
      }
      d[o + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  return out
}

// Luminosità del foglio punto per punto (senza la scritta): serve a togliere
// ombre e luce non uniforme, come fanno le app di scansione
function paperLight(gray: Float32Array, w: number, h: number) {
  const step = Math.max(8, Math.round(Math.max(w, h) / 64))
  const gw = Math.ceil(w / step)
  const gh = Math.ceil(h / step)
  const grid = new Float32Array(gw * gh)
  // In ogni cella il valore chiaro (90° percentile approssimato con il massimo dei campioni medi)
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      let max = 0
      for (let y = gy * step; y < Math.min(h, (gy + 1) * step); y += 2)
        for (let x = gx * step; x < Math.min(w, (gx + 1) * step); x += 2) {
          const v = gray[y * w + x]
          if (v > max) max = v
        }
      grid[gy * gw + gx] = max
    }
  // Ammorbidita con le celle vicine
  const soft = new Float32Array(gw * gh)
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      let s = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = gy + dy
          const xx = gx + dx
          if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue
          s += grid[yy * gw + xx]
          n++
        }
      soft[gy * gw + gx] = Math.max(40, s / n)
    }
  return (x: number, y: number) => {
    const fx = Math.min(gw - 1.001, Math.max(0, x / step - 0.5))
    const fy = Math.min(gh - 1.001, Math.max(0, y / step - 0.5))
    const x0 = fx | 0
    const y0 = fy | 0
    const ax = fx - x0
    const ay = fy - y0
    const a = soft[y0 * gw + x0] * (1 - ax) + soft[y0 * gw + Math.min(gw - 1, x0 + 1)] * ax
    const b = soft[Math.min(gh - 1, y0 + 1) * gw + x0] * (1 - ax) + soft[Math.min(gh - 1, y0 + 1) * gw + Math.min(gw - 1, x0 + 1)] * ax
    return a * (1 - ay) + b * ay
  }
}

export function applyFilter(page: HTMLCanvasElement, filter: ScanFilter): HTMLCanvasElement {
  const w = page.width
  const h = page.height
  const out = canvasOf(w, h)
  const ctx = out.getContext('2d')!
  ctx.drawImage(page, 0, 0)
  if (filter === 'original') return out
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
  const light = paperLight(gray, w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const gain = 248 / light(x, y)
      if (filter === 'color') {
        for (let c = 0; c < 3; c++) {
          const v = d[i * 4 + c] * gain
          // Un po' di contrasto: il bianco diventa bianco, i colori restano
          d[i * 4 + c] = Math.max(0, Math.min(255, (v - 128) * 1.12 + 128))
        }
        continue
      }
      const g = gray[i] * gain
      let v: number
      if (filter === 'gray') v = Math.max(0, Math.min(255, (g - 128) * 1.15 + 128))
      else {
        // Bianco e nero: rampa stretta per una scritta netta ma senza scalini
        const t = Math.min(1, Math.max(0, (g - 150) / 70))
        v = Math.round(255 * t * t * (3 - 2 * t))
      }
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v
    }
  ctx.putImageData(img, 0, 0)
  return out
}

export function rotate90(source: HTMLCanvasElement, turns: number): HTMLCanvasElement {
  const t = ((turns % 4) + 4) % 4
  if (!t) return source
  const out = canvasOf(t % 2 ? source.height : source.width, t % 2 ? source.width : source.height)
  const ctx = out.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((t * Math.PI) / 2)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  return out
}

export const toBlob = (c: HTMLCanvasElement, quality = 0.85) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', quality))

export function thumbnail(c: HTMLCanvasElement, maxSide = 360): string {
  const k = Math.min(1, maxSide / Math.max(c.width, c.height))
  const t = canvasOf(c.width * k, c.height * k)
  const ctx = t.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(c, 0, 0, t.width, t.height)
  return t.toDataURL('image/jpeg', 0.8)
}

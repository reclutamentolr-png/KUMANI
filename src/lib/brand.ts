// «I colori del tuo brand» (Scheda attività): quattro colori scelti
// (principale, accento, sfondo, testo) e quelli calcolati da qui (testo sul
// principale, colore dei QR). Calcoli semplici, tutti nel browser o sul
// server, senza librerie: contrasto WCAG, correzione della leggibilità,
// abbinamenti e colori presi dal logo.

export const BRAND_ROLES = ['primary', 'accent', 'background', 'text'] as const
export type BrandRole = (typeof BRAND_ROLES)[number]
export type BrandPalette = Record<BrandRole, string>
export type BrandColors = BrandPalette & { onPrimary: string; qr: string }

export const BRAND_SERVICES = ['landing', 'quotes', 'qr', 'bio', 'email'] as const
export type BrandService = (typeof BRAND_SERVICES)[number]
export type BrandFollow = Partial<Record<BrandService, boolean>>
// Servizi che avranno i colori più avanti (mostrati come «In arrivo»)
export const BRAND_SERVICES_SOON = ['shop', 'menu'] as const

export const DEFAULT_PALETTE: BrandPalette = { primary: '#171717', accent: '#c79a3b', background: '#f4f1e8', text: '#171717' }

const HEX = /^#[0-9a-f]{6}$/i
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

export function cleanPalette(p: unknown): BrandPalette | null {
  if (!p || typeof p !== 'object') return null
  const o = p as Record<string, unknown>
  if (!BRAND_ROLES.every((r) => isHex(o[r]))) return null
  return Object.fromEntries(BRAND_ROLES.map((r) => [r, String(o[r]).toLowerCase()])) as BrandPalette
}

// ——— Contrasto ———

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// Testo leggibile sopra un colore: bianco o quasi nero
export function readableOn(bg: string): string {
  return contrast('#ffffff', bg) >= contrast('#171717', bg) ? '#ffffff' : '#171717'
}

function toHex(rgb: number[]): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

// Scurisce (f < 0) o schiarisce (f > 0) mantenendo la tinta
export function shade(hex: string, f: number): string {
  const target = f < 0 ? 0 : 255
  const k = Math.abs(f)
  return toHex(channels(hex).map((v) => v + (target - v) * k))
}

// La sfumatura più vicina che arriva al contrasto richiesto contro `against`
export function fixContrast(hex: string, against: string, min = 4.5): string {
  if (contrast(hex, against) >= min) return hex.toLowerCase()
  const darker = luminance(against) > 0.18
  for (let k = 0.03; k <= 1.0001; k += 0.03) {
    const next = shade(hex, darker ? -k : k)
    if (contrast(next, against) >= min) return next
  }
  return darker ? '#000000' : '#ffffff'
}

// Colore dei QR: scuro e molto contrastato sul bianco (si legge sempre)
export function qrColor(p: BrandPalette): string {
  const candidates = [p.primary, p.text, p.accent].sort((a, b) => contrast(b, '#ffffff') - contrast(a, '#ffffff'))
  return fixContrast(candidates[0], '#ffffff', 7)
}

export function brandColors(p: BrandPalette): BrandColors {
  return { ...p, onPrimary: readableOn(p.primary), qr: qrColor(p) }
}

// Coppie da controllare (testo sopra sfondo) e cosa correggere
export type ContrastPair = { id: string; fg: string; bg: string; ratio: number; ok: boolean; fixRole: BrandRole; against: string }
export function contrastPairs(p: BrandPalette): ContrastPair[] {
  const on = readableOn(p.primary)
  const defs: Omit<ContrastPair, 'ratio' | 'ok'>[] = [
    { id: 'textOnBackground', fg: p.text, bg: p.background, fixRole: 'text', against: p.background },
    { id: 'onPrimary', fg: on, bg: p.primary, fixRole: 'primary', against: on },
    { id: 'primaryOnBackground', fg: p.primary, bg: p.background, fixRole: 'primary', against: p.background },
    { id: 'accentOnBackground', fg: p.accent, bg: p.background, fixRole: 'accent', against: p.background },
  ]
  // L'accento è decorativo: basta 3:1 (testi grandi e icone)
  return defs.map((d) => {
    const ratio = contrast(d.fg, d.bg)
    return { ...d, ratio, ok: ratio >= (d.id === 'accentOnBackground' ? 3 : 4.5) }
  })
}

// ——— Abbinamenti (generatore) ———

function hsl(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255])
}

export function hueOf(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (!d) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round(h * 60 + 360) % 360
}

export const HARMONIES = ['contrast', 'warm', 'lively'] as const
export type Harmony = (typeof HARMONIES)[number]

// Proposta completa a partire da una tinta: già leggibile
export function harmonyPalette(baseHue: number, harmony: Harmony): { palette: BrandPalette; swatches: string[] } {
  const shift = harmony === 'contrast' ? 180 : harmony === 'warm' ? 35 : 120
  const h2 = (baseHue + shift) % 360
  const h3 = (baseHue + (harmony === 'lively' ? 240 : harmony === 'warm' ? -25 + 360 : 30)) % 360
  const primary = hsl(baseHue, 55, 32)
  const accent = hsl(h2, 70, 55)
  const background = hsl(baseHue, 35, 96)
  const text = hsl(baseHue, 15, 15)
  const palette = { primary, accent: fixContrast(accent, background, 3), background, text: fixContrast(text, background) }
  const swatches = [primary, accent, background, text, hsl(h3, 55, 45), hsl(h2, 45, 85), hsl(baseHue, 60, 50), hsl(h3, 30, 25)]
  return { palette, swatches }
}

// ——— Colori dal logo (nel browser: il logo non viene caricato da nessuna parte) ———

export async function colorsFromImage(url: string, count = 6): Promise<string[]> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  const size = 64
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight))
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const pixels: number[][] = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue // trasparente
    pixels.push([data[i], data[i + 1], data[i + 2]])
  }
  if (!pixels.length) return []
  // k-means semplice, partenza distribuita sulla luminosità
  const k = Math.min(count, pixels.length)
  const sorted = [...pixels].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / k)])
  let groups: number[][][] = []
  for (let iter = 0; iter < 8; iter++) {
    groups = centers.map(() => [])
    for (const p of pixels) {
      let best = 0
      let bestD = Infinity
      centers.forEach((c, i) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
        if (d < bestD) {
          bestD = d
          best = i
        }
      })
      groups[best].push(p)
    }
    centers = groups.map((g, i) => (g.length ? [0, 1, 2].map((c) => g.reduce((s, p) => s + p[c], 0) / g.length) : centers[i]))
  }
  // Ordinati per quanto compaiono; doppioni quasi uguali tolti
  const ranked = centers.map((c, i) => ({ hex: toHex(c), n: groups[i].length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)
  const out: string[] = []
  for (const { hex } of ranked) if (!out.some((o) => contrast(o, hex) < 1.15)) out.push(hex)
  return out
}

// Proposta di ruoli dai colori del logo: il più saturo e scuro come principale
export function paletteFromSwatches(swatches: string[]): BrandPalette {
  if (!swatches.length) return { ...DEFAULT_PALETTE }
  const sat = (hex: string) => {
    const [r, g, b] = channels(hex)
    return Math.max(r, g, b) - Math.min(r, g, b)
  }
  const byInk = [...swatches].sort((a, b) => contrast(b, '#ffffff') - contrast(a, '#ffffff'))
  const colorful = [...swatches].sort((a, b) => sat(b) - sat(a))
  const primary = colorful.find((c) => contrast(c, '#ffffff') >= 3) ?? byInk[0]
  const accent = colorful.find((c) => c !== primary) ?? primary
  const background = '#ffffff'
  const text = fixContrast(byInk[0] === primary ? '#1f1f1f' : byInk[0], background)
  return { primary, accent: fixContrast(accent, background, 3), background, text }
}

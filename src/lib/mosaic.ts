// KUMANI Mosaic: tipi e tavolozza condivisi fra server e browser.

// 32 colori fissi (l'indice è quello salvato nel database, 0..31).
// Includono il nero, l'oro e l'indaco di KUMANI.
export const MOSAIC_PALETTE = [
  '#FFFFFF', '#D4D4D4', '#8A8A8A', '#4A4A4A', '#171717', '#6D001A', '#BE0039', '#FF4500',
  '#FFA800', '#FFD635', '#C79A3B', '#E7C56A', '#00A368', '#00CC78', '#7EED56', '#00756F',
  '#009EAA', '#00CCC0', '#2450A4', '#3690EA', '#51E9F4', '#312E81', '#493AC1', '#6A5CFF',
  '#811E9F', '#B44AC0', '#E4ABFF', '#DE107F', '#FF3881', '#FF99AA', '#6D482F', '#9C6926',
] as const

// Riconoscimenti di una stagione: prima tessera nelle prime 24 ore, tessera
// che completa la tela, almeno MOSAICIST_TILES tessere
export type MosaicBadges = { cofounder: boolean; last_tile: boolean; mosaicist: boolean }
export const MOSAIC_BADGES = ['cofounder', 'last_tile', 'mosaicist'] as const
export const MOSAICIST_TILES = 50

export type MosaicSeason = {
  id: string
  title: string
  theme: string | null
  width: number
  height: number
  starts_at: string
  ends_at: string
  filled: number
  contributors: number
  mine: number
  badges: MosaicBadges
  zones?: MosaicZone[]
  template?: string | null
}

export type MosaicArchiveSeason = MosaicSeason & { canvas: string | null }

// Zona protetta: solo lo Staff ci piazza tessere
export type MosaicZone = { id?: string; x: number; y: number; w: number; h: number; label: string | null }

export const MOSAIC_REPORT_REASONS = ['offensive', 'advertising', 'other'] as const
export type MosaicReportReason = (typeof MOSAIC_REPORT_REASONS)[number]

export const inZone = (zones: MosaicZone[], x: number, y: number) => zones.some((z) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h)

export type MosaicAllowance = { base: number; bonus: number; bonus_available: number; used: number; left: number }

export type MosaicStatus = {
  online: boolean
  season: MosaicSeason | null
  canvas: string | null
  next_season: { title: string; starts_at: string } | null
  has_archive: boolean
  login_days: number
  min_login_days: number
  blocked: boolean
  eligible: boolean
  allowance: MosaicAllowance
}

// Il base64 di Postgres va a capo ogni 76 caratteri: si tolgono gli spazi
const fromBase64 = (base64: string) => atob(base64.replace(/\s/g, ''))

// Tela dal database: un byte per casella (0 = vuota, 1..32 = colore + 1)
export function decodeCanvas(base64: string | null, size: number): Uint8Array {
  const cells = new Uint8Array(size)
  if (!base64) return cells
  const binary = fromBase64(base64)
  for (let i = 0; i < Math.min(size, binary.length); i++) cells[i] = binary.charCodeAt(i)
  return cells
}

// Storia dell'opera (timelapse): tessere in ordine di piazzamento
export type MosaicTile = { x: number; y: number; color: number; mine: boolean }
export function decodeTimeline(base64: string | null): MosaicTile[] {
  if (!base64) return []
  const binary = fromBase64(base64)
  const tiles: MosaicTile[] = []
  for (let i = 0; i + 2 < binary.length; i += 3) {
    const c = binary.charCodeAt(i + 2)
    tiles.push({ x: binary.charCodeAt(i), y: binary.charCodeAt(i + 1), color: c & 31, mine: c >= 128 })
  }
  return tiles
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const MOSAIC_LUT = MOSAIC_PALETTE.map(hexToRgb)
export const MOSAIC_EMPTY_RGB: [number, number, number] = [239, 234, 224] // casella libera (beige chiaro)

// Colore di una casella: la tessera, oppure (se vuota) la sagoma guida
// appena accennata sul fondo
export function cellRgb(value: number, guide = 0, empty = MOSAIC_EMPTY_RGB): [number, number, number] {
  if (value) return MOSAIC_LUT[value - 1]
  if (!guide) return empty
  const tint = MOSAIC_LUT[guide - 1]
  return [0, 1, 2].map((k) => Math.round(empty[k] * 0.7 + tint[k] * 0.3)) as [number, number, number]
}

// Disegna la tela su un canvas grande una casella per pixel
export function paintCells(
  ctx: CanvasRenderingContext2D,
  cells: Uint8Array,
  width: number,
  height: number,
  empty = MOSAIC_EMPTY_RGB,
  guide: Uint8Array | null = null,
) {
  const img = ctx.createImageData(width, height)
  cells.forEach((value, i) => {
    const [r, g, b] = cellRgb(value, guide?.[i] ?? 0, empty)
    img.data.set([r, g, b, 255], i * 4)
  })
  ctx.putImageData(img, 0, 0)
}

// Immagine caricata dallo Staff → sagoma della tela: ridotta alla dimensione
// della stagione e portata al colore più vicino della tavolozza (0 = trasparente)
export function imageToTemplate(image: CanvasImageSource, width: number, height: number): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const out = new Uint8Array(width * height)
  if (!ctx) return out
  ctx.drawImage(image, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  for (let i = 0; i < out.length; i++) {
    if (data[i * 4 + 3] < 128) continue
    let best = 0
    let bestDist = Infinity
    MOSAIC_LUT.forEach(([r, g, b], index) => {
      const dist = (r - data[i * 4]) ** 2 + (g - data[i * 4 + 1]) ** 2 + (b - data[i * 4 + 2]) ** 2
      if (dist < bestDist) {
        bestDist = dist
        best = index
      }
    })
    out[i] = best + 1
  }
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

// Secondi alla prossima mezzanotte italiana (quando tornano le tessere),
// giusti anche nei giorni del cambio dell'ora
export function secondsToRomeMidnight(now = new Date()): number {
  const romeDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(now) // AAAA-MM-GG
  const next = new Date(`${romeDate}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const offset =
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'longOffset' })
      .formatToParts(next)
      .find((part) => part.type === 'timeZoneName')
      ?.value.replace('GMT', '') || '+00:00'
  const midnight = new Date(`${next.toISOString().slice(0, 10)}T00:00:00${offset}`)
  return Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 1000))
}

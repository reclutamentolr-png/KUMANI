// KUMANI Mosaic: tipi e tavolozza condivisi fra server e browser.

// 32 colori fissi (l'indice è quello salvato nel database, 0..31).
// Includono il nero, l'oro e l'indaco di KUMANI.
export const MOSAIC_PALETTE = [
  '#FFFFFF', '#D4D4D4', '#8A8A8A', '#4A4A4A', '#171717', '#6D001A', '#BE0039', '#FF4500',
  '#FFA800', '#FFD635', '#C79A3B', '#E7C56A', '#00A368', '#00CC78', '#7EED56', '#00756F',
  '#009EAA', '#00CCC0', '#2450A4', '#3690EA', '#51E9F4', '#312E81', '#493AC1', '#6A5CFF',
  '#811E9F', '#B44AC0', '#E4ABFF', '#DE107F', '#FF3881', '#FF99AA', '#6D482F', '#9C6926',
] as const

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
}

export type MosaicAllowance = { base: number; bonus: number; bonus_available: number; used: number; left: number }

export type MosaicStatus = {
  online: boolean
  season: MosaicSeason | null
  canvas: string | null
  next_season: { title: string; starts_at: string } | null
  login_days: number
  min_login_days: number
  blocked: boolean
  eligible: boolean
  allowance: MosaicAllowance
}

// Tela dal database: un byte per casella (0 = vuota, 1..32 = colore + 1)
export function decodeCanvas(base64: string | null, size: number): Uint8Array {
  const cells = new Uint8Array(size)
  if (!base64) return cells
  const binary = atob(base64)
  for (let i = 0; i < Math.min(size, binary.length); i++) cells[i] = binary.charCodeAt(i)
  return cells
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Secondi alla prossima mezzanotte italiana (quando tornano le tessere)
export function secondsToRomeMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(now)
    .reduce<Record<string, number>>((acc, part) => (part.type === 'literal' ? acc : { ...acc, [part.type]: Number(part.value) }), {})
  return 86400 - ((parts.hour ?? 0) * 3600 + (parts.minute ?? 0) * 60 + (parts.second ?? 0))
}

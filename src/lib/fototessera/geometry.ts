// FOTOTESSERA: misure e conti, senza browser (provabili da soli).
// Formato italiano ed europeo per carta d'identità, passaporto, patente e
// permesso di soggiorno: 35×45 mm, testa (dal mento alla sommità del capo)
// tra 32 e 36 mm, sfondo chiaro e uniforme.

export const PHOTO_MM = { w: 35, h: 45 }
export const HEAD_MM = { min: 32, max: 36, target: 34 }
// Spazio sopra la testa con la testa a 34 mm (resta uguale anche con lo zoom)
export const TOP_MM = 5

// Foto da scaricare: 600 punti per pollice (35×45 mm = 827×1063 px)
export const PHOTO_DPI = 600
export const PHOTO_PX_PER_MM = PHOTO_DPI / 25.4
export const PHOTO_PX = { w: Math.round(PHOTO_MM.w * PHOTO_PX_PER_MM), h: Math.round(PHOTO_MM.h * PHOTO_PX_PER_MM) }

// Foglio 10×15 cm (proporzione 3:2 esatta, così la stampa non lo ritaglia):
// 12 px per mm, 6 foto in 3 colonne e 2 righe
export const SHEET = { w: 1800, h: 1200, pxPerMm: 12, cols: 3, rows: 2 }

export type Point = { x: number; y: number }

// Punti del viso nella foto di partenza (in pixel)
export type FacePoints = {
  eyeL: Point
  eyeR: Point
  chin: Point
  forehead: Point
  nose: Point
  // Sommità del capo (capelli compresi), dalla sagoma della persona
  crown: Point
}

// Come la foto di partenza entra nella fototessera
export type Fit = {
  pivot: Point // punto tra gli occhi, nella foto di partenza
  angle: number // inclinazione degli occhi in radianti (si raddrizza ruotando di -angle)
  scale: number // px della fototessera (a 1 px per mm) per px della foto con la testa a 34 mm
  crownAbove: number // distanza pivot → sommità del capo, in px della foto, già raddrizzata
  headLen: number // altezza della testa in px della foto (mento → sommità)
}

// Ritocchi dell'utente: dimensione della testa in mm e spostamenti in mm
export type Adjust = { headMm: number; dxMm: number; dyMm: number; turnDeg: number }
export const DEFAULT_ADJUST: Adjust = { headMm: HEAD_MM.target, dxMm: 0, dyMm: 0, turnDeg: 0 }

const rotate = (p: Point, c: Point, a: number): Point => {
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const x = p.x - c.x
  const y = p.y - c.y
  return { x: c.x + x * cos - y * sin, y: c.y + x * sin + y * cos }
}

export function fitFace(face: FacePoints): Fit {
  const pivot = { x: (face.eyeL.x + face.eyeR.x) / 2, y: (face.eyeL.y + face.eyeR.y) / 2 }
  // L'occhio a sinistra nella foto è quello con la x minore
  const [a, b] = face.eyeL.x <= face.eyeR.x ? [face.eyeL, face.eyeR] : [face.eyeR, face.eyeL]
  const angle = Math.atan2(b.y - a.y, b.x - a.x)
  const chin = rotate(face.chin, pivot, -angle)
  const crown = rotate(face.crown, pivot, -angle)
  const headLen = Math.max(1, chin.y - crown.y)
  return { pivot, angle, scale: 1 / headLen, crownAbove: pivot.y - crown.y, headLen }
}

// Trasformazione da foto di partenza a fototessera di pxPerMm pixel per mm:
// la sommità del capo resta a TOP_MM dal bordo alto qualunque sia la testa
export function placement(fit: Fit, adj: Adjust, pxPerMm: number) {
  const headPx = adj.headMm * pxPerMm
  const scale = headPx * fit.scale
  const angle = -fit.angle + (adj.turnDeg * Math.PI) / 180
  const x = (PHOTO_MM.w / 2 + adj.dxMm) * pxPerMm
  const y = (TOP_MM + adj.dyMm) * pxPerMm + fit.crownAbove * scale
  return { scale, angle, x, y, pivot: fit.pivot }
}

// Dove finiscono sommità e mento nella fototessera (mm dal bordo alto)
export const headLines = (adj: Adjust) => ({ crown: TOP_MM + adj.dyMm, chin: TOP_MM + adj.dyMm + adj.headMm })

// Posizioni delle 6 foto nel foglio 10×15
export function sheetSlots() {
  const w = PHOTO_MM.w * SHEET.pxPerMm
  const h = PHOTO_MM.h * SHEET.pxPerMm
  const gx = (SHEET.w - SHEET.cols * w) / (SHEET.cols + 1)
  const gy = (SHEET.h - SHEET.rows * h) / (SHEET.rows + 1)
  const slots: { x: number; y: number; w: number; h: number }[] = []
  for (let r = 0; r < SHEET.rows; r++) for (let c = 0; c < SHEET.cols; c++) slots.push({ x: Math.round(gx + c * (w + gx)), y: Math.round(gy + r * (h + gy)), w, h })
  return slots
}

// Il JPEG del browser dice 72 dpi: qui si scrive quello vero (intestazione JFIF),
// così stampando «a dimensione reale» la foto esce di 35×45 mm
export function setJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  const isJfif = bytes[2] === 0xff && bytes[3] === 0xe0 && bytes[6] === 0x4a && bytes[7] === 0x46 && bytes[8] === 0x49 && bytes[9] === 0x46
  if (!isJfif) return bytes
  const out = bytes.slice()
  out[13] = 1 // unità: punti per pollice
  out[14] = dpi >> 8
  out[15] = dpi & 0xff
  out[16] = dpi >> 8
  out[17] = dpi & 0xff
  return out
}

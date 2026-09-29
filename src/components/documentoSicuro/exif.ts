// Lettore EXIF minimo per JPEG, solo per avvisare l'utente di cosa c'è di
// nascosto nella foto (posizione GPS, telefono, data). Non serve a copiare
// i dati: la copia scaricata passa da un canvas e li perde tutti.

export type ExifSummary = {
  hasGps: boolean
  latitude: number | null
  longitude: number | null
  make: string | null
  model: string | null
  dateTime: string | null
}

const EMPTY: ExifSummary = { hasGps: false, latitude: null, longitude: null, make: null, model: null, dateTime: null }

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

type Entry = { tag: number; type: number; count: number; valueOffset: number }

export function parseExif(buffer: ArrayBuffer): ExifSummary {
  try {
    return parse(new DataView(buffer))
  } catch {
    // file rovinato o formato inatteso: nessun dato da mostrare
    return EMPTY
  }
}

function parse(view: DataView): ExifSummary {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return EMPTY
  let offset = 2
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return EMPTY
    const marker = view.getUint8(offset + 1)
    // inizio dell'immagine vera e propria: niente EXIF oltre
    if (marker === 0xda || marker === 0xd9) return EMPTY
    const length = view.getUint16(offset + 2)
    if (marker === 0xe1 && offset + 10 <= view.byteLength && readAscii(view, offset + 4, 4) === 'Exif') {
      return readTiff(view, offset + 10, Math.min(view.byteLength, offset + 2 + length))
    }
    offset += 2 + length
  }
  return EMPTY
}

function readTiff(view: DataView, start: number, end: number): ExifSummary {
  const order = view.getUint16(start)
  if (order !== 0x4949 && order !== 0x4d4d) return EMPTY
  const little = order === 0x4949
  const u16 = (at: number) => view.getUint16(at, little)
  const u32 = (at: number) => view.getUint32(at, little)
  const inRange = (at: number, size: number) => at >= start && at + size <= end

  const readIfd = (relative: number): Entry[] => {
    const at = start + relative
    if (!inRange(at, 2)) return []
    const count = u16(at)
    const entries: Entry[] = []
    for (let i = 0; i < count; i++) {
      const entryAt = at + 2 + i * 12
      if (!inRange(entryAt, 12)) break
      entries.push({ tag: u16(entryAt), type: u16(entryAt + 2), count: u32(entryAt + 4), valueOffset: entryAt + 8 })
    }
    return entries
  }

  // i valori oltre 4 byte stanno altrove, puntati dall'offset
  const dataAt = (entry: Entry) => {
    const size = (TYPE_SIZES[entry.type] ?? 1) * entry.count
    return size <= 4 ? entry.valueOffset : start + u32(entry.valueOffset)
  }

  const ascii = (entry: Entry | undefined): string | null => {
    if (!entry || entry.type !== 2) return null
    const at = dataAt(entry)
    if (!inRange(at, entry.count)) return null
    const text = readAscii(view, at, entry.count).replace(/\0+$/, '').trim()
    return text || null
  }

  const rationals = (entry: Entry | undefined): number[] | null => {
    if (!entry || entry.type !== 5 || entry.count < 3) return null
    const at = dataAt(entry)
    if (!inRange(at, 24)) return null
    const values: number[] = []
    for (let i = 0; i < 3; i++) {
      const den = u32(at + i * 8 + 4)
      values.push(den ? u32(at + i * 8) / den : 0)
    }
    return values
  }

  const pointer = (entry: Entry | undefined) => (entry ? u32(entry.valueOffset) : null)

  const ifd0 = readIfd(u32(start + 4))
  const find = (entries: Entry[], tag: number) => entries.find((entry) => entry.tag === tag)

  const make = ascii(find(ifd0, 0x010f))
  const model = ascii(find(ifd0, 0x0110))
  let dateTime = ascii(find(ifd0, 0x0132))

  const exifPointer = pointer(find(ifd0, 0x8769))
  if (exifPointer !== null) {
    const original = ascii(find(readIfd(exifPointer), 0x9003))
    if (original) dateTime = original
  }

  let hasGps = false
  let latitude: number | null = null
  let longitude: number | null = null
  const gpsPointer = pointer(find(ifd0, 0x8825))
  if (gpsPointer !== null) {
    const gps = readIfd(gpsPointer)
    const lat = rationals(find(gps, 0x0002))
    const lon = rationals(find(gps, 0x0004))
    // alcuni telefoni scrivono il blocco GPS vuoto: conta solo se ci sono coordinate
    if (lat && lon) {
      const toDegrees = (parts: number[]) => parts[0] + parts[1] / 60 + parts[2] / 3600
      latitude = toDegrees(lat) * (ascii(find(gps, 0x0001)) === 'S' ? -1 : 1)
      longitude = toDegrees(lon) * (ascii(find(gps, 0x0003)) === 'W' ? -1 : 1)
      hasGps = !(latitude === 0 && longitude === 0)
      if (!hasGps) latitude = longitude = null
    }
  }

  return { hasGps, latitude, longitude, make, model, dateTime }
}

function readAscii(view: DataView, at: number, length: number) {
  let text = ''
  for (let i = 0; i < length && at + i < view.byteLength; i++) text += String.fromCharCode(view.getUint8(at + i))
  return text
}

// "2026:10:12 18:30:05" -> Date (ora locale dello scatto)
export function exifDateToDate(value: string): Date | null {
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const [, y, mo, d, h, mi] = match.map(Number)
  const date = new Date(y, mo - 1, d, h, mi)
  return Number.isNaN(date.getTime()) ? null : date
}

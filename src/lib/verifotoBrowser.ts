// VeriFoto: controlli fatti nel browser dell'utente (la foto non viene
// caricata da nessuna parte): Content Credentials / metadati, dati della
// fotocamera, mappa dei ritocchi (Error Level Analysis).
import type { CameraInfo, ProvenanceScan } from '@/lib/verifoto'
import { aiGeneratorName } from '@/lib/verifoto'

// Testo "grezzo" del file (1 carattere per byte): i marcatori C2PA/XMP/PNG
// sono stringhe ASCII dentro il file.
function bytesToText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let out = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return out
}

// Valore testuale di una chiave nei Content Credentials: nel manifest C2PA
// (CBOR) dopo la chiave c'è una stringa con la sua lunghezza codificata;
// nelle versioni JSON è "chiave": "valore".
function c2paString(text: string, key: string): string | null {
  let from = 0
  while (true) {
    const at = text.indexOf(key, from)
    if (at < 0) return null
    const pos = at + key.length
    const head = text.charCodeAt(pos)
    let start = -1
    let length = 0
    if (head >= 0x60 && head <= 0x77) {
      start = pos + 1
      length = head - 0x60
    } else if (head === 0x78) {
      start = pos + 2
      length = text.charCodeAt(pos + 1)
    } else if (head === 0x79) {
      start = pos + 3
      length = (text.charCodeAt(pos + 1) << 8) + text.charCodeAt(pos + 2)
    }
    if (start > 0 && length >= 2 && length <= 200) {
      const value = text.slice(start, start + length)
      if (/^[\x20-\x7e]+$/.test(value)) return value.trim()
    }
    const json = /^"\s*:\s*"([^"]{2,200})"/.exec(text.slice(pos, pos + 220))
    if (json) return json[1].trim()
    from = pos
  }
}

// XMP: <xmp:CreatorTool>valore</xmp:CreatorTool> oppure xmp:CreatorTool="valore"
function xmpValue(text: string, key: string): string | null {
  const m = new RegExp(`${key}(?:>|="|=')([^<"']{2,120})`).exec(text)
  return m ? m[1].trim() : null
}

export function scanProvenance(buffer: ArrayBuffer, software: string | null): ProvenanceScan {
  const text = bytesToText(buffer)
  // C2PA: JUMBF ("jumb" + "c2pa") in JPEG/WebP, blocco "caBX" nei PNG
  const hasC2pa = text.includes('c2pa') && (text.includes('jumb') || text.includes('caBX'))
  const aiSourceType = text.includes('compositeWithTrainedAlgorithmicMedia')
    ? 'composite'
    : text.includes('trainedAlgorithmicMedia')
      ? 'trained'
      : null

  // Strumento dichiarato: C2PA claim_generator / softwareAgent, XMP CreatorTool
  const candidates = [
    c2paString(text, 'claim_generator'),
    c2paString(text, 'softwareAgent'),
    xmpValue(text, 'CreatorTool'),
  ].filter((v): v is string => !!v)
  let generator = candidates.find((c) => aiGeneratorName(c)) ?? candidates[0] ?? null
  // Dentro i Content Credentials un nome di generatore AI vale anche se non
  // è nel campo principale (es. in "claim_generator_info")
  if (hasC2pa && !aiGeneratorName(generator)) {
    const start = Math.max(0, text.indexOf('jumb'))
    const region = text.slice(start, start + 300_000)
    const named = aiGeneratorName(region)
    if (named) generator = named
  }

  // PNG con i parametri di generazione (Stable Diffusion WebUI, ComfyUI, NovelAI, InvokeAI)
  const generationParams =
    (text.includes('parameters') && text.includes('Steps: ') && text.includes('Sampler')) ||
    text.includes('"class_type"') ||
    text.includes('sd-metadata') ||
    /Software\x00+NovelAI/.test(text)

  return { hasC2pa, generator, aiSourceType, generationParams, software }
}

export async function readCamera(file: File): Promise<CameraInfo & { software: string | null }> {
  try {
    const exifr = (await import('exifr')).default
    const data = await exifr.parse(file, {
      pick: ['Make', 'Model', 'DateTimeOriginal', 'ExposureTime', 'FNumber', 'ISO', 'Software'],
    })
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : null)
    const taken = data?.DateTimeOriginal
    return {
      make: str(data?.Make),
      model: str(data?.Model),
      takenAt: taken instanceof Date ? taken.toISOString() : str(taken),
      exposure: data?.ExposureTime != null || data?.FNumber != null || data?.ISO != null,
      software: str(data?.Software),
    }
  } catch {
    return { make: null, model: null, takenAt: null, exposure: false, software: null }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

function drawScaled(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

// Error Level Analysis: si ricomprime la foto e si evidenziano le zone che
// cambiano diversamente dal resto (possibili parti incollate o ritoccate).
export async function errorLevelMap(objectUrl: string): Promise<string | null> {
  try {
    const original = drawScaled(await loadImage(objectUrl), 1200)
    const recompressed = await loadImage(original.toDataURL('image/jpeg', 0.9))
    const second = document.createElement('canvas')
    second.width = original.width
    second.height = original.height
    const ctx2 = second.getContext('2d')!
    ctx2.drawImage(recompressed, 0, 0)
    const a = original.getContext('2d')!.getImageData(0, 0, original.width, original.height)
    const b = ctx2.getImageData(0, 0, second.width, second.height)
    const out = ctx2.createImageData(a.width, a.height)
    for (let i = 0; i < a.data.length; i += 4) {
      const diff = (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3
      const v = Math.min(255, diff * 18)
      // Scala nero → oro → bianco
      out.data[i] = v
      out.data[i + 1] = Math.min(255, v * 0.8)
      out.data[i + 2] = Math.max(0, v - 140)
      out.data[i + 3] = 255
    }
    ctx2.putImageData(out, 0, 0)
    return second.toDataURL('image/png')
  } catch {
    return null
  }
}

// Copia ridotta per il rilevatore esterno (max ~1600 px, JPEG): resta sotto i
// limiti di caricamento e non trasmette i metadati (posizione GPS, ecc.).
export async function detectorCopy(objectUrl: string): Promise<Blob | null> {
  try {
    const canvas = drawScaled(await loadImage(objectUrl), 1600)
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95))
  } catch {
    return null
  }
}

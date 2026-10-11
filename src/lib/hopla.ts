// Hoplà: foto e video dal telefono al PC, direttamente (WebRTC).
// Supabase Realtime serve solo a far «incontrare» i due dispositivi
// (offerta, risposta e indirizzi di rete): i file non passano dai server.

// STUN su Cloudflare (già nostro fornitore). Nessun server ponte (TURN):
// se il collegamento diretto non riesce si chiede la stessa Wi-Fi.
export const HOPLA_ICE: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }]

export const HOPLA_CHUNK = 64 * 1024
export const HOPLA_HIGH_WATER = 8 * 1024 * 1024
export const HOPLA_LOW_WATER = 1024 * 1024
// Senza cartella (file tenuti in memoria) oltre questa soglia si avvisa
export const HOPLA_MEMORY_WARN = 1.5 * 1024 * 1024 * 1024
// Tempo massimo per collegarsi dopo che il telefono si è presentato
export const HOPLA_CONNECT_TIMEOUT = 20_000

export const HOPLA_ID_RE = /^[A-Za-z0-9_-]{22}$/

export type HoplaFileMeta = { i: number; name: string; size: number; type: string }

// Messaggi di controllo sul canale dati (i pezzi dei file viaggiano come binario)
export type HoplaCtrl =
  | { t: 'offer'; files: HoplaFileMeta[] }
  | { t: 'accept' }
  | { t: 'refuse' }
  | { t: 'start'; i: number }
  | { t: 'end'; i: number }
  | { t: 'saved'; i: number }
  | { t: 'done' }
  | { t: 'cancel' }

// Segnali sul canale Realtime per far incontrare telefono e PC
export type HoplaSignal =
  | { kind: 'hello'; peer: string; device: HoplaDevice }
  | { kind: 'offer'; peer: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'answer'; peer: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'ice'; peer: string; from: 'pc' | 'phone'; candidate: RTCIceCandidateInit }
  | { kind: 'busy'; peer: string }
  | { kind: 'bye'; peer: string; from: 'pc' | 'phone' }

export type HoplaDevice = 'iphone' | 'ipad' | 'android' | 'other'

export const hoplaChannel = (id: string) => `hopla:${id}`

// 16 byte casuali in base64url (22 caratteri): il codice è anche la chiave
// per entrare nel canale, quindi deve essere impossibile da indovinare.
export function newHoplaId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function newPeerId(): string {
  return newHoplaId().slice(0, 12)
}

export function detectDevice(ua: string): HoplaDevice {
  if (/iPhone|iPod/i.test(ua)) return 'iphone'
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) return 'ipad'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

// Nome file sicuro per il disco: niente percorsi, caratteri di controllo o nomi riservati
export function safeFileName(name: string, i: number): string {
  const clean = String(name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120)
  return clean || `file-${i + 1}`
}

export function withSuffix(name: string, n: number): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`
}

export function formatBytes(bytes: number, locale: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return new Intl.NumberFormat(locale, { style: 'unit', unit: units[unit], unitDisplay: 'short', maximumFractionDigits: unit >= 2 ? 1 : 0 }).format(value)
}

export function parseCtrl(data: string): HoplaCtrl | null {
  try {
    const msg = JSON.parse(data) as HoplaCtrl
    return msg && typeof msg === 'object' && typeof msg.t === 'string' ? msg : null
  } catch {
    return null
  }
}

// Attende che il canale dati abbia spazio prima di mandare altri pezzi
export function waitForBuffer(dc: RTCDataChannel): Promise<void> {
  if (dc.bufferedAmount <= HOPLA_LOW_WATER) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      dc.removeEventListener('bufferedamountlow', done)
      dc.removeEventListener('close', done)
      resolve()
    }
    dc.addEventListener('bufferedamountlow', done)
    dc.addEventListener('close', done)
  })
}

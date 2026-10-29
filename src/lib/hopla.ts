// Hoplà: file da un dispositivo all'altro, direttamente (WebRTC).
// Chi apre Hoplà dai servizi («host», con il piano) mostra il codice QR e
// sceglie se ricevere o inviare; chi inquadra il codice («ospite», senza
// accesso) fa l'opposto. Supabase Realtime serve solo a far «incontrare» i
// due dispositivi (offerta, risposta e indirizzi di rete): i file non passano
// dai server. Nei segnali 'pc' è l'host e 'phone' l'ospite (nomi storici).

// STUN su Cloudflare (già nostro fornitore). Nessun server ponte (TURN):
// se il collegamento diretto non riesce si chiede la stessa Wi-Fi.
export const HOPLA_ICE: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }]

// Pezzi da 256 KB (o il massimo che accetta chi riceve): meno pezzi, invio più fluido
export const HOPLA_CHUNK = 256 * 1024
// Coda corta (2 MB): veloce lo stesso, e dopo un «annulla» resta poco da smaltire
// (Chrome chiude il canale se si superano 16 MB in attesa)
export const HOPLA_HIGH_WATER = 2 * 1024 * 1024
export const HOPLA_LOW_WATER = 512 * 1024
// Canale a parte per i comandi urgenti: l'«annulla» non fa la coda dietro ai pezzi del file
export const HOPLA_CTRL_LABEL = 'hopla-ctrl'
// Senza cartella (file tenuti in memoria) oltre questa soglia si avvisa
export const HOPLA_MEMORY_WARN = 1.5 * 1024 * 1024 * 1024
// Sul telefono la memoria è meno: si avvisa prima
export const HOPLA_PHONE_MEMORY_WARN = 500 * 1024 * 1024
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
  // L'host ha cambiato modalità (ricevere o inviare) senza scollegarsi
  | { t: 'mode'; mode: HoplaMode }

// Dal punto di vista dell'host: 'get' riceve qui, 'give' invia da qui
export type HoplaMode = 'get' | 'give'

// Segnali sul canale Realtime per far incontrare telefono e PC
export type HoplaSignal =
  | { kind: 'hello'; peer: string; device: HoplaDevice }
  | { kind: 'offer'; peer: string; sdp: RTCSessionDescriptionInit; mode?: HoplaMode; device?: HoplaDevice }
  | { kind: 'answer'; peer: string; sdp: RTCSessionDescriptionInit }
  | { kind: 'ice'; peer: string; from: 'pc' | 'phone'; candidate: RTCIceCandidateInit }
  | { kind: 'busy'; peer: string }
  | { kind: 'bye'; peer: string; from: 'pc' | 'phone' }

export type HoplaDevice = 'iphone' | 'ipad' | 'android' | 'computer' | 'other'

// Collegamento aperto tra i due dispositivi. Il pannello che invia o riceve
// si mette in ascolto con listen: i dati del canale arrivano lì.
export type HoplaHandlers = { onData: (data: string | ArrayBuffer) => void; onCtrl: (msg: HoplaCtrl) => void }
export type HoplaLink = { pc: RTCPeerConnection; dc: RTCDataChannel; ctrl: () => RTCDataChannel | null; listen: (handlers: HoplaHandlers) => void }

// Comandi sul canale dati; l'annullamento passa dal canale dei comandi, così arriva subito
export function linkSend(link: HoplaLink | null, msg: HoplaCtrl) {
  if (link?.dc.readyState === 'open') link.dc.send(JSON.stringify(msg))
}
export function linkCancel(link: HoplaLink | null) {
  const ctrl = link?.ctrl()
  const ch = ctrl?.readyState === 'open' ? ctrl : link?.dc
  if (ch?.readyState === 'open') ch.send(JSON.stringify({ t: 'cancel' }))
}

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
  if (/Mobi|Tablet/i.test(ua)) return 'other'
  return 'computer'
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

// Tipo di collegamento scelto: stessa rete (indirizzi locali) o via internet
export type HoplaRoute = 'local' | 'internet' | null

// Indirizzo di una rete privata (casa, ufficio) o nome locale nascosto (.local)
function isPrivateAddress(address: string | undefined): boolean {
  if (!address) return false
  const a = address.toLowerCase()
  return (
    a.endsWith('.local') ||
    /^10\./.test(a) ||
    /^192\.168\./.test(a) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(a) ||
    /^169\.254\./.test(a) ||
    /^f[cd][0-9a-f]{2}:/.test(a) ||
    /^fe80:/.test(a)
  )
}

async function readRoute(pc: RTCPeerConnection): Promise<HoplaRoute> {
  const stats = await pc.getStats()
  let pairId: string | undefined
  stats.forEach((r) => {
    if (r.type === 'transport' && r.selectedCandidatePairId) pairId = r.selectedCandidatePairId
  })
  let pair: { localCandidateId?: string; remoteCandidateId?: string } | undefined
  stats.forEach((r) => {
    if (r.type !== 'candidate-pair') return
    if ((pairId && r.id === pairId) || (!pairId && r.state === 'succeeded' && r.nominated)) pair = r
  })
  if (!pair?.remoteCandidateId) return null
  const remote = stats.get(pair.remoteCandidateId) as { candidateType?: string; address?: string; ip?: string } | undefined
  if (!remote) return null
  // In rete locale l'altro dispositivo si presenta con il suo indirizzo privato
  if (remote.candidateType === 'host') return 'local'
  if (remote.candidateType === 'prflx') {
    const address = remote.address || remote.ip
    // Indirizzo non ancora noto (arriva un attimo dopo): si riprova
    if (!address) return null
    return isPrivateAddress(address) ? 'local' : 'internet'
  }
  return remote.candidateType ? 'internet' : null
}

export async function connectionRoute(pc: RTCPeerConnection): Promise<HoplaRoute> {
  // Subito dopo il collegamento le statistiche possono non essere complete: si riprova per qualche secondo
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const route = await readRoute(pc)
      if (route) return route
    } catch {
      return null
    }
    await new Promise((r) => setTimeout(r, 800))
  }
  return null
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

// Telefono o tablet: niente cartelle, i file ricevuti si salvano con la condivisione
export function isHandheld(): boolean {
  return typeof navigator !== 'undefined' && detectDevice(navigator.userAgent) !== 'computer'
}

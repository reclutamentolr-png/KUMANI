// Cloudflare Realtime: server video (SFU) per KUMANI Webinar e ripetitore
// TURN. Le chiavi restano sul server; il browser riceve solo le risposte
// SDP e credenziali TURN che scadono.

const BASE = 'https://rtc.live.cloudflare.com/v1'

export type SessionDescription = { type: 'offer' | 'answer'; sdp: string }
export type LocalTrack = { location: 'local'; mid: string; trackName: string }
export type RemoteTrack = { location: 'remote'; sessionId: string; trackName: string }
export type TrackResult = { mid?: string; trackName?: string; sessionId?: string; errorCode?: string; errorDescription?: string }
export type TracksResponse = {
  sessionDescription?: SessionDescription
  requiresImmediateRenegotiation?: boolean
  tracks?: TrackResult[]
  errorCode?: string
  errorDescription?: string
}

export function realtimeConfigured() {
  return !!(process.env.CLOUDFLARE_REALTIME_APP_ID && process.env.CLOUDFLARE_REALTIME_APP_TOKEN)
}

async function sfu<T>(path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/apps/${process.env.CLOUDFLARE_REALTIME_APP_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_REALTIME_APP_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as T & { errorCode?: string; errorDescription?: string }
  if (!res.ok) throw new Error(`realtime ${res.status}: ${data.errorCode ?? ''} ${data.errorDescription ?? ''}`.trim())
  return data
}

export async function newSession(): Promise<string> {
  const data = await sfu<{ sessionId: string }>('/sessions/new', 'POST')
  return data.sessionId
}

// Pubblica tracce del browser (offerta del browser → risposta del server)
export function pushTracks(sessionId: string, offer: SessionDescription, tracks: LocalTrack[]) {
  return sfu<TracksResponse>(`/sessions/${sessionId}/tracks/new`, 'POST', { sessionDescription: offer, tracks })
}

// Riceve tracce di altre sessioni (il server manda un'offerta da completare)
export function pullTracks(sessionId: string, tracks: RemoteTrack[]) {
  return sfu<TracksResponse>(`/sessions/${sessionId}/tracks/new`, 'POST', { tracks })
}

export function renegotiate(sessionId: string, answer: SessionDescription) {
  return sfu<TracksResponse>(`/sessions/${sessionId}/renegotiate`, 'PUT', { sessionDescription: answer })
}

export function closeTracks(sessionId: string, mids: string[]) {
  return sfu<TracksResponse>(`/sessions/${sessionId}/tracks/close`, 'PUT', { tracks: mids.map((mid) => ({ mid })), force: true })
}

// Server per collegarsi: STUN di Cloudflare più il ripetitore TURN (per reti
// 4G/5G e aziendali chiuse), con credenziali valide qualche ora
export async function iceServers(ttlSeconds = 6 * 3600): Promise<RTCIceServer[]> {
  const stun: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }]
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID
  const token = process.env.CLOUDFLARE_TURN_KEY_TOKEN
  if (!keyId || !token) return stun
  try {
    const res = await fetch(`${BASE}/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: ttlSeconds }),
      cache: 'no-store',
    })
    if (!res.ok) return stun
    const data = (await res.json()) as { iceServers?: RTCIceServer[] }
    // Le porte 53 (DNS) sono spesso bloccate dai browser: si tolgono
    const servers = (data.iceServers ?? []).map((s) => ({
      ...s,
      urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !u.includes(':53?') && !u.endsWith(':53')),
    }))
    return servers.length ? servers : stun
  } catch {
    return stun
  }
}

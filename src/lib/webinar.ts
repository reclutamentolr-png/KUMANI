// KUMANI Webinar: regole comuni a browser e server.

export const WEBINAR_CODE_RE = /^[A-Za-z0-9]{10}$/
export const WEBINAR_SEATS = 20
// Spettatore «collegato» se si è fatto sentire negli ultimi 35 secondi
export const VIEWER_ACTIVE_MS = 35_000
// Chi presenta risulta «allontanato» dopo 15 secondi senza segnali
export const HOST_AWAY_MS = 15_000
export const VIEWER_POLL_MS = 10_000
export const HOST_BEAT_MS = 5_000
export const WEBINAR_MESSAGE_MAX = 500
export const WEBINAR_NAME_MAX = 40
// Tra due messaggi dello stesso spettatore
export const WEBINAR_MESSAGE_GAP_MS = 2_000

export type HostTrackKind = 'audio' | 'video' | 'screen'
export type HostTracks = Partial<Record<HostTrackKind, string>>

export type WebinarStatus = 'scheduled' | 'live' | 'ended'

export type LiveState = {
  status: WebinarStatus
  hostSession: string | null
  tracks: HostTracks
  hostAway: boolean
  camOn: boolean
  screenOn: boolean
  // Chat aperta a chi guarda (chi presenta la può chiudere)
  chatOpen: boolean
  // track: la voce; videoTrack: la videocamera, se l'ha accesa
  speaker: { id: string; name: string; session: string | null; track: string | null; videoTrack: string | null } | null
  viewers: number
  hiddenIds: number[]
}

// kumano: scritto da un Kumano (con il suo account) o da chi presenta; altrimenti da un invitato col link
export type WebinarMessage = { id: number; name: string; body: string; isHost: boolean; kumano: boolean; at: string }

export type WebinarViewerRow = { id: string; name: string; hand: boolean; speaking: boolean; kumano: boolean }

export const webinarChannel = (key: string) => `webinar:${key}`

// Nome della traccia → tipo (le tracce si chiamano «audio-…», «video-…»,
// «screen-…»; quelle di chi ha la parola «voice-…» e «face-…»)
export function trackKind(name: string): HostTrackKind | 'voice' | 'face' | null {
  const kind = name.split('-')[0]
  return kind === 'audio' || kind === 'video' || kind === 'screen' || kind === 'voice' || kind === 'face' ? kind : null
}

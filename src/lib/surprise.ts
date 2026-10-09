// KUMANI Sorpresa: regole comuni a server e browser (tipi, temi, giorni e
// sblocco delle tappe). Vedi la migrazione 20270208100000_surprise_gifts.sql.

export const SURPRISE_TYPE = 'surprise'
export const SURPRISE_KINDS = ['voucher', 'journey3', 'journey7'] as const
export type SurpriseKind = (typeof SURPRISE_KINDS)[number]
export const SURPRISE_THEMES = ['gold', 'rose', 'sky', 'green', 'night', 'coral', 'ruby', 'lilac', 'teal', 'silver'] as const
export type SurpriseTheme = (typeof SURPRISE_THEMES)[number]

export const DEFAULT_SURPRISE_PRICES: Record<SurpriseKind, number> = { voucher: 290, journey3: 990, journey7: 1590 }
export const SURPRISE_PRICE_KEYS: Record<SurpriseKind, string> = {
  voucher: 'surprise_price_voucher_cents',
  journey3: 'surprise_price_journey3_cents',
  journey7: 'surprise_price_journey7_cents',
}

export const SURPRISE_OCCASIONS = ['generic', 'birthday', 'love', 'wedding', 'baby', 'christmas', 'parents', 'graduation', 'party', 'thanks'] as const
export type SurpriseOccasion = (typeof SURPRISE_OCCASIONS)[number]
export const REVEAL_STYLES = ['box', 'envelope', 'scratch'] as const
export type RevealStyle = (typeof REVEAL_STYLES)[number]
// Musica: registrazioni vere libere da diritti (pubblico dominio o CC0, da
// Wikimedia Commons) su Cloudflare R2 in «sorprese/<brano>.mp3», oppure un
// audio caricato da chi crea
export const MUSIC_TRACKS = ['birthday', 'radetzky', 'joy', 'pomp', 'danube', 'clair', 'nocturne', 'gymno', 'air', 'lullaby', 'twinkle', 'jingle', 'silentnight'] as const
export const musicFile = (track: MusicTrack) => `sorprese/${track}.mp3`
export type MusicTrack = (typeof MUSIC_TRACKS)[number]
export type SurpriseMusic = MusicTrack | 'own'
export const STEP_KINDS = ['message', 'gallery', 'riddle', 'place', 'song'] as const
export type StepKind = (typeof STEP_KINDS)[number]
export const REACTIONS = ['love', 'joy', 'wow', 'thanks'] as const
export type Reaction = (typeof REACTIONS)[number]
export const GALLERY_MAX = 6

export const isOccasion = (v: unknown): v is SurpriseOccasion => typeof v === 'string' && (SURPRISE_OCCASIONS as readonly string[]).includes(v)
export const isRevealStyle = (v: unknown): v is RevealStyle => typeof v === 'string' && (REVEAL_STYLES as readonly string[]).includes(v)
export const isMusic = (v: unknown): v is SurpriseMusic => v === 'own' || (typeof v === 'string' && (MUSIC_TRACKS as readonly string[]).includes(v))
export const isStepKind = (v: unknown): v is StepKind => typeof v === 'string' && (STEP_KINDS as readonly string[]).includes(v)
export const isReaction = (v: unknown): v is Reaction => typeof v === 'string' && (REACTIONS as readonly string[]).includes(v)

// Ogni occasione: tema di colori consigliato, effetto all'apertura e musica
export const OCCASION_STYLE: Record<SurpriseOccasion, { theme: SurpriseTheme; particles: 'confetti' | 'hearts' | 'snow' | 'stars'; music: MusicTrack }> = {
  generic: { theme: 'gold', particles: 'confetti', music: 'gymno' },
  birthday: { theme: 'gold', particles: 'confetti', music: 'birthday' },
  love: { theme: 'rose', particles: 'hearts', music: 'clair' },
  wedding: { theme: 'gold', particles: 'hearts', music: 'danube' },
  baby: { theme: 'sky', particles: 'stars', music: 'twinkle' },
  christmas: { theme: 'green', particles: 'snow', music: 'jingle' },
  parents: { theme: 'rose', particles: 'hearts', music: 'lullaby' },
  graduation: { theme: 'night', particles: 'stars', music: 'pomp' },
  party: { theme: 'night', particles: 'confetti', music: 'radetzky' },
  thanks: { theme: 'sky', particles: 'stars', music: 'air' },
}

// Risposta dell'indovinello: senza maiuscole, accenti, spazi e punteggiatura
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export const SURPRISE_MAX = {
  recipient: 60,
  sender: 60,
  title: 80,
  message: 1500,
  howToUse: 600,
  stepTitle: 80,
  stepMessage: 1500,
  hint: 300,
  mediaBytes: 10 * 1024 * 1024,
  question: 300,
  answer: 100,
  place: 120,
  link: 500,
  reply: 1000,
}

export const isSurpriseKind = (v: unknown): v is SurpriseKind => typeof v === 'string' && (SURPRISE_KINDS as readonly string[]).includes(v)
export const isSurpriseTheme = (v: unknown): v is SurpriseTheme => typeof v === 'string' && (SURPRISE_THEMES as readonly string[]).includes(v)

export function surpriseDays(kind: SurpriseKind): number {
  return kind === 'journey7' ? 7 : kind === 'journey3' ? 3 : 1
}

// Tappa del giorno N: si apre N-1 giorni dopo l'inizio, alla stessa ora.
// Il buono finale si apre con l'ultimo giorno (subito, per il buono semplice).
export function unlockAt(startAt: string | Date, day: number): Date {
  return new Date(new Date(startAt).getTime() + (Math.max(1, day) - 1) * 86_400_000)
}

export function voucherUnlockAt(startAt: string | Date, kind: SurpriseKind): Date {
  return unlockAt(startAt, surpriseDays(kind))
}

// Colori dei temi (copertina, pulsanti) per la pagina di chi riceve
export const THEME_STYLE: Record<SurpriseTheme, { bg: string; card: string; accent: string; text: string }> = {
  gold: { bg: 'from-[#1a1408] via-[#2b2110] to-[#0f0c06]', card: 'bg-[#fff9ec]', accent: '#c9a227', text: 'text-[#2b2110]' },
  rose: { bg: 'from-[#3b0d1f] via-[#5c1630] to-[#24060f]', card: 'bg-[#fff1f4]', accent: '#e0567f', text: 'text-[#3b0d1f]' },
  sky: { bg: 'from-[#0b2140] via-[#123a6b] to-[#071528]', card: 'bg-[#eef6ff]', accent: '#3b8be0', text: 'text-[#0b2140]' },
  green: { bg: 'from-[#0c2a1c] via-[#14452e] to-[#061a10]', card: 'bg-[#effaf3]', accent: '#2fa36b', text: 'text-[#0c2a1c]' },
  night: { bg: 'from-[#120f24] via-[#231c45] to-[#0a0816]', card: 'bg-[#f4f1ff]', accent: '#8b6cf0', text: 'text-[#120f24]' },
  coral: { bg: 'from-[#3a1208] via-[#6b2614] to-[#1f0904]', card: 'bg-[#fff3ee]', accent: '#f06a43', text: 'text-[#3a1208]' },
  ruby: { bg: 'from-[#2e0508] via-[#5a0d14] to-[#1a0204]', card: 'bg-[#fff0f0]', accent: '#d32f3f', text: 'text-[#2e0508]' },
  lilac: { bg: 'from-[#2a1436] via-[#4a2660] to-[#170a1f]', card: 'bg-[#faf2ff]', accent: '#b57be0', text: 'text-[#2a1436]' },
  teal: { bg: 'from-[#062a2c] via-[#0d4a4d] to-[#031618]', card: 'bg-[#ecfbfa]', accent: '#1fb3a8', text: 'text-[#062a2c]' },
  silver: { bg: 'from-[#1c1f24] via-[#363b44] to-[#0e1013]', card: 'bg-[#f4f6f8]', accent: '#9aa5b4', text: 'text-[#1c1f24]' },
}

export type StepExtra = { question?: string; placeName?: string; placeAddress?: string; mapUrl?: string; songUrl?: string; songTitle?: string }

export type SurpriseStepRow = {
  id: string
  day: number
  position: number
  title: string
  message: string
  hint: string
  media_path: string | null
  media_type: 'image' | 'video' | 'audio' | null
  kind: StepKind
  gallery: string[]
  extra: StepExtra
  riddle_answer?: string | null
  solved_at?: string | null
}

// Tappa a cui manca qualcosa (es. da un modello): canzone senza link, luogo
// senza nome né indirizzo, galleria senza foto, indovinello senza risposta
export function stepIncomplete(s: Pick<SurpriseStepRow, 'kind' | 'extra' | 'gallery' | 'riddle_answer'>): boolean {
  if (s.kind === 'song') return !s.extra?.songUrl
  if (s.kind === 'place') return !s.extra?.placeName && !s.extra?.placeAddress
  if (s.kind === 'gallery') return !(s.gallery ?? []).length
  if (s.kind === 'riddle') return !s.extra?.question || !s.riddle_answer
  return false
}

export type SurpriseRow = {
  id: string
  kind: SurpriseKind
  status: 'draft' | 'active'
  theme: SurpriseTheme
  occasion: SurpriseOccasion
  reveal_style: RevealStyle
  music: SurpriseMusic | null
  music_path: string | null
  recipient_name: string
  sender_name: string
  title: string
  message: string
  how_to_use: string
  valid_until: string | null
  cover_path: string | null
  start_at: string | null
  locale: string
  public_token: string | null
  paid_at: string | null
  amount_cents: number | null
  paid_with?: 'card' | 'karma' | 'ku_points' | null
  points_spent?: number | null
  refunded_at: string | null
  opened_at: string | null
  link_opened_at?: string | null
  created_at: string
}

// Quello che vede chi riceve: le tappe chiuse (e gli indovinelli non
// risolti) arrivano senza contenuto
export type SurpriseViewStep = {
  id: string
  day: number
  unlockAt: string
  open: boolean
  kind: StepKind
  // Indovinello aperto ma non ancora risolto: si vede solo la domanda
  riddle?: { question: string; solved: boolean }
  title?: string
  message?: string
  hint?: string
  mediaUrl?: string | null
  mediaType?: 'image' | 'video' | 'audio' | null
  gallery?: string[]
  extra?: StepExtra
}

export type SurpriseView = {
  kind: SurpriseKind
  theme: SurpriseTheme
  occasion: SurpriseOccasion
  revealStyle: RevealStyle
  music: SurpriseMusic | null
  musicUrl: string | null
  recipientName: string
  senderName: string
  startAt: string
  days: number
  steps: SurpriseViewStep[]
  voucher: {
    unlockAt: string
    open: boolean
    title?: string
    message?: string
    howToUse?: string
    validUntil?: string | null
    coverUrl?: string | null
  }
}

export function surprisePath(token: string) {
  return `/sorpresa/${token}`
}

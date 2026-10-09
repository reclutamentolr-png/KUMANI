// KUMANI Sorpresa: regole comuni a server e browser (tipi, temi, giorni e
// sblocco delle tappe). Vedi la migrazione 20270208100000_surprise_gifts.sql.

export const SURPRISE_TYPE = 'surprise'
export const SURPRISE_KINDS = ['voucher', 'journey3', 'journey7'] as const
export type SurpriseKind = (typeof SURPRISE_KINDS)[number]
export const SURPRISE_THEMES = ['gold', 'rose', 'sky', 'green', 'night'] as const
export type SurpriseTheme = (typeof SURPRISE_THEMES)[number]

export const DEFAULT_SURPRISE_PRICES: Record<SurpriseKind, number> = { voucher: 290, journey3: 990, journey7: 1590 }
export const SURPRISE_PRICE_KEYS: Record<SurpriseKind, string> = {
  voucher: 'surprise_price_voucher_cents',
  journey3: 'surprise_price_journey3_cents',
  journey7: 'surprise_price_journey7_cents',
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
  mediaBytes: 20 * 1024 * 1024,
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
}

export type SurpriseStepRow = {
  id: string
  day: number
  position: number
  title: string
  message: string
  hint: string
  media_path: string | null
  media_type: 'image' | 'video' | 'audio' | null
}

export type SurpriseRow = {
  id: string
  kind: SurpriseKind
  status: 'draft' | 'active'
  theme: SurpriseTheme
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
  refunded_at: string | null
  opened_at: string | null
  created_at: string
}

// Quello che vede chi riceve: le tappe chiuse arrivano senza contenuto
export type SurpriseViewStep = {
  id: string
  day: number
  unlockAt: string
  open: boolean
  title?: string
  message?: string
  hint?: string
  mediaUrl?: string | null
  mediaType?: 'image' | 'video' | 'audio' | null
}

export type SurpriseView = {
  kind: SurpriseKind
  theme: SurpriseTheme
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

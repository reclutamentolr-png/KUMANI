// KUMANI Time Bank: tipi e costanti condivise (pagine, azioni, componenti).
// 1 ora = 1 ora, sempre. Le regole vere (saldo, limiti, verifica) sono nelle
// funzioni SQL timebank_*.

export const TIMEBANK_CATEGORIES = [
  'home_help', 'gardening', 'errands', 'transport', 'pets', 'family', 'cooking', 'tech_help', 'digital_skills',
  'translation', 'tutoring', 'languages', 'music', 'crafts', 'reading', 'company', 'events_help', 'other',
] as const
export type TimebankCategory = (typeof TIMEBANK_CATEGORIES)[number]

export const TIMEBANK_CATEGORY_EMOJI: Record<TimebankCategory, string> = {
  home_help: '🔧',
  gardening: '🌿',
  errands: '🛒',
  transport: '🚗',
  pets: '🐾',
  family: '👨‍👩‍👧',
  cooking: '🍝',
  tech_help: '💻',
  digital_skills: '📊',
  translation: '🌍',
  tutoring: '📚',
  languages: '🗣️',
  music: '🎵',
  crafts: '🧵',
  reading: '📖',
  company: '☕',
  events_help: '🎪',
  other: '✨',
}

export const TIMEBANK_LANGUAGES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'] as const

export type TimebankMode = 'in_person' | 'online' | 'both'

export type TimebankPost = {
  id: string
  kind: 'request' | 'offer'
  title: string
  description: string
  category: TimebankCategory
  hours: number
  mode: TimebankMode
  city: string | null
  country_code: string | null
  languages: string[]
  when_text: string | null
  status: 'open' | 'closed' | 'removed'
  created_at: string
  author_id: string
  author_name: string
  author_exchanges: number
  is_mine: boolean
}

export type TimebankExchange = {
  id: string
  post_id: string | null
  post_title: string | null
  role: 'giver' | 'receiver'
  other_name: string
  hours: number
  note: string | null
  scheduled_on: string | null
  status: 'proposed' | 'accepted' | 'completed' | 'cancelled' | 'disputed'
  proposed_by_me: boolean
  my_confirmed: boolean
  other_confirmed: boolean
  dispute_reason: string | null
  staff_note: string | null
  created_at: string
  completed_at: string | null
}

export type TimebankLedgerRow = { amount: number; kind: 'welcome' | 'exchange' | 'adjustment'; note: string | null; created_at: string }

export type TimebankProfileData = {
  user_id: string
  offers: TimebankCategory[]
  seeks: TimebankCategory[]
  bio: string | null
  city: string | null
  country_code: string | null
  in_person: boolean
  online: boolean
  languages: string[]
  availability: string | null
  balance: number
  hours_given: number
  hours_received: number
  exchanges_count: number
}

export type TimebankStatus = {
  subscription: boolean
  account_age: boolean
  days_left: number
  profile: boolean
  tax_code: boolean
  has_tax_code: boolean
  identity_pending: boolean
  identity_rejected_note: string | null
  identity_last_status: 'pending' | 'approved' | 'rejected' | null
  terms: boolean
  blocked: boolean
  verified: boolean
  joined: boolean
  profile_data: TimebankProfileData | null
  limits: { min_balance: number; max_balance: number; max_day: number; max_pair_week: number; welcome: number }
  online: boolean
}

export type TimebankMy = { exchanges: TimebankExchange[]; posts: TimebankPost[]; ledger: TimebankLedgerRow[] }

export type TimebankMessage = { id: string; mine: boolean; name: string; body: string; created_at: string }

export function formatHours(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(Number(value))
}

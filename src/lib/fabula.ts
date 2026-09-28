// Kumani Fabula: i sei dadi e i tipi condivisi fra server e browser.
// L'indice di una faccia (0..9) è quello salvato nel database: non riordinare.

export type FabulaFace = { id: string; emoji: string }
export type FabulaDie = { id: string; faces: FabulaFace[] }

export const FABULA_DICE: FabulaDie[] = [
  {
    id: 'character',
    faces: [
      { id: 'wizard', emoji: '🧙' }, { id: 'robot', emoji: '🤖' }, { id: 'grandmother', emoji: '👵' }, { id: 'mermaid', emoji: '🧜' },
      { id: 'detective', emoji: '🕵️' }, { id: 'ghost', emoji: '👻' }, { id: 'dragon', emoji: '🐉' }, { id: 'astronaut', emoji: '🧑‍🚀' },
      { id: 'cat', emoji: '🐈' }, { id: 'prince', emoji: '🤴' },
    ],
  },
  {
    id: 'place',
    faces: [
      { id: 'castle', emoji: '🏰' }, { id: 'volcano', emoji: '🌋' }, { id: 'island', emoji: '🏝️' }, { id: 'city', emoji: '🏙️' },
      { id: 'forest', emoji: '🌲' }, { id: 'desert', emoji: '🏜️' }, { id: 'train', emoji: '🚂' }, { id: 'circus', emoji: '🎪' },
      { id: 'ocean', emoji: '🌊' }, { id: 'mountain', emoji: '⛰️' },
    ],
  },
  {
    id: 'object',
    faces: [
      { id: 'crystal_ball', emoji: '🔮' }, { id: 'key', emoji: '🔑' }, { id: 'map', emoji: '🗺️' }, { id: 'diamond', emoji: '💎' },
      { id: 'letter', emoji: '✉️' }, { id: 'hourglass', emoji: '⏳' }, { id: 'hat', emoji: '🎩' }, { id: 'mirror', emoji: '🪞' },
      { id: 'compass', emoji: '🧭' }, { id: 'violin', emoji: '🎻' },
    ],
  },
  {
    id: 'emotion',
    faces: [
      { id: 'fear', emoji: '😱' }, { id: 'love', emoji: '😍' }, { id: 'anger', emoji: '😤' }, { id: 'sadness', emoji: '😢' },
      { id: 'wonder', emoji: '🤩' }, { id: 'joy', emoji: '😂' }, { id: 'embarrassment', emoji: '😳' }, { id: 'doubt', emoji: '🤔' },
      { id: 'relief', emoji: '😌' }, { id: 'nostalgia', emoji: '🥹' },
    ],
  },
  {
    id: 'action',
    faces: [
      { id: 'run', emoji: '🏃' }, { id: 'dance', emoji: '💃' }, { id: 'climb', emoji: '🧗' }, { id: 'swim', emoji: '🏊' },
      { id: 'fly', emoji: '🕊️' }, { id: 'search', emoji: '🔍' }, { id: 'secret', emoji: '🤫' }, { id: 'cook', emoji: '🍳' },
      { id: 'sing', emoji: '🎤' }, { id: 'gift', emoji: '🎁' },
    ],
  },
  {
    id: 'atmosphere',
    faces: [
      { id: 'rain', emoji: '🌧️' }, { id: 'sun', emoji: '☀️' }, { id: 'night', emoji: '🌙' }, { id: 'snow', emoji: '❄️' },
      { id: 'fog', emoji: '🌫️' }, { id: 'storm', emoji: '⛈️' }, { id: 'rainbow', emoji: '🌈' }, { id: 'autumn', emoji: '🍂' },
      { id: 'sunset', emoji: '🌅' }, { id: 'fireworks', emoji: '🎆' },
    ],
  },
]

export const FABULA_LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'] as const
export type FabulaLocale = (typeof FABULA_LOCALES)[number]
export const FABULA_REPORT_REASONS = ['offensive', 'spam', 'other'] as const
export const FABULA_MAX_CHARS = 900
export const FABULA_MIN_CHARS = 20
export const FABULA_CHALLENGE_SECONDS = 60

export const faceOf = (dieIndex: number, faceIndex: number) => FABULA_DICE[dieIndex].faces[faceIndex] ?? FABULA_DICE[dieIndex].faces[0]
export const diceEmoji = (dice: number[]) => dice.map((face, i) => faceOf(i, face).emoji).join(' ')
export const randomDice = () => FABULA_DICE.map((die) => Math.floor(Math.random() * die.faces.length))

export type FabulaStatus = {
  online: boolean
  today: string
  dice: number[]
  my_today: { id: string; status: StoryStatus; title: string | null; body: string; locale: FabulaLocale } | null
  login_days: number
  min_login_days: number
  blocked: boolean
  stories: number
  streak: number
  best_streak: number
  badges: { first_story: boolean; steady_pen: boolean }
}

export type StoryStatus = 'private' | 'pending' | 'published' | 'hidden' | 'removed'

export type FabulaStory = {
  id: string
  roll_date: string | null
  dice: number[]
  title: string | null
  body: string
  locale: FabulaLocale
  status: StoryStatus
  challenge: boolean
  created_at: string
  author_name: string
  applause: number
  applauded: boolean
  is_mine: boolean
  locked?: boolean // resa privata dallo Staff
}

export type FabulaGallery = { date: string; dice: number[]; locales: Record<string, number>; stories: FabulaStory[] }

// Nome di ogni lingua scritto nella lingua stessa (non si traduce)
export const FABULA_LOCALE_NAMES: Record<FabulaLocale, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  ru: 'Русский',
}

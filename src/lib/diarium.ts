// KUMANI DIARIUM: calendario dei post. Tipi e costanti condivisi tra la
// pagina, l'azione sul server e l'Agenda.

export const DIARIUM_NETWORKS = ['instagram', 'facebook', 'tiktok', 'linkedin'] as const
export const DIARIUM_FORMATS = ['post', 'reel', 'story', 'carousel'] as const
export const DIARIUM_PER_WEEK = [2, 3, 4, 5, 7] as const
export const DIARIUM_TONES = ['friendly', 'professional', 'energetic', 'ironic'] as const
export const DIARIUM_DAYS = 30

export type DiariumNetwork = (typeof DIARIUM_NETWORKS)[number]
export type DiariumFormat = (typeof DIARIUM_FORMATS)[number]

export type DiariumRequest = {
  business: string
  place: string
  focus: string
  networks: DiariumNetwork[]
  perWeek: (typeof DIARIUM_PER_WEEK)[number]
  tone: (typeof DIARIUM_TONES)[number]
  startDate: string
}

export type DiariumPost = {
  id: string
  plan_id: string
  post_date: string
  network: DiariumNetwork
  format: DiariumFormat
  title: string
  idea: string
  hook: string
  done: boolean
}

export type DiariumPlan = { id: string; title: string; start_date: string; created_at: string; posts: DiariumPost[] }

export const FORMAT_EMOJI: Record<DiariumFormat, string> = { post: '🖼️', reel: '🎬', story: '⏱️', carousel: '🗂️' }

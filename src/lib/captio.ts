// KUMANI CAPTIO: didascalie e hashtag per i social, scritti con l'AI.
// Costanti e tipi condivisi tra la pagina e l'azione sul server.

export const CAPTIO_NETWORKS = ['instagram', 'facebook', 'tiktok', 'linkedin'] as const
export const CAPTIO_TONES = ['friendly', 'professional', 'energetic', 'ironic'] as const
export const CAPTIO_GOALS = ['inform', 'sell', 'engage', 'story'] as const
export const CAPTIO_LENGTHS = ['short', 'medium', 'long'] as const

export type CaptioRequest = {
  description: string
  business: string
  place: string
  cta: string
  network: (typeof CAPTIO_NETWORKS)[number]
  tone: (typeof CAPTIO_TONES)[number]
  goal: (typeof CAPTIO_GOALS)[number]
  length: (typeof CAPTIO_LENGTHS)[number]
  emoji: boolean
  // Foto del post ridotta nel telefono (JPEG in base64), facoltativa
  image?: string
}

export type CaptioResult = {
  captions: string[]
  hashtags: { broad: string[]; niche: string[]; local: string[] }
}

// Foto: lato lungo massimo e peso massimo della versione inviata all'AI
export const CAPTIO_IMAGE_MAX_SIDE = 1024
export const CAPTIO_IMAGE_MAX_BYTES = 900_000

// Quanti hashtag in tutto per ogni social
export const CAPTIO_HASHTAG_COUNT: Record<CaptioRequest['network'], string> = {
  instagram: '8-15',
  facebook: '2-4',
  tiktok: '3-6',
  linkedin: '3-5',
}

// KUMANI LUMEN: costanti e calcoli condivisi tra pagina e azioni.

// ai_settings: le scelte usate per crearlo con l'AI (null se scritto a mano)
export type LumenScript = { id: string; title: string; body: string; updated_at: string; ai_settings?: LumenAiRequest | null }

export const LUMEN_TITLE_MAX = 80
export const LUMEN_BODY_MAX = 20000

// Ritmo medio di chi parla in video: circa 150 parole al minuto
export const WORDS_PER_MINUTE = 150

export const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)

// Durata stimata in secondi
export const estimateSeconds = (text: string) => Math.round((countWords(text) / WORDS_PER_MINUTE) * 60)

export const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

// Velocità di scorrimento (1–50) in pixel al secondo, a testo di 40px:
// 20 ≈ ritmo di lettura normale. Con il testo più grande scorre in proporzione.
export const speedToPxPerSecond = (speed: number, fontSize: number) => (4 + speed * 1.8) * (fontSize / 40)

// Formato del video registrato: il primo che il browser sa creare
// (Safari e Chrome recenti: MP4; altrimenti WebM)
export function pickRecorderType(): { mimeType: string; ext: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined') return null
  const options: { mimeType: string; ext: 'mp4' | 'webm' }[] = [
    { mimeType: 'video/mp4;codecs=avc1,mp4a', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ]
  return options.find((o) => MediaRecorder.isTypeSupported(o.mimeType)) ?? null
}

export const safeFileName = (title: string) =>
  (title.trim() || 'lumen')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .toLowerCase() || 'lumen'

// «Scrivi con l'AI»: le scelte del modulo (durata in secondi, tono, obiettivo)
export const LUMEN_AI_DURATIONS = [15, 30, 60, 90] as const
export const LUMEN_AI_TONES = ['friendly', 'professional', 'energetic', 'calm'] as const
export const LUMEN_AI_GOALS = ['present', 'offer', 'tips', 'story'] as const
export type LumenAiRequest = {
  topic: string
  audience: string
  cta: string
  seconds: (typeof LUMEN_AI_DURATIONS)[number]
  tone: (typeof LUMEN_AI_TONES)[number]
  goal: (typeof LUMEN_AI_GOALS)[number]
}

import type { MusicTrack, RevealStyle, StepKind, SurpriseKind, SurpriseOccasion, SurpriseTheme } from '@/lib/surprise'

// Modelli pronti di KUMANI Sorpresa: tipo, stile e tappe già impostati, con
// i testi nella lingua di chi crea (namespace «surpriseTpl»). Chi crea poi
// li cambia come vuole.

export type SurpriseTemplate = {
  key: string
  kind: SurpriseKind
  occasion: SurpriseOccasion
  reveal: RevealStyle
  music: MusicTrack
  theme: SurpriseTheme
  // Tappe: giorno e tipo; i testi sono «<key>_s<n>_title|message|hint»
  steps: { day: number; kind: StepKind; hint?: boolean }[]
}

export const SURPRISE_TEMPLATES: SurpriseTemplate[] = [
  { key: 'mom', kind: 'voucher', occasion: 'parents', reveal: 'envelope', music: 'lullaby', theme: 'rose', steps: [] },
  {
    key: 'anniversary',
    kind: 'journey3',
    occasion: 'love',
    reveal: 'envelope',
    music: 'clair',
    theme: 'rose',
    steps: [
      { day: 1, kind: 'message', hint: true },
      { day: 2, kind: 'song' },
      { day: 3, kind: 'place', hint: true },
    ],
  },
  {
    key: 'birthday',
    kind: 'journey7',
    occasion: 'birthday',
    reveal: 'box',
    music: 'birthday',
    theme: 'gold',
    steps: [
      { day: 1, kind: 'message' },
      { day: 3, kind: 'message', hint: true },
      { day: 5, kind: 'song' },
      { day: 7, kind: 'message', hint: true },
    ],
  },
  { key: 'thanks', kind: 'voucher', occasion: 'thanks', reveal: 'scratch', music: 'gymno', theme: 'sky', steps: [] },
]

export const templateByKey = (key: string) => SURPRISE_TEMPLATES.find((t) => t.key === key) ?? null

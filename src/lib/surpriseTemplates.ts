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
  // Natale per primo: è la festa dei regali
  { key: 'christmas', kind: 'voucher', occasion: 'christmas', reveal: 'box', music: 'jingle', theme: 'ruby', steps: [] },
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
  // Buoni regalo con le esperienze più regalate (cofanetti, feste e ricorrenze)
  { key: 'romanticDinner', kind: 'voucher', occasion: 'love', reveal: 'candles', music: 'nocturne', theme: 'rose', steps: [] },
  { key: 'spaCouple', kind: 'voucher', occasion: 'love', reveal: 'curtain', music: 'air', theme: 'lilac', steps: [] },
  { key: 'weekend', kind: 'voucher', occasion: 'generic', reveal: 'polaroid', music: 'danube', theme: 'teal', steps: [] },
  { key: 'birthdayVoucher', kind: 'voucher', occasion: 'birthday', reveal: 'candles', music: 'birthday', theme: 'gold', steps: [] },
  { key: 'wine', kind: 'voucher', occasion: 'generic', reveal: 'envelope', music: 'clair', theme: 'coral', steps: [] },
  { key: 'cooking', kind: 'voucher', occasion: 'party', reveal: 'cookie', music: 'radetzky', theme: 'coral', steps: [] },
  { key: 'balloonFlight', kind: 'voucher', occasion: 'birthday', reveal: 'balloon', music: 'joy', theme: 'sky', steps: [] },
  { key: 'concert', kind: 'voucher', occasion: 'party', reveal: 'curtain', music: 'pomp', theme: 'night', steps: [] },
  { key: 'graduation', kind: 'voucher', occasion: 'graduation', reveal: 'box', music: 'pomp', theme: 'gold', steps: [] },
  { key: 'baby', kind: 'voucher', occasion: 'baby', reveal: 'balloon', music: 'twinkle', theme: 'sky', steps: [] },
  { key: 'honeymoon', kind: 'voucher', occasion: 'wedding', reveal: 'envelope', music: 'air', theme: 'silver', steps: [] },
  { key: 'dad', kind: 'voucher', occasion: 'parents', reveal: 'scratch', music: 'radetzky', theme: 'green', steps: [] },
  { key: 'photoShoot', kind: 'voucher', occasion: 'generic', reveal: 'polaroid', music: 'gymno', theme: 'silver', steps: [] },
]

export const templateByKey = (key: string) => SURPRISE_TEMPLATES.find((t) => t.key === key) ?? null

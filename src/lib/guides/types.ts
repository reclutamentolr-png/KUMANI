// Centro guide KUMANI (/guida): guide passo passo con le schermate vere
// dell'app (public/guides/<lingua>/<guida>-<n>.webp, una per passo, fatte
// con scripts/guide-screenshots.mjs).

export type GuideCategory = 'start' | 'promote' | 'wallet'

export type GuideSlug = 'registrazione' | 'accesso' | 'dashboard' | 'invito' | 'voucher' | 'wallet'

export type GuideStep = {
  title: string
  text: string
  // Consiglio facoltativo sotto il testo
  tip?: string
}

export type Guide = {
  slug: GuideSlug
  category: GuideCategory
  title: string
  summary: string
  minutes: number
  steps: GuideStep[]
  // Pulsante finale: la pagina dove mettere in pratica la guida
  cta: { label: string; href: string }
}

export type GuidesContent = {
  categories: Record<GuideCategory, { title: string; text: string }>
  guides: Guide[]
}

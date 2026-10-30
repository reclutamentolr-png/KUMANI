// Centro guide KUMANI (/guida): guide passo passo con le schermate vere
// dell'app (public/guides/<lingua>/<guida>-<n>.webp, una per passo, fatte
// con scripts/guide-screenshots.mjs).

export type GuideCategory = 'start' | 'promote' | 'wallet' | 'promoteTools' | 'security' | 'community' | 'organize' | 'pro' | 'wellness' | 'audio' | 'kids'

export type GuideSlug =
  | 'registrazione'
  | 'accesso'
  | 'dashboard'
  | 'invito'
  | 'voucher'
  | 'wallet'
  // Guide dei servizi (lo slug è il nome del servizio)
  | 'qr-generator'
  | 'whatsapp-messages'
  | 'link-in-bio'
  | 'spotlight'
  | 'events'
  | 'antitruffa'
  | 'verifica-iban'
  | 'checkmail'
  | 'verifoto'
  | 'documento-sicuro'
  | 'listings'
  | 'timebank'
  | 'convivio'
  | 'affinity'
  | 'convivium'
  | 'calendario'
  | 'veritas'
  | 'kumani-cv'
  | 'findo'
  | 'life-calendar'
  | 'garage'
  | 'casa'
  | 'sorprese'
  | 'memolife'
  | 'spendly'
  | 'fincheck'
  // Servizi Pro
  | 'menu'
  | 'shop'
  | 'offermaker'
  | 'landing-page'
  | 'fidelity'
  | 'preventivi'
  | 'digital-receipt'
  | 'magazzino'
  | 'clienti'
  | 'brand'
  | 'qr-code-pro'
  | 'firma-email'
  | 'calcolatrici'
  | 'svat'
  | 'hopla'
  | 'firma-pdf'
  | 'lumen'
  | 'vox'
  | 'captio'
  | 'diarium'
  | 'imago'
  | 'forma'
  | 'tutela'
  | 'rete-antitruffa'
  | 'scudo-dati'
  | 'trova-lavoro'
  | 'proposte'
  | 'focus'
  | 'mandala'
  | 'mosaic'
  | 'oxygen'
  | 'fabula'
  | 'nexus'
  | 'neurobalance'
  | 'aureya'
  | 'cronobioma'
  | 'tempus'
  | 'travel'
  | 'angolo-bambini'
  | 'vocale-sospetto'
  | 'testo-protetto'
  | 'carte-antitruffa'
  | 'scanner'
  | 'fototessera'
  | 'fonometro'
  | 'metronomo'
  | 'accordatore'
  | 'lettera-presentazione'
  | 'registro-ore'
  | 'candidature'
  | 'ricevuta-occasionale'
  | 'note-spese'
  | 'documento-componibile'

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

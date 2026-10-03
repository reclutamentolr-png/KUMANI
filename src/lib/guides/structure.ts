import type { GuideCategory, GuideSlug } from '@/lib/guides/types'

// Struttura delle guide: categoria, minuti, numero di passi e pagina finale.
// I testi (titoli, passi, consigli, pulsante) stanno nei file delle lingue,
// namespace "guideTexts", e si correggono dall'Area Traduttori.

export type GuideStructure = { slug: GuideSlug; category: GuideCategory; minutes: number; steps: number; href: string }

export const GUIDE_CATEGORIES: GuideCategory[] = ['start', 'promote', 'wallet', 'promoteTools', 'security', 'community', 'organize', 'wellness']

export const GUIDE_STRUCTURE: GuideStructure[] = [
  { slug: 'registrazione', category: 'start', minutes: 3, steps: 4, href: '/register' },
  { slug: 'accesso', category: 'start', minutes: 2, steps: 3, href: '/login' },
  { slug: 'dashboard', category: 'start', minutes: 3, steps: 5, href: '/dashboard' },
  { slug: 'invito', category: 'promote', minutes: 3, steps: 4, href: '/dashboard/rete' },
  { slug: 'voucher', category: 'promote', minutes: 3, steps: 3, href: '/wallet' },
  { slug: 'wallet', category: 'wallet', minutes: 4, steps: 5, href: '/wallet' },
  { slug: 'qr-generator', category: 'promoteTools', minutes: 2, steps: 4, href: '/marketplace/qr-generator' },
  { slug: 'whatsapp-messages', category: 'promoteTools', minutes: 2, steps: 3, href: '/marketplace/whatsapp-messages' },
  { slug: 'link-in-bio', category: 'promoteTools', minutes: 3, steps: 4, href: '/marketplace/link-in-bio' },
  { slug: 'spotlight', category: 'promoteTools', minutes: 3, steps: 3, href: '/marketplace/spotlight' },
  { slug: 'events', category: 'promoteTools', minutes: 3, steps: 4, href: '/events' },
  { slug: 'antitruffa', category: 'security', minutes: 2, steps: 4, href: '/marketplace/antitruffa' },
  { slug: 'verifica-iban', category: 'security', minutes: 2, steps: 4, href: '/marketplace/verifica-iban' },
  { slug: 'checkmail', category: 'security', minutes: 3, steps: 4, href: '/marketplace/checkmail' },
  { slug: 'verifoto', category: 'security', minutes: 2, steps: 4, href: '/marketplace/verifoto' },
  { slug: 'documento-sicuro', category: 'security', minutes: 3, steps: 4, href: '/marketplace/documento-sicuro' },
  { slug: 'listings', category: 'community', minutes: 3, steps: 5, href: '/marketplace/listings' },
  { slug: 'timebank', category: 'community', minutes: 3, steps: 4, href: '/marketplace/timebank' },
  { slug: 'convivio', category: 'community', minutes: 3, steps: 4, href: '/marketplace/convivio' },
  { slug: 'affinity', category: 'community', minutes: 3, steps: 4, href: '/marketplace/affinity' },
  { slug: 'veritas', category: 'community', minutes: 2, steps: 3, href: '/marketplace/veritas' },
  { slug: 'kumani-cv', category: 'organize', minutes: 4, steps: 4, href: '/marketplace/kumani-cv' },
  { slug: 'findo', category: 'organize', minutes: 2, steps: 3, href: '/marketplace/findo' },
  { slug: 'life-calendar', category: 'organize', minutes: 2, steps: 3, href: '/marketplace/life-calendar' },
  { slug: 'memolife', category: 'organize', minutes: 2, steps: 2, href: '/marketplace/memolife' },
  { slug: 'spendly', category: 'organize', minutes: 3, steps: 4, href: '/marketplace/spendly' },
  { slug: 'fincheck', category: 'organize', minutes: 3, steps: 5, href: '/marketplace/fincheck' },
  { slug: 'svat', category: 'organize', minutes: 2, steps: 4, href: '/marketplace/svat' },
  { slug: 'focus', category: 'wellness', minutes: 2, steps: 3, href: '/marketplace/focus' },
  { slug: 'mandala', category: 'wellness', minutes: 2, steps: 3, href: '/marketplace/mandala' },
  { slug: 'mosaic', category: 'wellness', minutes: 2, steps: 3, href: '/marketplace/mosaic' },
  { slug: 'oxygen', category: 'wellness', minutes: 2, steps: 3, href: '/marketplace/oxygen' },
  { slug: 'fabula', category: 'wellness', minutes: 2, steps: 3, href: '/marketplace/fabula' },
  { slug: 'neurobalance', category: 'wellness', minutes: 2, steps: 3, href: '/marketplace/neurobalance' },
  { slug: 'aureya', category: 'wellness', minutes: 3, steps: 4, href: '/marketplace/aureya' },
  { slug: 'travel', category: 'wellness', minutes: 2, steps: 2, href: '/viaggi' },
]

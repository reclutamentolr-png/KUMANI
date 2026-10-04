import type { GuideSlug } from '@/lib/guides/types'

// Servizi che hanno una guida nel Centro guide: indirizzo del servizio →
// guida. Il pulsante "Come si usa" compare solo su queste pagine (e sulle
// loro sottopagine). Aggiungere qui ogni nuova guida di un servizio.
export const TOOL_GUIDES: { path: string; slug: GuideSlug }[] = [
  { path: '/marketplace/qr-generator', slug: 'qr-generator' },
  { path: '/marketplace/whatsapp-messages', slug: 'whatsapp-messages' },
  { path: '/marketplace/link-in-bio', slug: 'link-in-bio' },
  { path: '/marketplace/spotlight', slug: 'spotlight' },
  { path: '/events', slug: 'events' },
  { path: '/marketplace/antitruffa', slug: 'antitruffa' },
  { path: '/marketplace/verifica-iban', slug: 'verifica-iban' },
  { path: '/marketplace/checkmail', slug: 'checkmail' },
  { path: '/marketplace/verifoto', slug: 'verifoto' },
  { path: '/marketplace/documento-sicuro', slug: 'documento-sicuro' },
  { path: '/marketplace/listings', slug: 'listings' },
  // I messaggi sono quelli della Bacheca: stessa guida
  { path: '/marketplace/chat', slug: 'listings' },
  { path: '/marketplace/timebank', slug: 'timebank' },
  { path: '/marketplace/convivio', slug: 'convivio' },
  { path: '/marketplace/affinity', slug: 'affinity' },
  { path: '/marketplace/veritas', slug: 'veritas' },
  { path: '/marketplace/kumani-cv', slug: 'kumani-cv' },
  { path: '/marketplace/findo', slug: 'findo' },
  { path: '/marketplace/life-calendar', slug: 'life-calendar' },
  { path: '/marketplace/garage', slug: 'garage' },
  { path: '/marketplace/memolife', slug: 'memolife' },
  { path: '/marketplace/spendly', slug: 'spendly' },
  { path: '/marketplace/fincheck', slug: 'fincheck' },
  { path: '/marketplace/menu', slug: 'menu' },
  { path: '/marketplace/landing-page', slug: 'landing-page' },
  { path: '/marketplace/fidelity', slug: 'fidelity' },
  { path: '/marketplace/preventivi', slug: 'preventivi' },
  { path: '/marketplace/digital-receipt', slug: 'digital-receipt' },
  { path: '/marketplace/magazzino', slug: 'magazzino' },
  { path: '/marketplace/qr-code-pro', slug: 'qr-code-pro' },
  { path: '/marketplace/firma-email', slug: 'firma-email' },
  { path: '/marketplace/calcolatrici', slug: 'calcolatrici' },
  { path: '/marketplace/svat', slug: 'svat' },
  { path: '/marketplace/focus', slug: 'focus' },
  { path: '/marketplace/mandala', slug: 'mandala' },
  { path: '/marketplace/mosaic', slug: 'mosaic' },
  { path: '/marketplace/oxygen', slug: 'oxygen' },
  { path: '/marketplace/fabula', slug: 'fabula' },
  { path: '/marketplace/neurobalance', slug: 'neurobalance' },
  { path: '/marketplace/aureya', slug: 'aureya' },
  { path: '/viaggi', slug: 'travel' },
]

export function toolGuideFor(barePath: string): GuideSlug | null {
  const match = TOOL_GUIDES.find(({ path }) => barePath === path || barePath.startsWith(`${path}/`))
  return match?.slug ?? null
}

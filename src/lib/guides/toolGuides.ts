import type { GuideSlug } from '@/lib/guides/types'

// Servizi che hanno una guida nel Centro guide: indirizzo del servizio →
// guida. Il pulsante "Come si usa" compare solo su queste pagine (e sulle
// loro sottopagine). Aggiungere qui ogni nuova guida di un servizio.
export const TOOL_GUIDES: { path: string; slug: GuideSlug }[] = [
  { path: '/app/qr-generator', slug: 'qr-generator' },
  { path: '/app/whatsapp-messages', slug: 'whatsapp-messages' },
  { path: '/app/link-in-bio', slug: 'link-in-bio' },
  { path: '/app/spotlight', slug: 'spotlight' },
  { path: '/events', slug: 'events' },
  { path: '/app/antitruffa', slug: 'antitruffa' },
  { path: '/app/verifica-iban', slug: 'verifica-iban' },
  { path: '/app/checkmail', slug: 'checkmail' },
  { path: '/app/verifoto', slug: 'verifoto' },
  { path: '/app/documento-sicuro', slug: 'documento-sicuro' },
  { path: '/app/listings', slug: 'listings' },
  // I messaggi sono quelli della Bacheca: stessa guida
  { path: '/app/chat', slug: 'listings' },
  { path: '/app/timebank', slug: 'timebank' },
  { path: '/app/convivio', slug: 'convivio' },
  { path: '/app/affinity', slug: 'affinity' },
  { path: '/convivium', slug: 'convivium' },
  { path: '/calendario-collegato', slug: 'calendario' },
  { path: '/app/veritas', slug: 'veritas' },
  { path: '/app/kumani-cv', slug: 'kumani-cv' },
  { path: '/app/findo', slug: 'findo' },
  { path: '/app/life-calendar', slug: 'life-calendar' },
  { path: '/app/garage', slug: 'garage' },
  { path: '/app/casa', slug: 'casa' },
  { path: '/sorprese', slug: 'sorprese' },
  { path: '/app/memolife', slug: 'memolife' },
  { path: '/app/spendly', slug: 'spendly' },
  { path: '/app/fincheck', slug: 'fincheck' },
  { path: '/app/menu', slug: 'menu' },
  { path: '/app/shop', slug: 'shop' },
  { path: '/app/offermaker', slug: 'offermaker' },
  { path: '/app/landing-page', slug: 'landing-page' },
  { path: '/app/fidelity', slug: 'fidelity' },
  { path: '/app/preventivi', slug: 'preventivi' },
  { path: '/app/digital-receipt', slug: 'digital-receipt' },
  { path: '/app/magazzino', slug: 'magazzino' },
  { path: '/app/clienti', slug: 'clienti' },
  { path: '/app/hopla', slug: 'hopla' },
  { path: '/app/firma-pdf', slug: 'firma-pdf' },
  { path: '/app/lumen', slug: 'lumen' },
  { path: '/app/vox', slug: 'vox' },
  { path: '/app/captio', slug: 'captio' },
  { path: '/app/diarium', slug: 'diarium' },
  { path: '/app/imago', slug: 'imago' },
  { path: '/app/forma', slug: 'forma' },
  { path: '/app/tutela', slug: 'tutela' },
  { path: '/app/rete-antitruffa', slug: 'rete-antitruffa' },
  { path: '/app/scudo-dati', slug: 'scudo-dati' },
  { path: '/app/trova-lavoro', slug: 'trova-lavoro' },
  { path: '/community/proposte', slug: 'proposte' },
  { path: '/scheda-attivita/colori', slug: 'brand' },
  { path: '/app/qr-code-pro', slug: 'qr-code-pro' },
  { path: '/app/firma-email', slug: 'firma-email' },
  { path: '/app/calcolatrici', slug: 'calcolatrici' },
  { path: '/app/svat', slug: 'svat' },
  { path: '/app/focus', slug: 'focus' },
  { path: '/app/mandala', slug: 'mandala' },
  { path: '/app/mosaic', slug: 'mosaic' },
  { path: '/app/oxygen', slug: 'oxygen' },
  { path: '/app/fabula', slug: 'fabula' },
  { path: '/app/nexus', slug: 'nexus' },
  { path: '/app/neurobalance', slug: 'neurobalance' },
  { path: '/app/aureya', slug: 'aureya' },
  { path: '/app/cronobioma', slug: 'cronobioma' },
  { path: '/app/tempus', slug: 'tempus' },
  { path: '/viaggi', slug: 'travel' },
]

// Pagine di chi arriva da un invito (risponde o entra con un link): la guida
// spiega come CREARE e confonderebbe; lì basta la pagina stessa.
const GUEST_PAGES = ['/convivium/invito', '/viaggi/invito', '/events/pass']

export function toolGuideFor(barePath: string): GuideSlug | null {
  if (GUEST_PAGES.some((path) => barePath === path || barePath.startsWith(`${path}/`))) return null
  const match = TOOL_GUIDES.find(({ path }) => barePath === path || barePath.startsWith(`${path}/`))
  return match?.slug ?? null
}

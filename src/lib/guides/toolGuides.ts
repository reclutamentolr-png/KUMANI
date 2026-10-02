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
]

export function toolGuideFor(barePath: string): GuideSlug | null {
  const match = TOOL_GUIDES.find(({ path }) => barePath === path || barePath.startsWith(`${path}/`))
  return match?.slug ?? null
}

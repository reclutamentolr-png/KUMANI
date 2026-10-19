import type { CommunityItem } from '@/components/dashboard/CommunityBlock'
import type { ServiceItem } from '@/lib/servicesCatalog'

// Le sezioni della Community (Bacheca, Kumano del Giorno, Kordata, Eventi,
// Banca del Tempo, Proposte) come «servizi» per le icone: categoria
// «Community» nella pagina Servizi a icone, icone e cartella nella Home.
// Colore azzurro come il riquadro Community; bloccate: si sbloccano col piano.
export const COMMUNITY_TONE = 'bg-sky-100 text-sky-700'
export const COMMUNITY_DOT = 'bg-sky-600'
export const COMMUNITY_FOLDER = 'community'

export function communityAsService(item: CommunityItem): ServiceItem {
  return {
    toolName: item.toolName,
    title: item.title,
    description: item.description,
    iconName: item.iconName,
    href: item.href,
    // Il gruppo serve solo come ripiego: il colore è quello della Community
    group: 'fun',
    open: !item.locked,
    plan: item.plan,
    unlock: item.locked ? (item.plan === 'pro' ? 'pro' : 'base') : null,
    passPrice: null,
    guide: null,
    tone: COMMUNITY_TONE,
    community: true,
  }
}

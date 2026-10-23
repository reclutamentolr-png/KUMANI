// Homepage: «In cosa possiamo darti una mano?». Ogni bisogno porta a pochi servizi
// (pagine pubbliche /strumenti/<servizio>, più Eventi e KUMANI Sorpresa).
// Testi dei bisogni nel namespace "homeNeeds"; nomi e descrizioni dei
// servizi sono quelli del Marketplace.

import type { RequiredPlan } from '@/lib/plans'

export const HOME_NEEDS = [
  { key: 'scams', icon: 'ShieldCheck', items: ['rete-antitruffa', 'antitruffa', 'checkmail', 'verifica-iban', 'svat', 'verifoto', 'scudo-dati', 'documento-sicuro', 'tutela'] },
  { key: 'organize', icon: 'CalendarDays', items: ['life-calendar', 'memolife', 'findo', 'hopla'] },
  { key: 'trips', icon: 'Plane', items: ['travel', 'convivium', 'events'] },
  { key: 'money', icon: 'PiggyBank', items: ['spendly', 'fincheck', 'casa', 'garage', 'digital-receipt'] },
  { key: 'business', icon: 'Store', items: ['landing-page', 'shop', 'menu', 'fidelity', 'offermaker', 'clienti', 'listings'] },
  { key: 'promote', icon: 'Megaphone', items: ['qr-generator', 'qr-code-pro', 'link-in-bio', 'whatsapp-messages', 'firma-email', 'spotlight'] },
  // KUMANI Social: il kit per chi inizia sui social (stessi servizi del servizio unito)
  { key: 'social', icon: 'Clapperboard', items: ['tutela', 'captio', 'lumen', 'vox', 'diarium', 'imago', 'forma'] },
  { key: 'work', icon: 'BriefcaseBusiness', items: ['trova-lavoro', 'kumani-cv', 'preventivi', 'clienti', 'firma-pdf', 'magazzino', 'calcolatrici'] },
  { key: 'people', icon: 'Users', items: ['convivium', 'affinity', 'events', 'timebank', 'convivio'] },
  // Le sezioni della Community, da aggiungere a «I tuoi servizi» come gli altri
  { key: 'community', icon: 'HeartHandshake', items: ['listings', 'convivio', 'events', 'timebank', 'proposte', 'spotlight'] },
  { key: 'games', icon: 'Gamepad2', items: ['nexus', 'veritas', 'fabula', 'mosaic'] },
  // Salute e benessere (la chiave resta «relax»: è già salvata nelle scelte degli iscritti)
  { key: 'relax', icon: 'HeartPulse', items: ['aureya', 'cronobioma', 'neurobalance', 'oxygen'] },
  { key: 'unwind', icon: 'Leaf', items: ['focus', 'mandala'] },
  { key: 'gift', icon: 'Gift', items: ['sorprese'] },
] as const

export type HomeNeedKey = (typeof HOME_NEEDS)[number]['key']

// Nella dashboard le sezioni della Community hanno il nome «community-…»
// (lib/servicesCatalog getCommunityItems, anche nei preferiti)
const COMMUNITY_TOOL: Record<string, string> = {
  listings: 'community-listings',
  convivio: 'community-convivio',
  events: 'community-events',
  timebank: 'community-timebank',
  proposte: 'community-proposals',
  spotlight: 'community-spotlight',
}
export const homeNeedToolName = (name: string) => COMMUNITY_TOOL[name] ?? name
// links: servizio unito (lib/serviceHubs) → tutte le sue schede, prima quelle del bisogno
// plan: piano che comprende lo strumento (solo per gli strumenti del Marketplace)
export type HomeNeedItem = { name: string; title: string; description: string; href: string; iconName: string; plan?: RequiredPlan; links?: { title: string; href: string; plan?: RequiredPlan }[] }
// short: etichetta breve per la versione compatta in dashboard
export type HomeNeed = { key: HomeNeedKey; icon: string; label: string; short: string; intro: string; items: HomeNeedItem[] }

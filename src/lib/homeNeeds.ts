// Homepage: «In cosa possiamo darti una mano?». Ogni bisogno porta a pochi servizi
// (pagine pubbliche /strumenti/<servizio>, più Eventi e KUMANI Sorpresa).
// Testi dei bisogni nel namespace "homeNeeds"; nomi e descrizioni dei
// servizi sono quelli del Marketplace.

import type { RequiredPlan } from '@/lib/plans'

export const HOME_NEEDS = [
  { key: 'scams', icon: 'ShieldCheck', items: ['rete-antitruffa', 'antitruffa', 'checkmail', 'verifica-iban', 'svat', 'verifoto', 'scudo-dati', 'documento-sicuro'] },
  { key: 'organize', icon: 'CalendarDays', items: ['life-calendar', 'memolife', 'focus', 'travel', 'findo', 'hopla'] },
  { key: 'money', icon: 'PiggyBank', items: ['spendly', 'fincheck', 'casa', 'garage', 'digital-receipt'] },
  { key: 'business', icon: 'Store', items: ['landing-page', 'shop', 'menu', 'fidelity', 'offermaker', 'clienti', 'listings'] },
  { key: 'promote', icon: 'Megaphone', items: ['qr-generator', 'qr-code-pro', 'link-in-bio', 'whatsapp-messages', 'firma-email', 'spotlight'] },
  { key: 'work', icon: 'BriefcaseBusiness', items: ['trova-lavoro', 'kumani-cv', 'preventivi', 'clienti', 'firma-pdf', 'magazzino', 'calcolatrici'] },
  { key: 'people', icon: 'Users', items: ['affinity', 'events', 'timebank', 'convivio'] },
  { key: 'games', icon: 'Gamepad2', items: ['nexus', 'veritas', 'fabula', 'mosaic'] },
  { key: 'relax', icon: 'Leaf', items: ['neurobalance', 'oxygen', 'focus', 'mandala', 'aureya'] },
  { key: 'gift', icon: 'Gift', items: ['sorprese'] },
] as const

export type HomeNeedKey = (typeof HOME_NEEDS)[number]['key']
// links: servizio unito (lib/serviceHubs) → tutte le sue schede, prima quelle del bisogno
// plan: piano che comprende lo strumento (solo per gli strumenti del Marketplace)
export type HomeNeedItem = { name: string; title: string; description: string; href: string; iconName: string; plan?: RequiredPlan; links?: { title: string; href: string; plan?: RequiredPlan }[] }
// short: etichetta breve per la versione compatta in dashboard
export type HomeNeed = { key: HomeNeedKey; icon: string; label: string; short: string; intro: string; items: HomeNeedItem[] }

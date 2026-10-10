// Homepage: «In cosa possiamo darti una mano?». Ogni bisogno porta a pochi servizi
// (pagine pubbliche /strumenti/<servizio>, più Eventi e KUMANI Sorpresa).
// Testi dei bisogni nel namespace "homeNeeds"; nomi e descrizioni dei
// servizi sono quelli del Marketplace.

export const HOME_NEEDS = [
  { key: 'scams', icon: 'ShieldCheck', items: ['antitruffa', 'checkmail', 'verifica-iban', 'svat', 'verifoto', 'scudo-dati', 'documento-sicuro'] },
  { key: 'organize', icon: 'CalendarDays', items: ['life-calendar', 'memolife', 'focus', 'travel', 'findo'] },
  { key: 'money', icon: 'PiggyBank', items: ['spendly', 'fincheck', 'casa', 'garage', 'digital-receipt'] },
  { key: 'business', icon: 'Store', items: ['landing-page', 'shop', 'menu', 'fidelity', 'offermaker', 'listings'] },
  { key: 'promote', icon: 'Megaphone', items: ['qr-generator', 'qr-code-pro', 'link-in-bio', 'whatsapp-messages', 'firma-email', 'spotlight'] },
  { key: 'work', icon: 'BriefcaseBusiness', items: ['trova-lavoro', 'kumani-cv', 'preventivi', 'magazzino', 'calcolatrici'] },
  { key: 'people', icon: 'Users', items: ['affinity', 'events', 'timebank', 'convivio'] },
  { key: 'games', icon: 'Gamepad2', items: ['nexus', 'veritas', 'fabula', 'mosaic'] },
  { key: 'relax', icon: 'Leaf', items: ['neurobalance', 'oxygen', 'mandala', 'aureya'] },
  { key: 'gift', icon: 'Gift', items: ['sorprese'] },
] as const

export type HomeNeedKey = (typeof HOME_NEEDS)[number]['key']
export type HomeNeedItem = { name: string; title: string; description: string; href: string; iconName: string }
// short: etichetta breve per la versione compatta in dashboard
export type HomeNeed = { key: HomeNeedKey; icon: string; label: string; short: string; intro: string; items: HomeNeedItem[] }

// Homepage: «In cosa possiamo darti una mano?». Ogni bisogno porta a pochi servizi
// (pagine pubbliche /strumenti/<servizio>, più Eventi e KUMANI Sorpresa).
// Testi dei bisogni nel namespace "homeNeeds"; nomi e descrizioni dei
// servizi sono quelli del Marketplace.

export const HOME_NEEDS = [
  { key: 'scams', icon: 'ShieldCheck', items: ['antitruffa', 'checkmail', 'verifica-iban', 'scudo-dati'] },
  { key: 'organize', icon: 'CalendarDays', items: ['life-calendar', 'memolife', 'focus'] },
  { key: 'money', icon: 'PiggyBank', items: ['spendly', 'fincheck', 'casa', 'garage'] },
  { key: 'business', icon: 'Store', items: ['landing-page', 'shop', 'fidelity', 'qr-code-pro'] },
  { key: 'work', icon: 'BriefcaseBusiness', items: ['trova-lavoro', 'kumani-cv', 'preventivi'] },
  { key: 'people', icon: 'Users', items: ['affinity', 'events', 'veritas'] },
  { key: 'relax', icon: 'Leaf', items: ['neurobalance', 'oxygen', 'mandala'] },
  { key: 'gift', icon: 'Gift', items: ['sorprese'] },
] as const

export type HomeNeedKey = (typeof HOME_NEEDS)[number]['key']
export type HomeNeedItem = { name: string; title: string; description: string; href: string; iconName: string }
// short: etichetta breve per la versione compatta in dashboard
export type HomeNeed = { key: HomeNeedKey; icon: string; label: string; short: string; intro: string; items: HomeNeedItem[] }

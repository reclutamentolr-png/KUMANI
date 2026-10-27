// Schede che girano attorno al logo nella Home (HeroOrbit) e le quattro fisse
// del telefono: un esempio concreto per ogni servizio, di tutte le categorie.
// `tool`: il servizio a cui si riferisce. Se l'Admin lo spegne (anche «Solo
// Staff») la scheda non compare; quando lo accende compare da sola. Senza
// `tool`: sempre visibile (truffe scoperte, Sorprese). Testi in homeOrbit.<key>Title/Text.

export type OrbitCategory = 'security' | 'personal' | 'lavoro' | 'marketing' | 'wellness' | 'svago' | 'community' | 'bambini'

export type OrbitEntry = { key: string; cat: OrbitCategory; tool?: string }

// Ordine delle categorie quando si alternano le schede
const CATEGORY_ORDER: OrbitCategory[] = ['security', 'personal', 'community', 'lavoro', 'wellness', 'marketing', 'svago', 'bambini']

export const ORBIT_ENTRIES: OrbitEntry[] = [
  // Sicurezza (le truffe scoperte sono in rosso)
  { key: 'scamSms', cat: 'security' },
  { key: 'scamIban', cat: 'security' },
  { key: 'scamSite', cat: 'security' },
  { key: 'scamCall', cat: 'security' },
  { key: 'data', cat: 'security', tool: 'scudo-dati' },
  { key: 'checkmail', cat: 'security', tool: 'checkmail' },
  { key: 'svat', cat: 'security', tool: 'svat' },
  { key: 'verifoto', cat: 'security', tool: 'verifoto' },
  { key: 'docSafe', cat: 'security', tool: 'documento-sicuro' },
  { key: 'scamGuide', cat: 'security', tool: 'antitruffa' },
  { key: 'textShield', cat: 'security', tool: 'testo-protetto' },
  { key: 'scamCards', cat: 'security', tool: 'carte-antitruffa' },
  // Vita di tutti i giorni
  { key: 'spendly', cat: 'personal', tool: 'spendly' },
  { key: 'deadlines', cat: 'personal', tool: 'life-calendar' },
  { key: 'agenda', cat: 'personal', tool: 'memolife' },
  { key: 'home', cat: 'personal', tool: 'casa' },
  { key: 'travel', cat: 'personal', tool: 'travel' },
  { key: 'findo', cat: 'personal', tool: 'findo' },
  { key: 'family', cat: 'personal', tool: 'spendly' },
  { key: 'garage', cat: 'personal', tool: 'garage' },
  { key: 'fincheck', cat: 'personal', tool: 'fincheck' },
  { key: 'hopla', cat: 'personal', tool: 'hopla' },
  { key: 'idPhoto', cat: 'personal', tool: 'fototessera' },
  // Community
  { key: 'events', cat: 'community', tool: 'events' },
  { key: 'timebank', cat: 'community', tool: 'timebank' },
  { key: 'board', cat: 'community', tool: 'listings' },
  { key: 'proposals', cat: 'community', tool: 'proposte' },
  { key: 'spotlight', cat: 'community', tool: 'spotlight' },
  // Lavoro
  { key: 'cv', cat: 'lavoro', tool: 'kumani-cv' },
  { key: 'quote', cat: 'lavoro', tool: 'preventivi' },
  { key: 'jobs', cat: 'lavoro', tool: 'trova-lavoro' },
  { key: 'clients', cat: 'lavoro', tool: 'clienti' },
  { key: 'signPdf', cat: 'lavoro', tool: 'firma-pdf' },
  { key: 'receipts', cat: 'lavoro', tool: 'digital-receipt' },
  { key: 'stock', cat: 'lavoro', tool: 'magazzino' },
  { key: 'calc', cat: 'lavoro', tool: 'calcolatrici' },
  { key: 'scanner', cat: 'lavoro', tool: 'scanner' },
  { key: 'tempus', cat: 'lavoro', tool: 'tempus' },
  // Benessere
  { key: 'breathe', cat: 'wellness', tool: 'oxygen' },
  { key: 'sleepSounds', cat: 'wellness', tool: 'neurobalance' },
  { key: 'focus', cat: 'wellness', tool: 'focus' },
  { key: 'chrono', cat: 'wellness', tool: 'cronobioma' },
  { key: 'hearing', cat: 'wellness', tool: 'aureya' },
  { key: 'mandala', cat: 'wellness', tool: 'mandala' },
  // Per chi ha un'attività
  { key: 'menu', cat: 'marketing', tool: 'menu' },
  { key: 'landing', cat: 'marketing', tool: 'landing-page' },
  { key: 'loyalty', cat: 'marketing', tool: 'fidelity' },
  { key: 'shop', cat: 'marketing', tool: 'shop' },
  { key: 'linkBio', cat: 'marketing', tool: 'link-in-bio' },
  { key: 'qrPro', cat: 'marketing', tool: 'qr-code-pro' },
  { key: 'emailSign', cat: 'marketing', tool: 'firma-email' },
  { key: 'tutela', cat: 'marketing', tool: 'tutela' },
  { key: 'captio', cat: 'marketing', tool: 'captio' },
  { key: 'diarium', cat: 'marketing', tool: 'diarium' },
  { key: 'imago', cat: 'marketing', tool: 'imago' },
  { key: 'forma', cat: 'marketing', tool: 'forma' },
  { key: 'vox', cat: 'marketing', tool: 'vox' },
  { key: 'lumen', cat: 'marketing', tool: 'lumen' },
  { key: 'offer', cat: 'marketing', tool: 'offermaker' },
  // Svago
  { key: 'crossword', cat: 'svago', tool: 'nexus' },
  { key: 'surprise', cat: 'svago' },
  { key: 'evening', cat: 'svago', tool: 'convivium' },
  { key: 'affinity', cat: 'svago', tool: 'affinity' },
  { key: 'liar', cat: 'svago', tool: 'veritas' },
  { key: 'story', cat: 'svago', tool: 'fabula' },
  { key: 'mosaic', cat: 'svago', tool: 'mosaic' },
  // Bambini
  { key: 'kids', cat: 'bambini', tool: 'angolo-bambini' },
]

// Schede dei servizi accesi, alternando le categorie (una di ognuna a turno),
// con un punto di partenza che cambia ogni giorno: così passano tutte
export function orbitEntries(disabled: string[], day = new Date()): OrbitEntry[] {
  const off = new Set(disabled)
  const groups = CATEGORY_ORDER.map((cat) => ORBIT_ENTRIES.filter((e) => e.cat === cat && !(e.tool && off.has(e.tool))))
  const mixed: OrbitEntry[] = []
  for (let i = 0; groups.some((g) => i < g.length); i++) for (const g of groups) if (i < g.length) mixed.push(g[i])
  if (!mixed.length) return mixed
  const start = Math.floor(day.getTime() / 86_400_000) % CATEGORY_ORDER.length
  // Si parte da una categoria diversa ogni giorno, senza spezzare l'alternanza
  return [...mixed.slice(start), ...mixed.slice(0, start)]
}

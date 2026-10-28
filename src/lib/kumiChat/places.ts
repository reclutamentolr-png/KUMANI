// Chiedi a KUMI: i posti del sito dove può comparire. L'Admin li accende uno
// per uno (system_settings.kumi_chat.places). Pagine pubbliche: le vedono
// visitatori e Staff. Area iscritti: con la chat «Accesa» la vedono anche gli
// iscritti, solo lì. Admin, traduttori e agenti: mai.

export type KumiPlaceGroup = 'public' | 'member'
export type KumiPlace = { id: string; group: KumiPlaceGroup; label: string; hint: string; paths: string[] }

export const KUMI_PLACES: KumiPlace[] = [
  { id: 'home', group: 'public', label: 'Home pubblica', hint: 'kumani.io, la prima pagina per chi arriva', paths: ['/'] },
  { id: 'catalog', group: 'public', label: 'Catalogo, offerte e prezzi', hint: '/catalogo, /offerte, /pro, /strumenti, /pass', paths: ['/catalogo', '/offerte', '/pro', '/strumenti', '/pass'] },
  { id: 'about', group: 'public', label: 'Chi siamo, contatti, donazioni, recensioni', hint: '/chi-siamo, /contact, /donazioni, /recensioni, /rewards', paths: ['/chi-siamo', '/contact', '/donazioni', '/recensioni', '/rewards'] },
  { id: 'guides', group: 'public', label: 'Guide «Come si usa»', hint: '/guida', paths: ['/guida'] },
  { id: 'antiscam', group: 'public', label: 'Pagine antitruffa pubbliche', hint: 'Manuale, Carte Antitruffa, Test truffa, Controlla', paths: ['/manuale-antitruffa', '/carte', '/test-truffa', '/controlla'] },
  { id: 'auth', group: 'public', label: 'Accesso e iscrizione', hint: '/login, /register, password dimenticata', paths: ['/login', '/register', '/forgot-password', '/reset-password'] },
  { id: 'legal', group: 'public', label: 'Privacy e Termini', hint: '/privacy, /terms', paths: ['/privacy', '/terms'] },
  { id: 'shared', group: 'public', label: 'Pagine pubbliche degli iscritti e tutte le altre', hint: 'Link in Bio, CV, negozi, prenotazioni, eventi, webinar, inviti, regali…', paths: [] },
  { id: 'dashboard', group: 'member', label: 'Home degli iscritti e pagine personali', hint: 'Dashboard, Servizi, Wallet, Community, Documenti, Avvisi, Scheda attività', paths: ['/dashboard', '/servizi', '/wallet', '/community', '/documenti', '/avvisi', '/messaggio', '/scheda-attivita', '/calendario-collegato'] },
  { id: 'tools', group: 'member', label: 'Dentro i servizi', hint: 'Tutte le pagine /app/… (MemoLife, Spese, Speculum…)', paths: ['/app'] },
]

// Mai: pagine di lavoro dello Staff e di chi collabora
const NEVER = ['/admin', '/traduzioni', '/agente', '/maintenance', '/in-arrivo']

// All'inizio: tutte le pagine pubbliche sì (come prima), area iscritti no
export const DEFAULT_PLACES: Record<string, boolean> = Object.fromEntries(KUMI_PLACES.map((p) => [p.id, p.group === 'public']))

const starts = (path: string, p: string) => (p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`))

// Posto di una pagina (indirizzo senza la lingua); null = mai
export function kumiPlaceOf(path: string): KumiPlace | null {
  if (NEVER.some((p) => starts(path, p))) return null
  return KUMI_PLACES.find((place) => place.paths.some((p) => starts(path, p))) ?? KUMI_PLACES.find((p) => p.id === 'shared')!
}

export function cleanPlaces(raw: unknown): Record<string, boolean> {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Object.fromEntries(KUMI_PLACES.map((p) => [p.id, typeof v[p.id] === 'boolean' ? (v[p.id] as boolean) : DEFAULT_PLACES[p.id]]))
}

export const memberPlacesOn = (places: Record<string, boolean>) => KUMI_PLACES.some((p) => p.group === 'member' && places[p.id])

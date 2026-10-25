// Servizi uniti: più strumenti simili mostrati come un servizio solo, con le
// schede. Sicurezza: Controlla (Speculum), Proteggi (Scudo Dati), Segnala
// (Rete Anti-Truffa); poi KUMANI Benessere, KUMANI Giochi, QR Code, Spendly,
// KUMANI Lavoro (CV e offerte), Gestione attività (clienti, preventivi, ricevute,
// magazzino, calcolatrici), KUMANI Ufficio (Firma PDF, Scanner e PDF, Firma Email, Hoplà),
// KUMANI Negozio (Shop, Menu, Kumi Card e OfferMaker, se acceso), Farti conoscere (Link in
// Bio, Landing Page, Messaggi WhatsApp), KUMANI Agenda (MemoLife, Life
// Calendar), Casa e auto (Casa, Garage, Findo), Viaggi (Travel) e Amicizie
// (Convivium, Affinity). Gli strumenti
// restano dove sono (indirizzi, piani, KU Karma, guide e volantini non
// cambiano): il servizio li raccoglie come schede, con una barra comune in
// cima, e negli elenchi (Home, Catalogo, Servizi, Dashboard) è una voce sola.
// Per unirne altri: aggiungere qui il servizio, le sue schede e il gruppo.

export const SERVICE_HUBS = ['controlla', 'proteggi', 'segnala', 'benessere', 'giochi', 'qr', 'spendly', 'lavoro', 'gestione', 'ufficio', 'negozio', 'vetrina', 'social', 'agenda', 'casaauto', 'viaggi', 'amicizie'] as const
export type ServiceHub = (typeof SERVICE_HUBS)[number]

// planTool: lo strumento da cui prendere il piano (Free/Plus/Pro) quando la
// scheda non è uno strumento a sé; plan: piano fisso (es. pagine pubbliche)
export type HubTab = { key: string; href: string; tool: string | null; planTool?: string; plan?: 'free' }

export const HUB_TABS: Record<ServiceHub, HubTab[]> = {
  controlla: [
    { key: 'all', href: '/controlla', tool: null },
    { key: 'site', href: '/app/svat', tool: 'svat' },
    { key: 'email', href: '/app/checkmail', tool: 'checkmail' },
    { key: 'photo', href: '/app/verifoto', tool: 'verifoto' },
    { key: 'iban', href: '/app/verifica-iban', tool: 'verifica-iban' },
    { key: 'phone', href: '/app/rete-antitruffa?tab=numero', tool: 'rete-antitruffa' },
  ],
  proteggi: [
    { key: 'data', href: '/app/scudo-dati', tool: 'scudo-dati' },
    { key: 'documents', href: '/app/documento-sicuro', tool: 'documento-sicuro' },
    { key: 'text', href: '/app/testo-protetto', tool: 'testo-protetto' },
  ],
  segnala: [
    { key: 'network', href: '/app/rete-antitruffa', tool: 'rete-antitruffa' },
    { key: 'manual', href: '/app/antitruffa', tool: 'antitruffa' },
    // «Mi stanno truffando?»: il test, pubblico
    { key: 'test', href: '/test-truffa', tool: null, plan: 'free' },
  ],
  benessere: [
    { key: 'sounds', href: '/app/neurobalance', tool: 'neurobalance' },
    { key: 'breathe', href: '/app/oxygen', tool: 'oxygen' },
    { key: 'focus', href: '/app/focus', tool: 'focus' },
    { key: 'mandala', href: '/app/mandala', tool: 'mandala' },
    { key: 'senses', href: '/app/aureya', tool: 'aureya' },
    { key: 'rhythm', href: '/app/cronobioma', tool: 'cronobioma' },
  ],
  giochi: [
    { key: 'crossword', href: '/app/nexus', tool: 'nexus' },
    { key: 'veritas', href: '/app/veritas', tool: 'veritas' },
    { key: 'fabula', href: '/app/fabula', tool: 'fabula' },
    { key: 'mosaic', href: '/app/mosaic', tool: 'mosaic' },
  ],
  qr: [
    { key: 'invite', href: '/app/qr-generator', tool: 'qr-generator' },
    { key: 'pro', href: '/app/qr-code-pro', tool: 'qr-code-pro' },
  ],
  // Le Spese condivise non sono uno strumento a sé (aperte anche agli invitati)
  spendly: [
    { key: 'accounts', href: '/app/spendly', tool: 'spendly' },
    { key: 'checkup', href: '/app/fincheck', tool: 'fincheck' },
    // Creare un gruppo richiede Spendly; chi è invitato entra gratis
    { key: 'shared', href: '/spese-condivise', tool: null, planTool: 'spendly' },
  ],
  lavoro: [
    { key: 'jobs', href: '/app/trova-lavoro', tool: 'trova-lavoro' },
    { key: 'cv', href: '/app/kumani-cv', tool: 'kumani-cv' },
  ],
  // Già collegati: preventivo accettato → lavoro → pagamento → ricevuta
  gestione: [
    { key: 'clients', href: '/app/clienti', tool: 'clienti' },
    { key: 'tempus', href: '/app/tempus', tool: 'tempus' },
    { key: 'quotes', href: '/app/preventivi', tool: 'preventivi' },
    { key: 'receipts', href: '/app/digital-receipt', tool: 'digital-receipt' },
    { key: 'warehouse', href: '/app/magazzino', tool: 'magazzino' },
    { key: 'calculators', href: '/app/calcolatrici', tool: 'calcolatrici' },
  ],
  ufficio: [
    { key: 'pdf', href: '/app/firma-pdf', tool: 'firma-pdf' },
    { key: 'scanner', href: '/app/scanner', tool: 'scanner' },
    { key: 'email', href: '/app/firma-email', tool: 'firma-email' },
    { key: 'hopla', href: '/app/hopla', tool: 'hopla' },
  ],
  negozio: [
    { key: 'shop', href: '/app/shop', tool: 'shop' },
    { key: 'menu', href: '/app/menu', tool: 'menu' },
    { key: 'card', href: '/app/fidelity', tool: 'fidelity' },
    { key: 'offers', href: '/app/offermaker', tool: 'offermaker' },
  ],
  vetrina: [
    { key: 'bio', href: '/app/link-in-bio', tool: 'link-in-bio' },
    { key: 'landing', href: '/app/landing-page', tool: 'landing-page' },
    { key: 'whatsapp', href: '/app/whatsapp-messages', tool: 'whatsapp-messages' },
  ],
  // Il kit per chi inizia sui social
  social: [
    { key: 'tutela', href: '/app/tutela', tool: 'tutela' },
    { key: 'captio', href: '/app/captio', tool: 'captio' },
    { key: 'lumen', href: '/app/lumen', tool: 'lumen' },
    { key: 'vox', href: '/app/vox', tool: 'vox' },
    { key: 'diarium', href: '/app/diarium', tool: 'diarium' },
    { key: 'imago', href: '/app/imago', tool: 'imago' },
    { key: 'forma', href: '/app/forma', tool: 'forma' },
  ],
  agenda: [
    { key: 'agenda', href: '/app/memolife', tool: 'memolife' },
    { key: 'deadlines', href: '/app/life-calendar', tool: 'life-calendar' },
  ],
  casaauto: [
    { key: 'home', href: '/app/casa', tool: 'casa' },
    { key: 'car', href: '/app/garage', tool: 'garage' },
    { key: 'findo', href: '/app/findo', tool: 'findo' },
  ],
  // Per ora un servizio solo ciascuno: qui si aggiungeranno gli altri
  viaggi: [{ key: 'trips', href: '/viaggi', tool: 'travel' }],
  amicizie: [
    { key: 'convivium', href: '/convivium', tool: 'convivium' },
    { key: 'affinity', href: '/app/affinity', tool: 'affinity' },
  ],
}

// Gruppo della pagina Servizi in cui sta ciascun servizio unito
export const HUB_GROUP: Record<ServiceHub, string> = { controlla: 'security', proteggi: 'security', segnala: 'security', benessere: 'wellness', giochi: 'fun', qr: 'business', spendly: 'money', lavoro: 'work', gestione: 'work', ufficio: 'work', negozio: 'business', vetrina: 'business', social: 'social', agenda: 'money', casaauto: 'money', viaggi: 'money', amicizie: 'fun' }

// Servizio di partenza di ciascuno (la prima scheda)
export const HUB_HOME: Record<ServiceHub, string> = {
  controlla: '/controlla',
  proteggi: '/app/scudo-dati',
  segnala: '/app/rete-antitruffa',
  benessere: '/app/neurobalance',
  giochi: '/app/nexus',
  qr: '/app/qr-generator',
  spendly: '/app/spendly',
  lavoro: '/app/trova-lavoro',
  gestione: '/app/clienti',
  ufficio: '/app/firma-pdf',
  negozio: '/app/shop',
  vetrina: '/app/link-in-bio',
  social: '/app/tutela',
  agenda: '/app/memolife',
  casaauto: '/app/casa',
  viaggi: '/viaggi',
  amicizie: '/convivium',
}

// Strumenti raccolti nei servizi uniti
export const HUB_TOOLS = new Set(Object.values(HUB_TABS).flatMap((tabs) => tabs.map((t) => t.tool).filter((t): t is string => !!t)))

// Pagina aperta → servizio e scheda. La Rete Anti-Truffa sta in Segnala;
// «Chi mi ha chiamato?» (?tab=numero) è anche il controllo dei numeri.
export function hubOf(path: string, search: string): { hub: ServiceHub; tab: string } | null {
  const bare = path.replace(/^\/(it|en|fr|es|pt|de|ru)(?=\/|$)/, '') || '/'
  if (bare === '/controlla') return { hub: 'controlla', tab: 'all' }
  if (/\/(print|tent)$/.test(bare)) return null
  if (bare.startsWith('/app/rete-antitruffa')) return new URLSearchParams(search).get('tab') === 'numero' ? { hub: 'controlla', tab: 'phone' } : { hub: 'segnala', tab: 'network' }
  for (const hub of SERVICE_HUBS)
    for (const tab of HUB_TABS[hub]) if ((tab.tool || tab.key !== 'all') && bare.startsWith(tab.href.split('?')[0])) return { hub, tab: tab.key }
  return null
}

// ── Elenchi dei servizi (Home, Catalogo, Dashboard): gli strumenti uniti si
// mostrano come il loro servizio. Ogni strumento appartiene a un servizio solo.
export const TOOL_HUB: Record<string, ServiceHub> = {
  svat: 'controlla',
  checkmail: 'controlla',
  verifoto: 'controlla',
  'verifica-iban': 'controlla',
  'scudo-dati': 'proteggi',
  'documento-sicuro': 'proteggi',
  'testo-protetto': 'proteggi',
  'rete-antitruffa': 'segnala',
  antitruffa: 'segnala',
  neurobalance: 'benessere',
  oxygen: 'benessere',
  focus: 'benessere',
  mandala: 'benessere',
  aureya: 'benessere',
  cronobioma: 'benessere',
  nexus: 'giochi',
  veritas: 'giochi',
  fabula: 'giochi',
  mosaic: 'giochi',
  'qr-generator': 'qr',
  'qr-code-pro': 'qr',
  spendly: 'spendly',
  fincheck: 'spendly',
  'trova-lavoro': 'lavoro',
  'kumani-cv': 'lavoro',
  clienti: 'gestione',
  tempus: 'gestione',
  preventivi: 'gestione',
  'digital-receipt': 'gestione',
  magazzino: 'gestione',
  calcolatrici: 'gestione',
  'firma-pdf': 'ufficio',
  scanner: 'ufficio',
  'firma-email': 'ufficio',
  hopla: 'ufficio',
  shop: 'negozio',
  menu: 'negozio',
  fidelity: 'negozio',
  offermaker: 'negozio',
  'link-in-bio': 'vetrina',
  'landing-page': 'vetrina',
  'whatsapp-messages': 'vetrina',
  lumen: 'social',
  vox: 'social',
  captio: 'social',
  diarium: 'social',
  imago: 'social',
  forma: 'social',
  tutela: 'social',
  memolife: 'agenda',
  'life-calendar': 'agenda',
  casa: 'casaauto',
  garage: 'casaauto',
  findo: 'casaauto',
  travel: 'viaggi',
  affinity: 'amicizie',
  convivium: 'amicizie',
}

// Icone già presenti in lib/marketplaceIcons
export const HUB_ICON_NAME: Record<ServiceHub, string> = { controlla: 'ScanEye', proteggi: 'ShieldCheck', segnala: 'ShieldAlert', benessere: 'Flower2', giochi: 'Dices', qr: 'QrCode', spendly: 'PiggyBank', lavoro: 'Briefcase', gestione: 'BookUser', ufficio: 'Signature', negozio: 'Store', vetrina: 'PanelsTopLeft', social: 'Share2', agenda: 'CalendarClock', casaauto: 'House', viaggi: 'Plane', amicizie: 'HeartHandshake' }

// Pagine aperte a tutti (Catalogo pubblico)
export const HUB_PUBLIC_HREF: Record<ServiceHub, string> = {
  controlla: '/controlla',
  proteggi: '/strumenti/scudo-dati',
  segnala: '/strumenti/rete-antitruffa',
  benessere: '/strumenti/neurobalance',
  giochi: '/strumenti/nexus',
  qr: '/strumenti/qr-code-pro',
  spendly: '/strumenti/spendly',
  lavoro: '/strumenti/trova-lavoro',
  gestione: '/strumenti/clienti',
  ufficio: '/strumenti/firma-pdf',
  negozio: '/strumenti/shop',
  vetrina: '/strumenti/link-in-bio',
  social: '/strumenti/tutela',
  agenda: '/strumenti/memolife',
  casaauto: '/strumenti/casa',
  viaggi: '/strumenti/travel',
  amicizie: '/strumenti/convivium',
}

// Un rappresentante per servizio (per contare i servizi come la Home)
export const HUB_REPRESENTATIVE: Record<ServiceHub, string> = { controlla: 'verifica-iban', proteggi: 'scudo-dati', segnala: 'rete-antitruffa', benessere: 'neurobalance', giochi: 'nexus', qr: 'qr-code-pro', spendly: 'spendly', lavoro: 'trova-lavoro', gestione: 'clienti', ufficio: 'firma-pdf', negozio: 'shop', vetrina: 'link-in-bio', social: 'tutela', agenda: 'memolife', casaauto: 'casa', viaggi: 'travel', amicizie: 'convivium' }

// Nome della scheda di uno strumento nel suo servizio («Email», «IBAN»…)
export function hubTabKey(toolName: string): string | null {
  const hub = TOOL_HUB[toolName]
  return hub ? (HUB_TABS[hub].find((tab) => tab.tool === toolName)?.key ?? null) : null
}

// Sostituisce gli strumenti di ogni servizio unito con il servizio, nella
// posizione del primo; make riceve gli strumenti presenti di quel servizio
export function collapseByHub<T extends { toolName: string }>(items: T[], make: (hub: ServiceHub, members: T[]) => T | null): T[] {
  const out: T[] = []
  const done = new Set<ServiceHub>()
  for (const item of items) {
    const hub = TOOL_HUB[item.toolName]
    if (!hub) {
      out.push(item)
      continue
    }
    if (done.has(hub)) continue
    done.add(hub)
    const made = make(
      hub,
      items.filter((i) => TOOL_HUB[i.toolName] === hub)
    )
    if (made) out.push(made)
  }
  return out
}

// «Speculum · Sito e P.IVA, Email, Foto»: le schede presenti tra questi strumenti
export function hubLabel(hub: ServiceHub, toolNames: string[], t: (key: string) => string): string {
  const tabs = HUB_TABS[hub].filter((tab) => tab.tool && toolNames.includes(tab.tool) && TOOL_HUB[tab.tool] === hub).map((tab) => t(`${hub}.tab_${tab.key}`))
  return tabs.length ? `${t(`${hub}.title`)} · ${tabs.join(', ')}` : t(`${hub}.title`)
}

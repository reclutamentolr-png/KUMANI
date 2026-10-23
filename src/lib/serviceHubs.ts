// Servizi uniti: più strumenti simili mostrati come un servizio solo, con le
// schede. Sicurezza: Controlla (Speculum), Proteggi (Scudo Dati), Segnala
// (Rete Anti-Truffa); poi KUMANI Benessere, KUMANI Giochi, QR Code, Spendly,
// KUMANI Lavoro (CV e offerte), Gestione attività (clienti, preventivi, ricevute,
// magazzino, calcolatrici), KUMANI Ufficio (Firma PDF, Firma Email, Hoplà),
// KUMANI Negozio (Shop, Menu, Kumi Card e OfferMaker, se acceso), Farti conoscere (Link in
// Bio, Landing Page, Messaggi WhatsApp), KUMANI Agenda (MemoLife, Life
// Calendar), Casa e auto (Casa, Garage, Findo), Viaggi (Travel) e Amicizie
// (Convivium, Affinity). Gli strumenti
// restano dove sono (indirizzi, piani, KU Karma, guide e volantini non
// cambiano): il servizio li raccoglie come schede, con una barra comune in
// cima, e negli elenchi (Home, Catalogo, Servizi, Dashboard) è una voce sola.
// Per unirne altri: aggiungere qui il servizio, le sue schede e il gruppo.

export const SERVICE_HUBS = ['controlla', 'proteggi', 'segnala', 'benessere', 'giochi', 'qr', 'spendly', 'lavoro', 'gestione', 'ufficio', 'negozio', 'vetrina', 'agenda', 'casaauto', 'viaggi', 'amicizie'] as const
export type ServiceHub = (typeof SERVICE_HUBS)[number]

// planTool: lo strumento da cui prendere il piano (Free/Base/Pro) quando la
// scheda non è uno strumento a sé; plan: piano fisso (es. pagine pubbliche)
export type HubTab = { key: string; href: string; tool: string | null; planTool?: string; plan?: 'free' }

export const HUB_TABS: Record<ServiceHub, HubTab[]> = {
  controlla: [
    { key: 'all', href: '/controlla', tool: null },
    { key: 'site', href: '/marketplace/svat', tool: 'svat' },
    { key: 'email', href: '/marketplace/checkmail', tool: 'checkmail' },
    { key: 'photo', href: '/marketplace/verifoto', tool: 'verifoto' },
    { key: 'iban', href: '/marketplace/verifica-iban', tool: 'verifica-iban' },
    { key: 'phone', href: '/marketplace/rete-antitruffa?tab=numero', tool: 'rete-antitruffa' },
  ],
  proteggi: [
    { key: 'data', href: '/marketplace/scudo-dati', tool: 'scudo-dati' },
    { key: 'documents', href: '/marketplace/documento-sicuro', tool: 'documento-sicuro' },
  ],
  segnala: [
    { key: 'network', href: '/marketplace/rete-antitruffa', tool: 'rete-antitruffa' },
    { key: 'manual', href: '/marketplace/antitruffa', tool: 'antitruffa' },
    // «Mi stanno truffando?»: il test, pubblico
    { key: 'test', href: '/test-truffa', tool: null, plan: 'free' },
  ],
  benessere: [
    { key: 'sounds', href: '/marketplace/neurobalance', tool: 'neurobalance' },
    { key: 'breathe', href: '/marketplace/oxygen', tool: 'oxygen' },
    { key: 'focus', href: '/marketplace/focus', tool: 'focus' },
    { key: 'mandala', href: '/marketplace/mandala', tool: 'mandala' },
    { key: 'senses', href: '/marketplace/aureya', tool: 'aureya' },
  ],
  giochi: [
    { key: 'crossword', href: '/marketplace/nexus', tool: 'nexus' },
    { key: 'veritas', href: '/marketplace/veritas', tool: 'veritas' },
    { key: 'fabula', href: '/marketplace/fabula', tool: 'fabula' },
    { key: 'mosaic', href: '/marketplace/mosaic', tool: 'mosaic' },
  ],
  qr: [
    { key: 'invite', href: '/marketplace/qr-generator', tool: 'qr-generator' },
    { key: 'pro', href: '/marketplace/qr-code-pro', tool: 'qr-code-pro' },
  ],
  // Le Spese condivise non sono uno strumento a sé (aperte anche agli invitati)
  spendly: [
    { key: 'accounts', href: '/marketplace/spendly', tool: 'spendly' },
    { key: 'checkup', href: '/marketplace/fincheck', tool: 'fincheck' },
    // Creare un gruppo richiede Spendly; chi è invitato entra gratis
    { key: 'shared', href: '/spese-condivise', tool: null, planTool: 'spendly' },
  ],
  lavoro: [
    { key: 'jobs', href: '/marketplace/trova-lavoro', tool: 'trova-lavoro' },
    { key: 'cv', href: '/marketplace/kumani-cv', tool: 'kumani-cv' },
  ],
  // Già collegati: preventivo accettato → lavoro → pagamento → ricevuta
  gestione: [
    { key: 'clients', href: '/marketplace/clienti', tool: 'clienti' },
    { key: 'quotes', href: '/marketplace/preventivi', tool: 'preventivi' },
    { key: 'receipts', href: '/marketplace/digital-receipt', tool: 'digital-receipt' },
    { key: 'warehouse', href: '/marketplace/magazzino', tool: 'magazzino' },
    { key: 'calculators', href: '/marketplace/calcolatrici', tool: 'calcolatrici' },
  ],
  ufficio: [
    { key: 'pdf', href: '/marketplace/firma-pdf', tool: 'firma-pdf' },
    { key: 'email', href: '/marketplace/firma-email', tool: 'firma-email' },
    { key: 'hopla', href: '/marketplace/hopla', tool: 'hopla' },
  ],
  negozio: [
    { key: 'shop', href: '/marketplace/shop', tool: 'shop' },
    { key: 'menu', href: '/marketplace/menu', tool: 'menu' },
    { key: 'card', href: '/marketplace/fidelity', tool: 'fidelity' },
    { key: 'offers', href: '/marketplace/offermaker', tool: 'offermaker' },
  ],
  vetrina: [
    { key: 'bio', href: '/marketplace/link-in-bio', tool: 'link-in-bio' },
    { key: 'landing', href: '/marketplace/landing-page', tool: 'landing-page' },
    { key: 'whatsapp', href: '/marketplace/whatsapp-messages', tool: 'whatsapp-messages' },
    { key: 'lumen', href: '/marketplace/lumen', tool: 'lumen' },
    { key: 'vox', href: '/marketplace/vox', tool: 'vox' },
    { key: 'captio', href: '/marketplace/captio', tool: 'captio' },
    { key: 'diarium', href: '/marketplace/diarium', tool: 'diarium' },
    { key: 'imago', href: '/marketplace/imago', tool: 'imago' },
    { key: 'forma', href: '/marketplace/forma', tool: 'forma' },
    { key: 'tutela', href: '/marketplace/tutela', tool: 'tutela' },
  ],
  agenda: [
    { key: 'agenda', href: '/marketplace/memolife', tool: 'memolife' },
    { key: 'deadlines', href: '/marketplace/life-calendar', tool: 'life-calendar' },
  ],
  casaauto: [
    { key: 'home', href: '/marketplace/casa', tool: 'casa' },
    { key: 'car', href: '/marketplace/garage', tool: 'garage' },
    { key: 'findo', href: '/marketplace/findo', tool: 'findo' },
  ],
  // Per ora un servizio solo ciascuno: qui si aggiungeranno gli altri
  viaggi: [{ key: 'trips', href: '/viaggi', tool: 'travel' }],
  amicizie: [
    { key: 'convivium', href: '/convivium', tool: 'convivium' },
    { key: 'affinity', href: '/marketplace/affinity', tool: 'affinity' },
  ],
}

// Gruppo della pagina Servizi in cui sta ciascun servizio unito
export const HUB_GROUP: Record<ServiceHub, string> = { controlla: 'security', proteggi: 'security', segnala: 'security', benessere: 'wellness', giochi: 'fun', qr: 'business', spendly: 'money', lavoro: 'work', gestione: 'work', ufficio: 'work', negozio: 'business', vetrina: 'business', agenda: 'money', casaauto: 'money', viaggi: 'money', amicizie: 'fun' }

// Servizio di partenza di ciascuno (la prima scheda)
export const HUB_HOME: Record<ServiceHub, string> = {
  controlla: '/controlla',
  proteggi: '/marketplace/scudo-dati',
  segnala: '/marketplace/rete-antitruffa',
  benessere: '/marketplace/neurobalance',
  giochi: '/marketplace/nexus',
  qr: '/marketplace/qr-generator',
  spendly: '/marketplace/spendly',
  lavoro: '/marketplace/trova-lavoro',
  gestione: '/marketplace/clienti',
  ufficio: '/marketplace/firma-pdf',
  negozio: '/marketplace/shop',
  vetrina: '/marketplace/link-in-bio',
  agenda: '/marketplace/memolife',
  casaauto: '/marketplace/casa',
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
  if (bare.startsWith('/marketplace/rete-antitruffa')) return new URLSearchParams(search).get('tab') === 'numero' ? { hub: 'controlla', tab: 'phone' } : { hub: 'segnala', tab: 'network' }
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
  'rete-antitruffa': 'segnala',
  antitruffa: 'segnala',
  neurobalance: 'benessere',
  oxygen: 'benessere',
  focus: 'benessere',
  mandala: 'benessere',
  aureya: 'benessere',
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
  preventivi: 'gestione',
  'digital-receipt': 'gestione',
  magazzino: 'gestione',
  calcolatrici: 'gestione',
  'firma-pdf': 'ufficio',
  'firma-email': 'ufficio',
  hopla: 'ufficio',
  shop: 'negozio',
  menu: 'negozio',
  fidelity: 'negozio',
  offermaker: 'negozio',
  'link-in-bio': 'vetrina',
  'landing-page': 'vetrina',
  'whatsapp-messages': 'vetrina',
  lumen: 'vetrina',
  vox: 'vetrina',
  captio: 'vetrina',
  diarium: 'vetrina',
  imago: 'vetrina',
  forma: 'vetrina',
  tutela: 'vetrina',
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
export const HUB_ICON_NAME: Record<ServiceHub, string> = { controlla: 'ScanEye', proteggi: 'ShieldCheck', segnala: 'ShieldAlert', benessere: 'Flower2', giochi: 'Dices', qr: 'QrCode', spendly: 'PiggyBank', lavoro: 'Briefcase', gestione: 'BookUser', ufficio: 'Signature', negozio: 'Store', vetrina: 'PanelsTopLeft', agenda: 'CalendarClock', casaauto: 'House', viaggi: 'Plane', amicizie: 'HeartHandshake' }

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
  agenda: '/strumenti/memolife',
  casaauto: '/strumenti/casa',
  viaggi: '/strumenti/travel',
  amicizie: '/strumenti/convivium',
}

// Un rappresentante per servizio (per contare i servizi come la Home)
export const HUB_REPRESENTATIVE: Record<ServiceHub, string> = { controlla: 'verifica-iban', proteggi: 'scudo-dati', segnala: 'rete-antitruffa', benessere: 'neurobalance', giochi: 'nexus', qr: 'qr-code-pro', spendly: 'spendly', lavoro: 'trova-lavoro', gestione: 'clienti', ufficio: 'firma-pdf', negozio: 'shop', vetrina: 'link-in-bio', agenda: 'memolife', casaauto: 'casa', viaggi: 'travel', amicizie: 'convivium' }

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

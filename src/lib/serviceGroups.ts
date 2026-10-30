// Servizi raggruppati per BISOGNO (pagina Servizi e domanda del primo
// accesso), non per prezzo: chi entra cerca "mi serve qualcosa contro le
// truffe", non "cosa c'è nel Plus". Ogni servizio sta in un solo gruppo.

export const SERVICE_GROUPS = ['security', 'money', 'work', 'docs', 'wellness', 'fun', 'gifts', 'audio', 'kids', 'manage', 'business', 'social'] as const
export type ServiceGroup = (typeof SERVICE_GROUPS)[number]

// Le due parti della pagina Servizi: la vita di tutti i giorni e chi ha
// un'attività (partita IVA, negozio, studio). «Documenti e file» sta in
// tutte e due; la ricerca cerca sempre in tutti i servizi.
// Avviso della pagina Servizi quando cambia categoria (lo ascolta la chat di KUMI)
export const SERVICES_CATEGORY_EVENT = 'kumani:servizi-categoria'

export const SERVICE_SEGMENTS = ['me', 'biz'] as const
export type ServiceSegment = (typeof SERVICE_SEGMENTS)[number]
export const SEGMENT_GROUPS: Record<ServiceSegment, ServiceGroup[]> = {
  me: ['security', 'money', 'work', 'docs', 'wellness', 'fun', 'gifts', 'audio', 'kids', 'business', 'social'],
  biz: ['manage', 'business', 'social', 'docs'],
}

// In «Per me» delle categorie per chi ha un'attività si vedono solo i servizi
// gratuiti e del Plus (QR, Messaggi WhatsApp, Link in bio, Tutela…): servono
// anche a un privato. Segue il piano scelto in Admin.
export const SEGMENT_ONLY_PLANS: Partial<Record<ServiceSegment, Partial<Record<ServiceGroup, Array<'free' | 'base' | 'pro'>>>>> = {
  me: { business: ['free', 'base'], social: ['free', 'base'] },
}

// Dentro «Cerco o ho un lavoro» i servizi in due parti (le cartelle dei
// servizi uniti, es. Trova Lavoro + CV, vanno nella parte del loro primo servizio)
export const GROUP_PARTS: Partial<Record<ServiceGroup, { key: string; tools: string[] }[]>> = {
  work: [
    { key: 'search', tools: ['trova-lavoro', 'kumani-cv', 'lettera-presentazione', 'candidature'] },
    { key: 'job', tools: ['registro-ore', 'note-spese', 'ricevuta-occasionale'] },
  ],
}

const GROUP_OF: Record<string, ServiceGroup> = {
  // Proteggerti dalle truffe
  svat: 'security',
  'verifica-iban': 'security',
  'scudo-dati': 'security',
  checkmail: 'security',
  verifoto: 'security',
  'documento-sicuro': 'security',
  'testo-protetto': 'security',
  antitruffa: 'security',
  'rete-antitruffa': 'security',
  'carte-antitruffa': 'security',
  'vocale-sospetto': 'security',
  // Soldi e organizzazione
  spendly: 'money',
  fincheck: 'money',
  memolife: 'money',
  'life-calendar': 'money',
  fototessera: 'money',
  garage: 'money',
  casa: 'money',
  findo: 'money',
  travel: 'money',
  // Cerco o ho un lavoro (privati); Gestire la tua attività (manage) e
  // Documenti e file (docs) sono le cartelle Gestione e Ufficio
  'trova-lavoro': 'work',
  'documento-componibile': 'docs',
  'lettera-presentazione': 'work',
  'note-spese': 'work',
  'ricevuta-occasionale': 'work',
  'candidature': 'work',
  'registro-ore': 'work',
  'kumani-cv': 'work',
  preventivi: 'manage',
  clienti: 'manage',
  tempus: 'manage',
  hopla: 'docs',
  'firma-pdf': 'docs',
  scanner: 'docs',
  'digital-receipt': 'manage',
  magazzino: 'manage',
  calcolatrici: 'manage',
  'firma-email': 'docs',
  // La tua attività e farti conoscere
  'landing-page': 'business',
  // Social: il kit per chi inizia sui social
  lumen: 'social',
  vox: 'social',
  captio: 'social',
  diarium: 'social',
  imago: 'social',
  forma: 'social',
  tutela: 'social',
  shop: 'business',
  menu: 'business',
  fidelity: 'business',
  'qr-code-pro': 'business',
  'qr-generator': 'business',
  'link-in-bio': 'business',
  'whatsapp-messages': 'business',
  offermaker: 'business',
  // Benessere
  oxygen: 'wellness',
  focus: 'wellness',
  neurobalance: 'wellness',
  mandala: 'wellness',
  aureya: 'wellness',
  cronobioma: 'wellness',
  // Svago
  fabula: 'fun',
  nexus: 'fun',
  mosaic: 'fun',
  affinity: 'fun',
  convivium: 'fun',
  veritas: 'fun',
  // Audio e Strumenti
  fonometro: 'audio',
  metronomo: 'audio',
  accordatore: 'audio',
  // Bambini
  'angolo-bambini': 'kids',
}

export const serviceGroupOf = (toolName: string): ServiceGroup => GROUP_OF[toolName] ?? 'business'

// Servizi proposti come preferiti per ogni interesse (primo accesso): i
// primi della lista che l'utente può davvero usare
export const STARTER_SERVICES: Record<ServiceGroup, string[]> = {
  security: ['verifica-iban', 'scudo-dati', 'rete-antitruffa'],
  money: ['spendly', 'fincheck', 'memolife'],
  work: ['trova-lavoro', 'kumani-cv', 'registro-ore'],
  docs: ['firma-pdf', 'scanner', 'hopla'],
  manage: ['preventivi', 'clienti', 'tempus'],
  business: ['landing-page', 'qr-generator', 'whatsapp-messages', 'link-in-bio'],
  social: ['tutela', 'captio', 'lumen', 'diarium'],
  wellness: ['oxygen', 'focus', 'neurobalance'],
  fun: ['nexus', 'fabula', 'mosaic', 'veritas'],
  audio: ['accordatore', 'metronomo', 'fonometro'],
  // Regali e sorprese: non sono servizi del piano (si pagano a parte), solo nella pagina Servizi
  gifts: [],
  kids: ['angolo-bambini'],
}

// Colori dei gruppi (pallino e icone delle schede; color e soft per le copertine)
export const GROUP_STYLE: Record<ServiceGroup, { dot: string; tile: string; color: string; soft: string }> = {
  security: { dot: 'bg-[#b5452f]', tile: 'bg-[#fde7e3] text-[#b5452f]', color: '#b5452f', soft: '#fde7e3' },
  money: { dot: 'bg-[#2f6b45]', tile: 'bg-[#e4f1e8] text-[#2f6b45]', color: '#2f6b45', soft: '#e4f1e8' },
  work: { dot: 'bg-[#2b4f9a]', tile: 'bg-[#e6ecf8] text-[#2b4f9a]', color: '#2b4f9a', soft: '#e6ecf8' },
  business: { dot: 'bg-[#8a6d1f]', tile: 'bg-[#f5e8bd] text-[#6b5414]', color: '#8a6d1f', soft: '#f5e8bd' },
  social: { dot: 'bg-[#c0266d]', tile: 'bg-[#fde4ef] text-[#b0215f]', color: '#c0266d', soft: '#fde4ef' },
  wellness: { dot: 'bg-[#0f766e]', tile: 'bg-[#dff3f1] text-[#0f766e]', color: '#0f766e', soft: '#dff3f1' },
  fun: { dot: 'bg-[#7c3aed]', tile: 'bg-[#efe7fd] text-[#6d28d9]', color: '#7c3aed', soft: '#efe7fd' },
  audio: { dot: 'bg-[#0e7490]', tile: 'bg-[#dff4f8] text-[#0e7490]', color: '#0e7490', soft: '#dff4f8' },
  docs: { dot: 'bg-[#475569]', tile: 'bg-[#e8edf3] text-[#475569]', color: '#475569', soft: '#e8edf3' },
  manage: { dot: 'bg-[#1f4e5f]', tile: 'bg-[#e0eef2] text-[#1f4e5f]', color: '#1f4e5f', soft: '#e0eef2' },
  gifts: { dot: 'bg-[#c0266d]', tile: 'bg-[#fde4ef] text-[#b0215f]', color: '#c0266d', soft: '#fde4ef' },
  kids: { dot: 'bg-[#e85d2a]', tile: 'bg-[#ffe8dc] text-[#c2410c]', color: '#e85d2a', soft: '#ffe8dc' },
}

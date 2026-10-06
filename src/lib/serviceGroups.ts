// Servizi raggruppati per BISOGNO (pagina Servizi e domanda del primo
// accesso), non per prezzo: chi entra cerca "mi serve qualcosa contro le
// truffe", non "cosa c'è nel Base". Ogni servizio sta in un solo gruppo.

export const SERVICE_GROUPS = ['security', 'money', 'work', 'business', 'wellness', 'fun'] as const
export type ServiceGroup = (typeof SERVICE_GROUPS)[number]

const GROUP_OF: Record<string, ServiceGroup> = {
  // Proteggerti dalle truffe
  svat: 'security',
  'verifica-iban': 'security',
  'scudo-dati': 'security',
  checkmail: 'security',
  verifoto: 'security',
  'documento-sicuro': 'security',
  antitruffa: 'security',
  // Soldi e organizzazione
  spendly: 'money',
  fincheck: 'money',
  memolife: 'money',
  'life-calendar': 'money',
  garage: 'money',
  findo: 'money',
  travel: 'money',
  // Lavoro
  'trova-lavoro': 'work',
  'kumani-cv': 'work',
  preventivi: 'work',
  'digital-receipt': 'work',
  magazzino: 'work',
  calcolatrici: 'work',
  'firma-email': 'work',
  // La tua attività e farti conoscere
  'landing-page': 'business',
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
  // Svago
  fabula: 'fun',
  mosaic: 'fun',
  affinity: 'fun',
  veritas: 'fun',
}

export const serviceGroupOf = (toolName: string): ServiceGroup => GROUP_OF[toolName] ?? 'business'

// Servizi proposti come preferiti per ogni interesse (primo accesso): i
// primi della lista che l'utente può davvero usare
export const STARTER_SERVICES: Record<ServiceGroup, string[]> = {
  security: ['svat', 'verifica-iban', 'scudo-dati', 'checkmail', 'antitruffa'],
  money: ['spendly', 'fincheck', 'memolife'],
  work: ['trova-lavoro', 'kumani-cv', 'preventivi'],
  business: ['landing-page', 'qr-generator', 'whatsapp-messages', 'link-in-bio'],
  wellness: ['oxygen', 'focus', 'neurobalance'],
  fun: ['fabula', 'mosaic', 'veritas'],
}

// Colori dei gruppi (pallino e icone delle schede)
export const GROUP_STYLE: Record<ServiceGroup, { dot: string; tile: string }> = {
  security: { dot: 'bg-[#b5452f]', tile: 'bg-[#fde7e3] text-[#b5452f]' },
  money: { dot: 'bg-[#2f6b45]', tile: 'bg-[#e4f1e8] text-[#2f6b45]' },
  work: { dot: 'bg-[#2b4f9a]', tile: 'bg-[#e6ecf8] text-[#2b4f9a]' },
  business: { dot: 'bg-[#8a6d1f]', tile: 'bg-[#f5e8bd] text-[#6b5414]' },
  wellness: { dot: 'bg-[#0f766e]', tile: 'bg-[#dff3f1] text-[#0f766e]' },
  fun: { dot: 'bg-[#7c3aed]', tile: 'bg-[#efe7fd] text-[#6d28d9]' },
}

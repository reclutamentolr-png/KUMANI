// Chiedi a KUMI: dove si trova la persona e se è già iscritta. Decide le
// domande suggerite e cosa sa KUMI rispondendo (a chi è già dentro non si
// propone di iscriversi).

export type KumiContextKind = 'visitor' | 'home' | 'wallet' | 'community' | 'documents' | 'tool' | 'category'
// tool = nome del servizio, oppure della categoria aperta nella pagina Servizi
export type KumiContext = { kind: KumiContextKind; tool?: string }

const starts = (path: string, p: string) => path === p || path.startsWith(`${p}/`)

// path = indirizzo senza la lingua; tool = nome del servizio se si è dentro uno;
// category = nome della categoria aperta nella pagina Servizi (?categoria=…)
export function kumiContextOf(path: string, signedIn: boolean, toolTitle?: string | null, category?: string | null): KumiContext {
  if (!signedIn) return { kind: 'visitor' }
  if (starts(path, '/app') && toolTitle) return { kind: 'tool', tool: toolTitle }
  if (starts(path, '/servizi') && category) return { kind: 'category', tool: category }
  if (starts(path, '/wallet')) return { kind: 'wallet' }
  if (starts(path, '/community')) return { kind: 'community' }
  if (starts(path, '/documenti') || starts(path, '/scheda-attivita')) return { kind: 'documents' }
  return { kind: 'home' }
}

// Domande suggerite per ogni posto (chiavi in kumiChat)
export const KUMI_CHIPS: Record<KumiContextKind, string[]> = {
  visitor: ['chip1', 'chip2', 'chip3', 'chip4', 'chip5'],
  home: ['home1', 'home2', 'home3', 'home4', 'home5'],
  wallet: ['wallet1', 'wallet2', 'wallet3', 'wallet4'],
  community: ['community1', 'community2', 'community3', 'community4'],
  documents: ['documents1', 'documents2', 'documents3', 'documents4'],
  tool: ['tool1', 'tool2', 'tool3', 'tool4'],
  category: ['cat1', 'cat2', 'cat3', 'cat4'],
}

export const isKumiContext = (v: unknown): v is KumiContext =>
  !!v && typeof v === 'object' && ['visitor', 'home', 'wallet', 'community', 'documents', 'tool', 'category'].includes((v as KumiContext).kind)

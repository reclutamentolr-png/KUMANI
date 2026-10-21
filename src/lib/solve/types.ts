// KUMANI Risolvi: percorsi guidati per i problemi di tutti i giorni.
// Ogni guida: poche domande, un avviso urgente se serve, i passi che
// valgono per le risposte date e, alla fine, il servizio KUMANI giusto.
// I contenuti stanno nel codice (src/lib/solve/guides.it.ts): li scrive lo
// Staff e si pubblicano con una nuova versione dell'app, con fonti e data
// di revisione obbligatorie.

// Condizione: la risposta alla domanda `q` è una di `anyOf`; con un elenco
// di condizioni devono valere tutte
export type SolveCondition = { q: string; anyOf: string[] }
export type SolveShowIf = SolveCondition | SolveCondition[]

export type SolveQuestion = {
  id: string
  text: string
  options: { value: string; label: string }[]
}

// Collegamento a un servizio KUMANI (tool: per mostrare il piano) o a una pagina
export type SolveLink = { label: string; href: string; tool?: string }

export type SolveStep = {
  id: string
  title: string
  body?: string
  showIf?: SolveShowIf
  link?: SolveLink
}

export type SolveGuide = {
  id: string
  // Cambia quando i passi cambiano: un percorso salvato con una versione
  // diversa riparte da capo (le risposte restano)
  version: string
  category: 'sicurezza' | 'soldi' | 'auto'
  icon: string
  title: string
  subtitle: string
  minutes: string
  questions: SolveQuestion[]
  // Avvisi da leggere prima dei passi (es. soldi già inviati)
  urgent?: { showIf: SolveCondition; title: string; items: string[] }[]
  steps: SolveStep[]
  finish: { question: string; ifNo: SolveLink[] }
  // Servizi KUMANI collegati, mostrati anche nella scheda della guida
  services: SolveLink[]
  sources: { label: string; url: string }[]
  reviewedAt: string
  note: string
}

export type SolveOutcome = 'yes' | 'no' | 'unknown'
export type SolveAnswers = Record<string, string>

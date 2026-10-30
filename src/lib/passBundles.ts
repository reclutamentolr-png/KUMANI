// Pass che valgono per più servizi. Il Pass di KUMANI CV o di Trova Lavoro
// apre tutti i servizi di «Cerco o ho un lavoro»: chi cerca lavoro trova
// insieme CV, lettera, candidature e, una volta assunto, ore e spese.
// Stesso elenco nel database: public.pass_bundle_tools (migrazione 20270626100000).

export const PASS_BUNDLES: { key: string; parents: string[]; tools: string[] }[] = [
  {
    key: 'lavoro',
    parents: ['kumani-cv', 'trova-lavoro'],
    tools: ['trova-lavoro', 'kumani-cv', 'lettera-presentazione', 'candidature', 'registro-ore', 'note-spese', 'ricevuta-occasionale'],
  },
]

// Servizi aperti dal Pass di questo servizio (lui compreso)
export function passBundleTools(tool: string): string[] {
  return PASS_BUNDLES.find((bundle) => bundle.parents.includes(tool))?.tools ?? [tool]
}

// Pass che aprono anche questo servizio (escluso il suo)
export function passParentsOf(tool: string): string[] {
  return PASS_BUNDLES.filter((bundle) => bundle.tools.includes(tool)).flatMap((bundle) => bundle.parents.filter((parent) => parent !== tool))
}

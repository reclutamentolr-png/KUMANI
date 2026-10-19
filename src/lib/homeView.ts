// Viste della Home (dashboard): Lite (l'essenziale), Completa (tutto) e
// Icone (come la schermata di un telefono). La scelta resta nel profilo
// dell'utente (user_metadata.home_view, vale su tutti i dispositivi) e in un
// cookie leggibile dal browser, che serve ai servizi per sapere dove riporta
// «‹ Home» (vista Icone) invece di «Torna ai servizi».
export const HOME_VIEWS = ['lite', 'full', 'icons'] as const
export type HomeView = (typeof HOME_VIEWS)[number]
export const HOME_VIEW_COOKIE = 'kumani_home_view'
// Servizio aperto toccando un'icona (in questa scheda del browser): anche
// senza il cookie, «‹ Home» riporta alle icone
export const FROM_ICONS_KEY = 'kumani_from_icons'
// Valore di FROM_ICONS_KEY quando il servizio è stato aperto dalla pagina
// Servizi: lì si torna (non alla Home)
export const FROM_SERVICES = 'servizi'

// Pagina Servizi: Elenco (con le descrizioni) o Icone. Nel profilo
// (user_metadata.services_view); di partenza Icone per chi ha la Home a icone
export const SERVICES_VIEWS = ['list', 'icons'] as const
export type ServicesView = (typeof SERVICES_VIEWS)[number]
export function resolveServicesView(metadata: Record<string, unknown> | null | undefined): ServicesView {
  const meta = metadata ?? {}
  if (meta.services_view === 'list' || meta.services_view === 'icons') return meta.services_view
  return meta.home_view === 'icons' ? 'icons' : 'list'
}

// Nome corto di un servizio, come sotto le icone del telefono: di
// «KUMANI Benessere · Respira» resta «Respira»
export const shortServiceName = (title: string) => title.split(' · ').pop()?.replace(/^KUMANI\s+/, '') || title

// Home a icone: categorie (servizi uniti, lib/serviceHubs) nella fascia in
// basso accanto a Wallet e Documenti, come cartelle. Nel profilo
// (user_metadata.home_folders); di partenza solo Benessere.
export const DEFAULT_HOME_FOLDERS = ['benessere']
export const MAX_HOME_FOLDERS = 8

export function resolveHomeFolders(metadata: Record<string, unknown> | null | undefined, valid: readonly string[]): string[] {
  const raw = (metadata ?? {}).home_folders
  if (!Array.isArray(raw)) return DEFAULT_HOME_FOLDERS
  return raw.filter((hub): hub is string => typeof hub === 'string' && valid.includes(hub)).slice(0, MAX_HOME_FOLDERS)
}

export const isHomeView = (value: unknown): value is HomeView => typeof value === 'string' && (HOME_VIEWS as readonly string[]).includes(value)

// Vista di partenza: quella scelta; altrimenti Lite per i nuovi iscritti
// Gratis (con i primi passi del benvenuto) e Completa per tutti gli altri
// («Mostra la Home completa» di prima vale come Completa)
export function resolveHomeView(metadata: Record<string, unknown> | null | undefined, newcomer: boolean): HomeView {
  const meta = metadata ?? {}
  if (isHomeView(meta.home_view)) return meta.home_view
  if (meta.home_full === true) return 'full'
  return newcomer ? 'lite' : 'full'
}

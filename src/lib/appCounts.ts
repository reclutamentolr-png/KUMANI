import { getDisabledTools } from '@/lib/freeTools'
import { ALL_TOOL_NAMES, CATALOG_TOOL_NAMES } from '@/lib/catalog-server'
import { TOOL_HUB } from '@/lib/serviceHubs'

// «50 strumenti in 22 servizi»: strumenti accesi (ognuno conta) e
// servizi come li vede l'utente (i servizi uniti contano una volta sola, vedi
// lib/serviceHubs). Calcolati dalle impostazioni dell'Admin, così restano veri
// quando si accende o si spegne qualcosa.
export async function getAppCounts(): Promise<{ tools: number; services: number }> {
  const disabled = new Set(await getDisabledTools())
  const on = (name: string) => !disabled.has(name)
  // Un servizio unito c'è finché almeno uno dei suoi strumenti è acceso (come
  // nel Catalogo), anche se è spento quello che lo rappresenta nell'elenco
  const present = (name: string) => {
    const hub = TOOL_HUB[name]
    return hub ? Object.keys(TOOL_HUB).some((tool) => TOOL_HUB[tool] === hub && on(tool)) : on(name)
  }
  return { tools: ALL_TOOL_NAMES.filter(on).length, services: CATALOG_TOOL_NAMES.filter(present).length }
}

import { countEnabledTools } from '@/lib/freeTools'
import { ALL_TOOL_NAMES, CATALOG_TOOL_NAMES } from '@/lib/catalog-server'

// «50 strumenti in 22 servizi»: strumenti accesi (ognuno conta) e
// servizi come li vede l'utente (i servizi uniti contano una volta sola, vedi
// lib/serviceHubs). Calcolati dalle impostazioni dell'Admin, così restano veri
// quando si accende o si spegne qualcosa.
export async function getAppCounts(): Promise<{ tools: number; services: number }> {
  const [tools, services] = await Promise.all([countEnabledTools(ALL_TOOL_NAMES), countEnabledTools(CATALOG_TOOL_NAMES)])
  return { tools: tools ?? ALL_TOOL_NAMES.length, services: services ?? CATALOG_TOOL_NAMES.length }
}

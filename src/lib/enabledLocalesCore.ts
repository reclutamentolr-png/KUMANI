// Lettura delle lingue attive senza la memoria di Next (usata anche dal
// proxy, dove unstable_cache non è disponibile). Vedi enabledLocales.ts.
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Lingue attive del sito (Admin → Generale → Lingue del sito), salvate in
// system_settings.enabled_locales. L'italiano è la base: sempre attivo.
// Se l'impostazione manca o il database non risponde, tutte attive (come
// prima di questa funzione).
export const ALL_SITE_LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'] as const
export const ENABLED_LOCALES_KEY = 'enabled_locales'
export const ENABLED_LOCALES_TAG = 'enabled-locales'

export function parseEnabledLocales(raw: unknown): string[] {
  let list: unknown = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      return [...ALL_SITE_LOCALES]
    }
  }
  if (!Array.isArray(list)) return [...ALL_SITE_LOCALES]
  const valid = ALL_SITE_LOCALES.filter((l) => list.includes(l))
  return valid.includes('it') ? valid : ['it', ...valid]
}

// Impostazioni lette dal proxy a ogni pagina, in un'unica richiesta: lingue
// attive, manutenzione e pre-lancio accesi/spenti, chiave del link
// d'anteprima (il proxy le tiene in memoria qualche secondo, vedi src/proxy.ts).
export type ProxySettings = { locales: string[]; maintenanceOn: boolean; prelaunchOn: boolean; prelaunchKey: string }
export async function readProxySettings(): Promise<ProxySettings> {
  const { data, error } = await createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
    .from('system_settings')
    .select('key, value')
    .in('key', [ENABLED_LOCALES_KEY, 'maintenance_mode', 'prelaunch_mode', 'prelaunch_key'])
  if (error) throw new Error(error.message)
  const rows = new Map((data ?? []).map((row) => [row.key, row.value]))
  const localesRaw = rows.get(ENABLED_LOCALES_KEY)
  const flag = (key: string) => String(rows.get(key) ?? 'false').replace(/"/g, '') === 'true'
  return {
    locales: localesRaw !== undefined ? parseEnabledLocales(localesRaw) : [...ALL_SITE_LOCALES],
    maintenanceOn: flag('maintenance_mode'),
    prelaunchOn: flag('prelaunch_mode'),
    prelaunchKey: String(rows.get('prelaunch_key') ?? '').replace(/"/g, ''),
  }
}

export async function readEnabledLocales(): Promise<string[]> {
  const { data, error } = await createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
    .from('system_settings')
    .select('value')
    .eq('key', ENABLED_LOCALES_KEY)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? parseEnabledLocales(data.value) : [...ALL_SITE_LOCALES]
}

import { getTranslations } from 'next-intl/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Limiti per persona impostati dall'Admin (tabella app_limits): superato il
// limite il database rifiuta il salvataggio con «app_limit:<chiave>:<max>».
// Qui l'errore diventa un messaggio già tradotto per chi usa l'app.
export function appLimitMax(error: { message?: string } | null | undefined): number | null {
  const match = /app_limit:[a-z0-9_.-]+:(\d+)/i.exec(error?.message ?? '')
  return match ? Number(match[1]) : null
}

export async function limitError(error: { message?: string } | null | undefined) {
  const max = appLimitMax(error)
  if (max === null) return null
  const t = await getTranslations('common')
  return { success: false as const, message: 'limitReached', limitText: t('limitReached', { max }) }
}

// Valore attuale di un limite (null = nessun limite impostato). app_limits
// non è leggibile dagli utenti: si legge con il client di servizio.
export async function appLimitValue(key: string): Promise<number | null> {
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data } = await db.from('app_limits').select('value').eq('key', key).maybeSingle()
  return data ? Number(data.value) : null
}

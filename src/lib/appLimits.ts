import { getTranslations } from 'next-intl/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { clientIp, logSecurityEvent } from '@/lib/security'

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
  await logLimitHit(/app_limit:([a-z0-9_.-]+):/i.exec(error?.message ?? '')?.[1] ?? '')
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

// Limite superato: nel registro di sicurezza (tanti in poco tempo = uso
// forzato o automatico, Admin → Sicurezza)
async function logLimitHit(key: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const h = await headers()
    await logSecurityEvent({ kind: 'limit_hit', userId: user?.id ?? null, ip: clientIp(h), detail: { key } })
  } catch {
    // il registro non deve mai bloccare la risposta
  }
}

// AI usata fino al limite giornaliero (menu, landing, OfferMaker)
export async function logAiLimit(userId: string, tool: string) {
  try {
    const h = await headers()
    await logSecurityEvent({ kind: 'ai_limit', userId, ip: clientIp(h), detail: { tool } })
  } catch {
    // come sopra
  }
}

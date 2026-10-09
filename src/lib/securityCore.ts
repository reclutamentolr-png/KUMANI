import { createClient as createServiceClient } from '@supabase/supabase-js'

// Registro di sicurezza (Admin → Sicurezza), parte leggera usata anche dal
// proxy: eventi sospetti scritti con la funzione security_log del database,
// che controlla subito le soglie e apre gli avvisi. Non blocca mai
// l'operazione che lo chiama: se il registro non risponde, si va avanti.
// Le notifiche push agli admin sono in lib/security.ts.

export type SecurityKind =
  | 'probe'
  | 'not_found'
  | 'login_failed'
  | 'password_check_failed'
  | 'admin_denied'
  | 'admin_action_denied'
  | 'limit_hit'
  | 'ai_limit'
  | 'trial_start'

export type SecurityEventInput = {
  kind: SecurityKind
  severity?: 'info' | 'low' | 'medium' | 'high'
  userId?: string | null
  ip?: string | null
  path?: string | null
  userAgent?: string | null
  detail?: Record<string, unknown>
}

export const securityDb = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Indirizzo di chi fa la richiesta (Vercel lo mette in x-forwarded-for)
export function clientIp(headers: Headers): string | null {
  const forwarded = (headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  return forwarded || headers.get('x-real-ip') || null
}

export type NewAlert = { alert_id: string; severity: 'low' | 'medium' | 'high'; title: string }

// Registra l'evento e ritorna gli avvisi appena aperti
export async function recordSecurityEvent(event: SecurityEventInput): Promise<NewAlert[]> {
  try {
    const { data, error } = await securityDb().rpc('security_log', {
      p_kind: event.kind,
      p_severity: event.severity ?? 'info',
      p_user: event.userId ?? null,
      p_ip: event.ip ?? null,
      p_path: event.path ?? null,
      p_user_agent: event.userAgent ?? null,
      p_detail: event.detail ?? {},
      p_ref: null,
    })
    if (error) throw error
    return (data ?? []) as NewAlert[]
  } catch (error) {
    console.error('[security] evento non registrato:', event.kind, error instanceof Error ? error.message : error)
    return []
  }
}

// IP bloccati dall'Admin: letti dal proxy e tenuti in memoria 60 secondi
let blockedCache: { at: number; ips: Set<string> } | null = null
export async function blockedIps(): Promise<Set<string>> {
  if (blockedCache && Date.now() - blockedCache.at < 60_000) return blockedCache.ips
  try {
    const { data, error } = await securityDb().from('blocked_ips').select('ip, expires_at')
    if (error) throw error
    const now = Date.now()
    const ips = new Set((data ?? []).filter((r) => !r.expires_at || new Date(r.expires_at as string).getTime() > now).map((r) => r.ip as string))
    blockedCache = { at: now, ips }
    return ips
  } catch {
    // Database non raggiungibile: si riprova tra 60 secondi, non a ogni pagina
    const ips = blockedCache?.ips ?? new Set<string>()
    blockedCache = { at: Date.now(), ips }
    return ips
  }
}

// Indirizzi che cercano solo falle note (WordPress, file di configurazione,
// pannelli di altri programmi): su KUMANI non esistono, chi li apre sta
// scansionando il sito. I percorsi con un punto passano dalla riscrittura in
// next.config (il proxy non li vede), gli altri dal proxy.
export const PROBE_PATH =
  /^\/(?:[a-z]{2}\/)?(?:wp-admin|wp-content|wp-includes|wordpress|wp|phpmyadmin|pma|myadmin|cgi-bin|vendor\/phpunit|actuator|solr|boaform|hnap1|owa|autodiscover|_ignition|telescope|jenkins|manager\/html|server-status|xmlrpc)(?:\/|$)/i

'use server'

import { headers } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { clientIp } from '@/lib/security'
import { adminUpdateProfile } from '@/app/actions/admin'

// Admin → Sicurezza: avvisi, registro degli eventi e IP bloccati. Vedere
// richiede settings.read; agire (chiudere avvisi, bloccare) users.write.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

type Person = { id: string; email: string | null; name: string; is_blocked: boolean }

export type SecurityAlertRow = {
  id: string
  kind: string
  severity: 'low' | 'medium' | 'high'
  title: string
  user: Person | null
  ip: string | null
  count: number
  first_seen: string
  last_seen: string
  detail: Record<string, unknown>
  status: 'open' | 'resolved' | 'ignored'
  ipBlocked: boolean
}

export type SecurityEventRow = {
  id: number
  created_at: string
  kind: string
  severity: string
  user: Person | null
  ip: string | null
  path: string | null
  user_agent: string | null
  detail: Record<string, unknown>
}

export type BlockedIpRow = { ip: string; reason: string | null; created_at: string; expires_at: string | null }

async function people(ids: (string | null)[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  if (!unique.length) return new Map()
  const { data } = await db().from('profiles').select('id, email, first_name, last_name, username, is_blocked').in('id', unique)
  return new Map(
    (data ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        email: (p.email as string | null) ?? null,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ') || ((p.username as string | null) ?? ''),
        is_blocked: !!p.is_blocked,
      },
    ])
  )
}

const RANK = { high: 3, medium: 2, low: 1 } as const

export async function adminSecurityAlerts(
  status: 'open' | 'closed'
): Promise<{ items: SecurityAlertRow[]; blocked: BlockedIpRow[]; error?: string }> {
  if (!(await verifyAdmin('settings.read'))) return { items: [], blocked: [], error: 'Non autorizzato' }
  const base = db().from('security_alerts').select('*').order('last_seen', { ascending: false }).limit(200)
  const [{ data, error }, { data: blocked }] = await Promise.all([
    status === 'open' ? base.eq('status', 'open') : base.neq('status', 'open'),
    db().from('blocked_ips').select('ip, reason, created_at, expires_at').order('created_at', { ascending: false }),
  ])
  if (error) return { items: [], blocked: [], error: error.message }
  const map = await people((data ?? []).map((a) => a.user_id as string | null))
  const now = Date.now()
  const active = (blocked ?? []).filter((b) => !b.expires_at || new Date(b.expires_at as string).getTime() > now) as BlockedIpRow[]
  const blockedSet = new Set(active.map((b) => b.ip))
  const items: SecurityAlertRow[] = (data ?? []).map((a) => ({
    id: a.id,
    kind: a.kind,
    severity: a.severity,
    title: a.title,
    user: a.user_id ? (map.get(a.user_id) ?? null) : null,
    ip: a.ip,
    count: a.count,
    first_seen: a.first_seen,
    last_seen: a.last_seen,
    detail: a.detail ?? {},
    status: a.status,
    ipBlocked: !!a.ip && blockedSet.has(a.ip),
  }))
  if (status === 'open') items.sort((x, y) => RANK[y.severity] - RANK[x.severity])
  return { items, blocked: active }
}

export async function adminSecurityEvents(filter: {
  kind?: string
  ip?: string
  userId?: string
}): Promise<{ items: SecurityEventRow[]; error?: string }> {
  if (!(await verifyAdmin('settings.read'))) return { items: [], error: 'Non autorizzato' }
  let query = db().from('security_events').select('*').order('created_at', { ascending: false }).limit(300)
  if (filter.kind) query = query.eq('kind', filter.kind)
  if (filter.ip?.trim()) query = query.eq('ip', filter.ip.trim())
  if (filter.userId) query = query.eq('user_id', filter.userId)
  const { data, error } = await query
  if (error) return { items: [], error: error.message }
  const map = await people((data ?? []).map((e) => e.user_id as string | null))
  return {
    items: (data ?? []).map((e) => ({
      id: e.id,
      created_at: e.created_at,
      kind: e.kind,
      severity: e.severity,
      user: e.user_id ? (map.get(e.user_id) ?? null) : null,
      ip: e.ip,
      path: e.path,
      user_agent: e.user_agent,
      detail: e.detail ?? {},
    })),
  }
}

export async function adminSetAlertStatus(id: string, status: 'open' | 'resolved' | 'ignored') {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false as const, error: 'Non autorizzato' }
  if (!['open', 'resolved', 'ignored'].includes(status)) return { success: false as const, error: 'Stato non valido' }
  const fields =
    status === 'open'
      ? { status, resolved_at: null, resolved_by: null }
      : { status, resolved_at: new Date().toISOString(), resolved_by: admin.id }
  const { error } = await db().from('security_alerts').update(fields).eq('id', id)
  if (error) return { success: false as const, error: error.code === '23505' ? "C'è già un avviso aperto uguale" : error.message }
  return { success: true as const }
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const IPV6 = /^[0-9a-f:]{2,39}$/i

export async function adminBlockIp(ip: string, hours: number | null, reason: string) {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false as const, error: 'Non autorizzato' }
  const clean = String(ip ?? '').trim()
  if (!IPV4.test(clean) && !(IPV6.test(clean) && clean.includes(':'))) return { success: false as const, error: 'Indirizzo IP non valido' }
  // Mai bloccare l'indirizzo da cui l'admin sta lavorando
  if (clientIp(await headers()) === clean) return { success: false as const, error: 'È il tuo indirizzo IP attuale: non lo blocco' }
  const expires = hours && hours > 0 ? new Date(Date.now() + hours * 3_600_000).toISOString() : null
  const { error } = await db().from('blocked_ips').upsert({
    ip: clean,
    reason: String(reason ?? '').slice(0, 300) || null,
    created_by: admin.id,
    created_at: new Date().toISOString(),
    expires_at: expires,
  })
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export async function adminUnblockIp(ip: string) {
  if (!(await verifyAdmin('users.write'))) return { success: false as const, error: 'Non autorizzato' }
  const { error } = await db().from('blocked_ips').delete().eq('ip', String(ip ?? '').trim())
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

// Sospensione dell'account: stesso blocco di Admin → Utenti (accesso chiuso,
// annunci nascosti, codice invito non valido), si toglie da lì
export async function adminSuspendUser(userId: string) {
  const result = await adminUpdateProfile(userId, { is_blocked: true })
  return result.success ? { success: true as const } : { success: false as const, error: String(result.error ?? 'Errore') }
}

export async function adminRunSecurityScan() {
  if (!(await verifyAdmin('settings.read'))) return { success: false as const, error: 'Non autorizzato' }
  const { data, error } = await db().rpc('security_scan')
  if (error) return { success: false as const, error: error.message }
  return { success: true as const, created: Number(data ?? 0) }
}

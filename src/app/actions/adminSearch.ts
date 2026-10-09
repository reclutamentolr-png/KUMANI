'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import type { AdminUserRow } from '@/lib/adminTypes'

// Ricerca generale dell'Admin (campo in cima al pannello): utenti, sorprese,
// codici regalo e di prova, indirizzi IP del registro di sicurezza. Ogni
// gruppo compare solo a chi ha il permesso di quella sezione.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export type AdminSearchResults = {
  users: AdminUserRow[]
  surprises: { id: string; title: string; recipient: string; status: string; owner: AdminUserRow | null }[]
  giftCodes: { code: string; status: string }[]
  trialCodes: { code: string; tool: string; status: string }[]
  ip: { ip: string; events: number; alerts: number; blocked: boolean } | null
}

const EMPTY: AdminSearchResults = { users: [], surprises: [], giftCodes: [], trialCodes: [], ip: null }
const USER_FIELDS = 'id, first_name, last_name, email, referral_code, subscription_status, is_blocked, created_at'

export async function adminGlobalSearch(query: string): Promise<AdminSearchResults> {
  const q = String(query ?? '').trim().slice(0, 80)
  if (q.length < 2) return EMPTY
  const words = q
    .replace(/[,()*%\\:"'`]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
  if (!words.length) return EMPTY
  const s = db()
  const [canUsers, canSettings, canVouchers, canCoupons] = await Promise.all([
    verifyAdmin('users.read'),
    verifyAdmin('settings.read'),
    verifyAdmin('vouchers.read'),
    verifyAdmin('coupons.read'),
  ])
  const result: AdminSearchResults = { ...EMPTY }

  const tasks: Promise<void>[] = []
  if (canUsers) {
    tasks.push(
      (async () => {
        let req = s.from('profiles').select(USER_FIELDS).is('deleted_at', null).order('created_at', { ascending: false }).limit(8)
        for (const w of words) req = req.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%,email.ilike.%${w}%,username.ilike.%${w}%,referral_code.ilike.%${w}%,phone.ilike.%${w}%`)
        const { data } = await req
        result.users = (data ?? []) as AdminUserRow[]
      })()
    )
  }
  if (canSettings) {
    tasks.push(
      (async () => {
        let req = s.from('surprise_gifts').select('id, title, recipient_name, status, refunded_at, user_id').order('created_at', { ascending: false }).limit(5)
        for (const w of words) req = req.or(`title.ilike.%${w}%,recipient_name.ilike.%${w}%,sender_name.ilike.%${w}%,public_token.eq.${w}`)
        const { data } = await req
        const ownerIds = [...new Set((data ?? []).map((g) => g.user_id as string))]
        const { data: owners } = ownerIds.length ? await s.from('profiles').select(USER_FIELDS).in('id', ownerIds) : { data: [] }
        const byId = new Map((owners ?? []).map((o) => [o.id as string, o as AdminUserRow]))
        result.surprises = (data ?? []).map((g) => ({
          id: g.id,
          title: g.title || '—',
          recipient: g.recipient_name,
          status: g.refunded_at ? 'rimborsata' : g.status === 'active' ? 'attiva' : 'bozza',
          owner: byId.get(g.user_id) ?? null,
        }))
      })()
    )
    // Indirizzo IP: quanti eventi e avvisi nel registro di sicurezza
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(q) || (/^[0-9a-f:]{3,39}$/i.test(q) && (q.match(/:/g) ?? []).length >= 2)) {
      tasks.push(
        (async () => {
          const [{ count: events }, { count: alerts }, { data: blocked }] = await Promise.all([
            s.from('security_events').select('id', { count: 'exact', head: true }).eq('ip', q),
            s.from('security_alerts').select('id', { count: 'exact', head: true }).eq('ip', q),
            s.from('blocked_ips').select('ip').eq('ip', q).maybeSingle(),
          ])
          result.ip = { ip: q, events: events ?? 0, alerts: alerts ?? 0, blocked: !!blocked }
        })()
      )
    }
  }
  const code = words[0].toUpperCase()
  if (canCoupons && code.length >= 3) {
    tasks.push(
      (async () => {
        const { data } = await s.from('gift_codes').select('code, valid_until, redeemed_at, revoked_at').ilike('code', `%${code}%`).limit(5)
        result.giftCodes = (data ?? []).map((g) => ({
          code: g.code,
          status: g.revoked_at ? 'revocato' : g.redeemed_at ? 'usato' : g.valid_until && new Date(g.valid_until).getTime() < Date.now() ? 'scaduto' : 'valido',
        }))
      })()
    )
  }
  if (canVouchers && code.length >= 3) {
    tasks.push(
      (async () => {
        const { data } = await s.from('trial_codes').select('code, tool, redeemed_at, revoked_at, access_until').ilike('code', `%${code}%`).limit(5)
        result.trialCodes = (data ?? []).map((c) => ({
          code: c.code,
          tool: c.tool,
          status: c.revoked_at ? 'revocato' : c.redeemed_at ? (c.access_until && new Date(c.access_until).getTime() > Date.now() ? 'in uso' : 'usato') : 'libero',
        }))
      })()
    )
  }
  await Promise.all(tasks)
  return result
}

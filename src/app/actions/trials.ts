'use server'

import { randomInt } from 'node:crypto'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import {
  MAX_ACTIVE_TRIAL_CODES,
  TRIAL_ACTIVATE_DAYS,
  TRIAL_DURATIONS,
  isGuestUser,
  isTrialTool,
  trialToolPath,
  type TrialDuration,
} from '@/lib/trials'

// Codici di prova dei servizi: creazione (Kumani Base/Pro, agenti, Admin),
// elenco, cancellazione e attivazione da parte dell'ospite (/prova/CODICE).

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export type TrialCodeStatus = 'waiting' | 'active' | 'ended' | 'expired' | 'deleted'
export type TrialCodeRow = {
  id: string
  code: string
  tool: string
  durationMinutes: number
  createdAt: string
  activateBy: string
  redeemedAt: string | null
  accessUntil: string | null
  status: TrialCodeStatus
  creator?: string | null
}

type DbRow = {
  id: string
  code: string
  tool: string
  duration_minutes: number
  created_at: string
  activate_by: string
  redeemed_at: string | null
  redeemed_by: string | null
  access_until: string | null
  revoked_at: string | null
  created_by: string
}

function statusOf(r: DbRow): TrialCodeStatus {
  const now = Date.now()
  if (r.revoked_at) return 'deleted'
  if (r.redeemed_at) return r.access_until && new Date(r.access_until).getTime() > now ? 'active' : 'ended'
  return new Date(r.activate_by).getTime() > now ? 'waiting' : 'expired'
}

const toRow = (r: DbRow): TrialCodeRow => ({
  id: r.id,
  code: r.code,
  tool: r.tool,
  durationMinutes: r.duration_minutes,
  createdAt: r.created_at,
  activateBy: r.activate_by,
  redeemedAt: r.redeemed_at,
  accessUntil: r.access_until,
  status: statusOf(r),
})

function newTrialCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = () => Array.from({ length: 4 }, () => chars[randomInt(chars.length)]).join('')
  return `PR-${part()}-${part()}`
}

// Chi può creare codici: Admin, agenti, Kumani con abbonamento Base o Pro attivo (non gli ospiti)
async function creator(): Promise<{ id: string; admin: boolean } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || isGuestUser(user)) return null
  if (await verifyAdmin('vouchers.write')) return { id: user.id, admin: true }
  if (user.app_metadata?.role === 'agent') return { id: user.id, admin: false }
  const { data: plan } = await db().rpc('plan_of', { p_user_id: user.id })
  return plan === 'base' || plan === 'pro' ? { id: user.id, admin: false } : null
}

export async function createTrialCode(input: { tool: string; duration: number }): Promise<{ success: true; row: TrialCodeRow } | { success: false; error: 'notAllowed' | 'invalid' | 'limit' | 'saveError' }> {
  const me = await creator()
  if (!me) return { success: false, error: 'notAllowed' }
  if (!isTrialTool(input.tool) || !TRIAL_DURATIONS.includes(input.duration as TrialDuration)) return { success: false, error: 'invalid' }
  const service = db()
  if (!me.admin) {
    const nowIso = new Date().toISOString()
    const { count } = await service
      .from('trial_codes')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', me.id)
      .is('revoked_at', null)
      .is('redeemed_at', null)
      .gt('activate_by', nowIso)
    if ((count ?? 0) >= MAX_ACTIVE_TRIAL_CODES) return { success: false, error: 'limit' }
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await service
      .from('trial_codes')
      .insert({
        code: newTrialCode(),
        tool: input.tool,
        duration_minutes: input.duration,
        created_by: me.id,
        activate_by: new Date(Date.now() + TRIAL_ACTIVATE_DAYS * 86_400_000).toISOString(),
      })
      .select('*')
      .single<DbRow>()
    if (!error && data) return { success: true, row: toRow(data) }
    if (error?.code !== '23505') break
  }
  return { success: false, error: 'saveError' }
}

export async function listMyTrialCodes(): Promise<{ rows: TrialCodeRow[]; canCreate: boolean; inviteLink: string | null }> {
  const me = await creator()
  if (!me) return { rows: [], canCreate: false, inviteLink: null }
  const { data } = await db()
    .from('trial_codes')
    .select('*')
    .eq('created_by', me.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  return { rows: ((data ?? []) as DbRow[]).map(toRow), canCreate: true, inviteLink: null }
}

// Cancella un codice (proprio, o qualsiasi per l'Admin). Se la prova è in
// corso, l'accesso dell'ospite si chiude subito.
export async function deleteTrialCode(id: string): Promise<{ success: boolean }> {
  const me = await creator()
  if (!me) return { success: false }
  const service = db()
  const { data: row } = await service.from('trial_codes').select('*').eq('id', id).maybeSingle<DbRow>()
  if (!row || (!me.admin && row.created_by !== me.id)) return { success: false }
  const nowIso = new Date().toISOString()
  await service.from('trial_codes').update({ revoked_at: nowIso }).eq('id', id)
  if (row.redeemed_by && row.access_until && new Date(row.access_until).getTime() > Date.now()) {
    await endGuestAccess(row.redeemed_by)
  }
  return { success: true }
}

async function endGuestAccess(userId: string) {
  const service = db()
  const past = new Date(Date.now() - 1000).toISOString()
  await Promise.all([
    service.from('profiles').update({ guest_until: past }).eq('id', userId).not('guest_until', 'is', null),
    service.from('tool_passes').update({ revoked_at: past }).eq('user_id', userId).eq('source', 'trial'),
    service.from('trial_codes').update({ access_until: past }).eq('redeemed_by', userId),
  ])
  // Fine prova anche nell'account: al prossimo passaggio l'ospite esce
  await service.auth.admin.updateUserById(userId, { app_metadata: { role: 'guest', trial_until: past } })
}

// ---- Admin: tutti i codici, con il nome di chi li ha creati
export async function adminListTrialCodes(): Promise<{ rows: TrialCodeRow[]; error: string | null }> {
  const admin = await verifyAdmin('vouchers.read')
  if (!admin) return { rows: [], error: 'Non autorizzato' }
  const service = db()
  const { data, error } = await service.from('trial_codes').select('*').order('created_at', { ascending: false }).limit(300)
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []) as DbRow[]
  const ids = [...new Set(rows.map((r) => r.created_by))]
  const { data: people } = ids.length
    ? await service.from('profiles').select('id, first_name, last_name, email').in('id', ids)
    : { data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] }
  const names = new Map((people ?? []).map((p) => [p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || '—']))
  return { rows: rows.map((r) => ({ ...toRow(r), creator: names.get(r.created_by) ?? '—' })), error: null }
}

// ---- Pagina /prova/CODICE

export type TrialCodeInfo =
  | { state: 'ok'; tool: string; durationMinutes: number; inviter: string | null }
  | { state: 'used' | 'expired' | 'missing' }

export async function getTrialCodeInfo(code: string): Promise<TrialCodeInfo> {
  const clean = code.trim().toUpperCase()
  if (!/^PR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean)) return { state: 'missing' }
  const service = db()
  const { data: row } = await service.from('trial_codes').select('*').eq('code', clean).maybeSingle<DbRow>()
  if (!row || row.revoked_at) return { state: 'missing' }
  if (row.redeemed_at) return { state: 'used' }
  if (new Date(row.activate_by).getTime() < Date.now()) return { state: 'expired' }
  const { data: p } = await service.from('profiles').select('first_name, is_admin').eq('id', row.created_by).maybeSingle<{ first_name: string | null; is_admin: boolean }>()
  return { state: 'ok', tool: row.tool, durationMinutes: row.duration_minutes, inviter: p?.is_admin ? null : (p?.first_name ?? null) }
}

// L'ospite avvia la prova: account temporaneo, Pass del solo servizio, accesso.
export async function startTrial(formData: FormData): Promise<void> {
  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const locale = String(formData.get('locale') ?? 'it')
  const prefix = locale === 'it' ? '' : `/${locale}`
  const back = (reason: string) => redirect(`${prefix}/prova/${encodeURIComponent(code)}?e=${reason}`)
  if (formData.get('terms') !== 'on') back('terms')

  const supabase = await createClient()
  const {
    data: { user: current },
  } = await supabase.auth.getUser()
  // Chi è già collegato con un account vero non diventa ospite
  if (current && !isGuestUser(current)) back('loggedIn')

  const service = db()
  const { data: row } = await service.from('trial_codes').select('*').eq('code', code).maybeSingle<DbRow>()
  if (!row || row.revoked_at || row.redeemed_at || new Date(row.activate_by).getTime() < Date.now()) back('invalid')
  const trial = row as DbRow
  const until = new Date(Date.now() + trial.duration_minutes * 60_000)

  // Prenota il codice (una sola persona): solo se ancora libero
  const { data: claimed } = await service
    .from('trial_codes')
    .update({ redeemed_at: new Date().toISOString(), access_until: until.toISOString() })
    .eq('id', trial.id)
    .is('redeemed_at', null)
    .is('revoked_at', null)
    .select('id')
  if (!claimed?.length) back('invalid')

  const release = () => service.from('trial_codes').update({ redeemed_at: null, access_until: null }).eq('id', trial.id)
  const email = `ospite-${trial.code.toLowerCase()}-${randomInt(1_000_000)}@guest.kumani.invalid`
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: 'guest', trial_tool: trial.tool, trial_until: until.toISOString(), trial_code: trial.code },
    user_metadata: { first_name: 'Ospite' },
  })
  if (error || !created.user) {
    await release()
    back('error')
  }
  const userId = created.user!.id
  const fail = async () => {
    await service.auth.admin.deleteUser(userId)
    await release()
    back('error')
  }

  const { error: profileError } = await service.from('profiles').insert({
    id: userId,
    email,
    username: `ospite_${randomInt(10_000_000)}`,
    first_name: 'Ospite',
    last_name: '',
    date_of_birth: '2000-01-01',
    country_code: 'IT',
    referral_code: `guest-${userId}`,
    subscription_status: 'free',
    sponsor_id: null,
    signup_source: 'direct',
    guest_until: until.toISOString(),
    guest_tool: trial.tool,
  })
  if (profileError) await fail()

  const { error: passError } = await service.from('tool_passes').insert({
    user_id: userId,
    tool: trial.tool,
    starts_at: new Date().toISOString(),
    expires_at: until.toISOString(),
    source: 'trial',
    amount_cents: 0,
    code: trial.code,
  })
  if (passError) await fail()
  await service.from('trial_codes').update({ redeemed_by: userId }).eq('id', trial.id)

  // Accesso senza email né password: link di accesso generato e verificato dal server
  const { data: link, error: linkError } = await service.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkError || !link?.properties?.hashed_token) await fail()
  if (current) await supabase.auth.signOut()
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: link!.properties!.hashed_token })
  if (verifyError) await fail()

  redirect(`${prefix}${trialToolPath(trial.tool)}`)
}

// Fine anticipata decisa dall'ospite ("Esci dalla prova")
export async function leaveTrial(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user && isGuestUser(user)) {
    await endGuestAccess(user.id)
    await supabase.auth.signOut()
  }
}

// Dove registrarsi dopo la prova: con l'invito di chi ha mandato il codice
export async function trialSignupHref(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return '/register'
  const service = db()
  const { data: row } = await service.from('trial_codes').select('created_by').eq('redeemed_by', user.id).maybeSingle<{ created_by: string }>()
  if (!row) return '/register'
  const [{ data: agent }, { data: p }] = await Promise.all([
    service.from('agents').select('code').eq('user_id', row.created_by).maybeSingle<{ code: string }>(),
    service.from('profiles').select('referral_code, is_admin').eq('id', row.created_by).maybeSingle<{ referral_code: string | null; is_admin: boolean }>(),
  ])
  if (agent?.code) return `/register?agente=${encodeURIComponent(agent.code)}`
  if (p?.referral_code && !p.is_admin) return `/register?sponsor=${encodeURIComponent(p.referral_code)}`
  return '/register'
}

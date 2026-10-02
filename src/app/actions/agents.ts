'use server'

import { randomInt } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { SITE_URL } from '@/lib/siteUrl'
import { agentRankingPosition } from '@/lib/agentRanking'
import {
  TAX_REGIMES,
  commissionState,
  isValidFiscalCode,
  isValidIban,
  isValidSdiCode,
  isValidVatNumber,
  normalizeIbanValue,
  type CommissionState,
  type TaxRegime,
} from '@/lib/agents'

// Agenti venditori: area dell'agente e gestione dall'Admin (Agenti).
// Tutto passa dal server con la chiave di servizio, dopo aver verificato
// chi chiede: le tabelle degli agenti non sono leggibili dal browser.

function db() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// "Mario R." (i clienti dell'agente si vedono con nome e iniziale)
function shortName(first: string | null, last: string | null): string {
  const f = (first ?? '').trim()
  const l = (last ?? '').trim()
  return `${f}${l ? ` ${l[0].toUpperCase()}.` : ''}`.trim() || '—'
}

// Data e ora di Roma di un istante
function romeParts(at: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((x) => [x.type, x.value])
  ) as Record<string, string>
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), min: Number(p.minute), weekday: p.weekday }
}

// Mezzanotte di Roma del giorno indicato, come istante (gestisce l'ora legale)
function romeMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d)
  const r = romeParts(new Date(guess))
  const offset = Date.UTC(r.y, r.m - 1, r.d, r.h, r.min) - guess
  return new Date(guess - offset)
}

// Inizio di oggi, della settimana (lunedì), del mese e dell'anno, ora italiana
function romeStarts(now = new Date()) {
  const { y, m, d, weekday } = romeParts(now)
  const back = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday)
  const monday = new Date(Date.UTC(y, m - 1, d - back))
  return {
    day: romeMidnight(y, m, d),
    week: romeMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()),
    month: romeMidnight(y, m, 1),
    year: romeMidnight(y, 1, 1),
  }
}

// ── Area dell'agente ────────────────────────────────────────────────────

async function currentAgentId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || (user.app_metadata as { role?: string } | undefined)?.role !== 'agent') return null
  const { data } = await db().from('agents').select('user_id, is_active').eq('user_id', user.id).maybeSingle()
  return data?.is_active ? user.id : null
}

export type AgentPeriodTotals = { sales: number; netCents: number; commissionCents: number }

export type AgentOverview = {
  agent: {
    name: string
    code: string
    link: string
    taxRegime: TaxRegime
    businessName: string | null
    commissionFirstPct: number
    commissionRenewalPct: number
  }
  periods: { today: AgentPeriodTotals; week: AgentPeriodTotals; month: AgentPeriodTotals; year: AgentPeriodTotals }
  wallet: { pendingCents: number; maturedCents: number; paidCents: number }
  customers: { name: string; joinedAt: string; plan: 'base' | 'pro' | null; active: boolean }[]
  commissions: {
    id: string
    createdAt: string
    customer: string
    kind: 'first' | 'renewal' | 'adjustment'
    plan: 'base' | 'pro' | null
    netCents: number
    pct: number
    commissionCents: number
    state: CommissionState
    maturesAt: string
    note: string | null
  }[]
  payouts: { paidOn: string; amountCents: number; reference: string | null }[]
  // Attivazioni e posizione tra gli agenti attivi (senza i nomi degli altri)
  ranking: { position: number | null; total: number; activations: number; renewals: number; customers: number; activeCustomers: number }
}

type CommissionRow = {
  id: string
  customer_id: string | null
  kind: 'first' | 'renewal' | 'adjustment'
  plan: 'base' | 'pro' | null
  net_cents: number
  pct: number
  commission_cents: number
  status: string
  matures_at: string
  note: string | null
  created_at: string
}

export async function getAgentOverview(locale: string): Promise<AgentOverview | null> {
  const agentId = await currentAgentId()
  if (!agentId) return null
  const client = db()
  const [{ data: agent }, { data: profile }, { data: customers }, { data: rows }, { data: payouts }] = await Promise.all([
    client.from('agents').select('code, tax_regime, business_name, commission_first_pct, commission_renewal_pct').eq('user_id', agentId).maybeSingle(),
    client.from('profiles').select('first_name, last_name').eq('id', agentId).maybeSingle(),
    client
      .from('profiles')
      .select('id, first_name, last_name, created_at, subscription_status, subscription_plan, subscription_expires_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(500),
    client
      .from('agent_commissions')
      .select('id, customer_id, kind, plan, net_cents, pct, commission_cents, status, matures_at, note, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1000),
    client.from('agent_payouts').select('paid_on, amount_cents, reference').eq('agent_id', agentId).order('paid_on', { ascending: false }).limit(200),
  ])
  if (!agent) return null

  const names = new Map((customers ?? []).map((c) => [c.id as string, shortName(c.first_name, c.last_name)]))
  const commissions = ((rows ?? []) as CommissionRow[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    customer: r.customer_id ? (names.get(r.customer_id) ?? '—') : '—',
    kind: r.kind,
    plan: r.plan,
    netCents: r.net_cents,
    pct: Number(r.pct),
    commissionCents: r.commission_cents,
    state: commissionState(r.status, r.matures_at),
    maturesAt: r.matures_at,
    note: r.note,
  }))

  const starts = romeStarts()
  const totals = (from: Date): AgentPeriodTotals => {
    const inPeriod = commissions.filter((c) => c.kind !== 'adjustment' && c.state !== 'cancelled' && new Date(c.createdAt) >= from)
    return {
      sales: inPeriod.length,
      netCents: inPeriod.reduce((n, c) => n + c.netCents, 0),
      commissionCents: inPeriod.reduce((n, c) => n + c.commissionCents, 0),
    }
  }
  const sumState = (state: CommissionState) => commissions.filter((c) => c.state === state).reduce((n, c) => n + c.commissionCents, 0)

  const now = Date.now()
  const rank = await agentRankingPosition(agentId)
  return {
    agent: {
      name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
      code: agent.code as string,
      link: `${SITE_URL}${locale === 'it' ? '' : `/${locale}`}/register?agente=${agent.code}`,
      taxRegime: agent.tax_regime as TaxRegime,
      businessName: (agent.business_name as string | null) ?? null,
      commissionFirstPct: Number(agent.commission_first_pct),
      commissionRenewalPct: Number(agent.commission_renewal_pct),
    },
    periods: { today: totals(starts.day), week: totals(starts.week), month: totals(starts.month), year: totals(starts.year) },
    wallet: { pendingCents: sumState('pending'), maturedCents: sumState('matured'), paidCents: sumState('paid') },
    customers: (customers ?? []).map((c) => {
      const active =
        c.subscription_status === 'active' && (!c.subscription_expires_at || new Date(c.subscription_expires_at as string).getTime() > now)
      return {
        name: shortName(c.first_name, c.last_name),
        joinedAt: c.created_at as string,
        plan: active ? ((c.subscription_plan as 'base' | 'pro' | null) ?? 'base') : null,
        active,
      }
    }),
    commissions,
    payouts: (payouts ?? []).map((p) => ({ paidOn: p.paid_on as string, amountCents: p.amount_cents as number, reference: (p.reference as string | null) ?? null })),
    ranking: {
      position: rank?.position ?? null,
      total: rank?.total ?? 0,
      activations: commissions.filter((c) => c.kind === 'first' && c.state !== 'cancelled').length,
      renewals: commissions.filter((c) => c.kind === 'renewal' && c.state !== 'cancelled').length,
      customers: (customers ?? []).length,
      activeCustomers: (customers ?? []).filter(
        (c) => c.subscription_status === 'active' && (!c.subscription_expires_at || new Date(c.subscription_expires_at as string).getTime() > now)
      ).length,
    },
  }
}

// ── Admin: gestione degli agenti ────────────────────────────────────────

export type AgentInput = {
  firstName: string
  lastName: string
  email: string
  password?: string
  phone: string
  dateOfBirth: string
  fiscalCode: string
  address: string
  postalCode: string
  city: string
  province: string
  countryCode: string
  taxRegime: string
  businessName?: string
  vatNumber?: string
  pec?: string
  sdiCode?: string
  iban?: string
  commissionFirstPct: number
  commissionRenewalPct: number
  notes?: string
}

type Clean = {
  profile: Record<string, unknown>
  agent: Record<string, unknown>
}

function cleanInput(input: AgentInput, forCreate: boolean): { ok: true; value: Clean; email: string } | { ok: false; error: string } {
  const t = (v: string | undefined, max = 120) => (v ?? '').trim().slice(0, max)
  const firstName = t(input.firstName, 80)
  const lastName = t(input.lastName, 80)
  const email = t(input.email, 200).toLowerCase()
  if (!firstName || !lastName) return { ok: false, error: 'Nome e cognome sono obbligatori' }
  if (forCreate && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Email non valida' }
  if (forCreate && (input.password ?? '').length < 10) return { ok: false, error: 'La password deve avere almeno 10 caratteri' }
  const phone = t(input.phone, 30)
  if (!/^\+?[0-9 ()-]{6,30}$/.test(phone)) return { ok: false, error: 'Telefono non valido' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth ?? '')) return { ok: false, error: 'Data di nascita non valida' }
  const fiscalCode = t(input.fiscalCode, 16).toUpperCase()
  if (!isValidFiscalCode(fiscalCode)) return { ok: false, error: 'Codice fiscale non valido' }
  const address = t(input.address, 200)
  const postalCode = t(input.postalCode, 10)
  const city = t(input.city, 80)
  const province = t(input.province, 40).toUpperCase()
  const countryCode = t(input.countryCode, 2).toUpperCase()
  if (!address || !postalCode || !city || !/^[A-Z]{2}$/.test(countryCode)) return { ok: false, error: 'Indirizzo completo obbligatorio (via, CAP, città, paese)' }
  if (!(TAX_REGIMES as readonly string[]).includes(input.taxRegime)) return { ok: false, error: 'Regime fiscale non valido' }
  const vatNumber = t(input.vatNumber, 13).replace(/^IT/i, '')
  if (input.taxRegime !== 'occasionale' && !isValidVatNumber(vatNumber)) return { ok: false, error: 'Partita IVA non valida (obbligatoria salvo prestazione occasionale)' }
  if (vatNumber && !isValidVatNumber(vatNumber)) return { ok: false, error: 'Partita IVA non valida' }
  const sdi = t(input.sdiCode, 7).toUpperCase()
  if (sdi && !isValidSdiCode(sdi)) return { ok: false, error: 'Codice destinatario SDI non valido (7 caratteri)' }
  const pec = t(input.pec, 120).toLowerCase()
  if (pec && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pec)) return { ok: false, error: 'PEC non valida' }
  const iban = input.iban ? normalizeIbanValue(input.iban) : ''
  if (iban && !isValidIban(iban)) return { ok: false, error: 'IBAN non valido' }
  const pct = (v: number) => Math.round(Math.min(Math.max(Number(v) || 0, 0), 100) * 100) / 100
  return {
    ok: true,
    email,
    value: {
      profile: {
        first_name: firstName,
        last_name: lastName,
        phone,
        date_of_birth: input.dateOfBirth,
        tax_code: fiscalCode,
        address,
        postal_code: postalCode,
        city,
        province: province || null,
        country_code: countryCode,
        occupation: 'Agente KUMANI',
      },
      agent: {
        tax_regime: input.taxRegime,
        business_name: t(input.businessName, 120) || null,
        vat_number: vatNumber || null,
        pec: pec || null,
        sdi_code: sdi || null,
        iban: iban || null,
        commission_first_pct: pct(input.commissionFirstPct),
        commission_renewal_pct: pct(input.commissionRenewalPct),
        notes: t(input.notes, 2000) || null,
      },
    },
  }
}

function newAgentCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'AG-'
  for (let i = 0; i < 6; i++) code += chars[randomInt(chars.length)]
  return code
}

export async function adminCreateAgent(input: AgentInput) {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false as const, error: 'Non autorizzato' }
  const cleaned = cleanInput(input, true)
  if (!cleaned.ok) return { success: false as const, error: cleaned.error }
  const client = db()

  const { data: created, error } = await client.auth.admin.createUser({
    email: cleaned.email,
    password: input.password!,
    email_confirm: true,
    app_metadata: { role: 'agent' },
    user_metadata: { first_name: cleaned.value.profile.first_name, last_name: cleaned.value.profile.last_name },
  })
  if (error || !created.user) {
    const exists = /already|registered|exists/i.test(error?.message ?? '')
    return { success: false as const, error: exists ? 'Esiste già un account con questa email' : error?.message || 'Creazione non riuscita' }
  }
  const userId = created.user.id
  const rollback = async (message: string) => {
    await client.auth.admin.deleteUser(userId)
    return { success: false as const, error: message }
  }

  // Profilo completo, senza sponsor, senza posto in matrice e senza codice
  // invito (l'agente non fa parte della rete)
  const baseProfile = {
    id: userId,
    email: cleaned.email,
    username: `${cleaned.email.split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 20) || 'agente'}_${randomInt(10000)}`,
    ...cleaned.value.profile,
    subscription_status: 'free',
    sponsor_id: null,
    signup_source: 'direct',
    profile_completed_at: new Date().toISOString(),
  }
  let code = newAgentCode()
  let { error: profileError } = await client.from('profiles').insert({ ...baseProfile, referral_code: null })
  // Se il codice invito è obbligatorio si usa il codice agente (che non vale
  // come invito: complete_registration esclude gli agenti)
  if (profileError?.code === '23502') {
    ;({ error: profileError } = await client.from('profiles').insert({ ...baseProfile, referral_code: code }))
  }
  if (profileError) {
    return rollback(profileError.code === '23505' ? 'Codice fiscale già usato da un altro account' : `Profilo non creato: ${profileError.message}`)
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: agentError } = await client.from('agents').insert({ user_id: userId, code, created_by: admin.id, ...cleaned.value.agent })
    if (!agentError) return { success: true as const, code }
    if (agentError.code !== '23505') {
      await client.from('profiles').delete().eq('id', userId)
      return rollback(`Scheda agente non creata: ${agentError.message} (hai eseguito la migrazione degli agenti?)`)
    }
    code = newAgentCode()
  }
  await client.from('profiles').delete().eq('id', userId)
  return rollback('Scheda agente non creata')
}

export async function adminUpdateAgent(id: string, input: AgentInput) {
  if (!(await verifyAdmin('users.write'))) return { success: false as const, error: 'Non autorizzato' }
  const cleaned = cleanInput(input, false)
  if (!cleaned.ok) return { success: false as const, error: cleaned.error }
  const client = db()
  const { data: exists } = await client.from('agents').select('user_id').eq('user_id', id).maybeSingle()
  if (!exists) return { success: false as const, error: 'Agente non trovato' }
  const { error: profileError } = await client.from('profiles').update(cleaned.value.profile).eq('id', id)
  if (profileError) return { success: false as const, error: profileError.code === '23505' ? 'Codice fiscale già usato da un altro account' : profileError.message }
  const { error } = await client
    .from('agents')
    .update({ ...cleaned.value.agent, updated_at: new Date().toISOString() })
    .eq('user_id', id)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export async function adminSetAgentActive(id: string, active: boolean) {
  if (!(await verifyAdmin('users.write'))) return { success: false as const, error: 'Non autorizzato' }
  const client = db()
  const { data: exists } = await client.from('agents').select('user_id').eq('user_id', id).maybeSingle()
  if (!exists) return { success: false as const, error: 'Agente non trovato' }
  // Sospeso: non entra più e non ha più i servizi; le provvigioni restano
  const { error: banError } = await client.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' })
  if (banError) return { success: false as const, error: banError.message }
  const { error } = await client.from('agents').update({ is_active: active, updated_at: new Date().toISOString() }).eq('user_id', id)
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export async function adminSetAgentPassword(id: string, password: string) {
  if (!(await verifyAdmin('users.write'))) return { success: false as const, error: 'Non autorizzato' }
  if (password.length < 10) return { success: false as const, error: 'La password deve avere almeno 10 caratteri' }
  const client = db()
  const { data: exists } = await client.from('agents').select('user_id').eq('user_id', id).maybeSingle()
  if (!exists) return { success: false as const, error: 'Agente non trovato' }
  const { error } = await client.auth.admin.updateUserById(id, { password })
  if (error) return { success: false as const, error: error.message }
  return { success: true as const }
}

export type AdminAgent = AgentInput & {
  id: string
  code: string
  isActive: boolean
  createdAt: string
  customers: number
  pendingCents: number
  maturedCents: number
  paidCents: number
}

export async function adminListAgents(): Promise<{ agents: AdminAgent[] } | { error: string }> {
  if (!(await verifyAdmin('users.write'))) return { error: 'Non autorizzato' }
  const client = db()
  const { data: agents, error } = await client.from('agents').select('*').order('created_at', { ascending: false })
  if (error) return { error: error.message }
  const ids = (agents ?? []).map((a) => a.user_id as string)
  if (ids.length === 0) return { agents: [] }
  const [{ data: profiles }, { data: commissions }, { data: customers }] = await Promise.all([
    client
      .from('profiles')
      .select('id, email, first_name, last_name, phone, date_of_birth, tax_code, address, postal_code, city, province, country_code')
      .in('id', ids),
    client.from('agent_commissions').select('agent_id, status, matures_at, commission_cents').in('agent_id', ids),
    client.from('profiles').select('agent_id').in('agent_id', ids),
  ])
  const profileOf = new Map((profiles ?? []).map((p) => [p.id as string, p]))
  return {
    agents: (agents ?? []).map((a) => {
      const p = profileOf.get(a.user_id as string)
      const mine = (commissions ?? []).filter((c) => c.agent_id === a.user_id)
      const sum = (state: CommissionState) =>
        mine.filter((c) => commissionState(c.status as string, c.matures_at as string) === state).reduce((n, c) => n + (c.commission_cents as number), 0)
      return {
        id: a.user_id as string,
        code: a.code as string,
        isActive: a.is_active as boolean,
        createdAt: a.created_at as string,
        customers: (customers ?? []).filter((c) => c.agent_id === a.user_id).length,
        pendingCents: sum('pending'),
        maturedCents: sum('matured'),
        paidCents: sum('paid'),
        firstName: (p?.first_name as string) ?? '',
        lastName: (p?.last_name as string) ?? '',
        email: (p?.email as string) ?? '',
        phone: (p?.phone as string) ?? '',
        dateOfBirth: (p?.date_of_birth as string) ?? '',
        fiscalCode: (p?.tax_code as string) ?? '',
        address: (p?.address as string) ?? '',
        postalCode: (p?.postal_code as string) ?? '',
        city: (p?.city as string) ?? '',
        province: (p?.province as string) ?? '',
        countryCode: (p?.country_code as string) ?? 'IT',
        taxRegime: a.tax_regime as string,
        businessName: (a.business_name as string) ?? '',
        vatNumber: (a.vat_number as string) ?? '',
        pec: (a.pec as string) ?? '',
        sdiCode: (a.sdi_code as string) ?? '',
        iban: (a.iban as string) ?? '',
        commissionFirstPct: Number(a.commission_first_pct),
        commissionRenewalPct: Number(a.commission_renewal_pct),
        notes: (a.notes as string) ?? '',
      }
    }),
  }
}

export type AdminCommission = {
  id: string
  createdAt: string
  customer: string
  kind: 'first' | 'renewal' | 'adjustment'
  plan: 'base' | 'pro' | null
  grossCents: number
  netCents: number
  pct: number
  commissionCents: number
  state: CommissionState
  maturesAt: string
  paidOn: string | null
  note: string | null
}

export async function adminListAgentCommissions(agentId: string): Promise<{ commissions: AdminCommission[]; payouts: { id: string; paidOn: string; amountCents: number; reference: string | null }[] } | { error: string }> {
  if (!(await verifyAdmin('users.write'))) return { error: 'Non autorizzato' }
  const client = db()
  const [{ data: rows, error }, { data: payouts }] = await Promise.all([
    client
      .from('agent_commissions')
      .select('id, customer_id, kind, plan, gross_cents, net_cents, pct, commission_cents, status, matures_at, payout_id, note, created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(2000),
    client.from('agent_payouts').select('id, paid_on, amount_cents, reference').eq('agent_id', agentId).order('paid_on', { ascending: false }),
  ])
  if (error) return { error: error.message }
  const customerIds = [...new Set((rows ?? []).map((r) => r.customer_id as string | null).filter((v): v is string => !!v))]
  const { data: people } = customerIds.length ? await client.from('profiles').select('id, first_name, last_name').in('id', customerIds) : { data: [] }
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()]))
  const paidOnOf = new Map((payouts ?? []).map((p) => [p.id as string, p.paid_on as string]))
  return {
    commissions: (rows ?? []).map((r) => ({
      id: r.id as string,
      createdAt: r.created_at as string,
      customer: r.customer_id ? (nameOf.get(r.customer_id as string) ?? '—') : '—',
      kind: r.kind as AdminCommission['kind'],
      plan: (r.plan as AdminCommission['plan']) ?? null,
      grossCents: r.gross_cents as number,
      netCents: r.net_cents as number,
      pct: Number(r.pct),
      commissionCents: r.commission_cents as number,
      state: commissionState(r.status as string, r.matures_at as string),
      maturesAt: r.matures_at as string,
      paidOn: r.payout_id ? (paidOnOf.get(r.payout_id as string) ?? null) : null,
      note: (r.note as string | null) ?? null,
    })),
    payouts: (payouts ?? []).map((p) => ({ id: p.id as string, paidOn: p.paid_on as string, amountCents: p.amount_cents as number, reference: (p.reference as string | null) ?? null })),
  }
}

// Segna come pagate le provvigioni maturate scelte (bonifico fatto dallo Staff)
export async function adminPayAgentCommissions(agentId: string, commissionIds: string[], paidOn: string, reference: string) {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false as const, error: 'Non autorizzato' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { success: false as const, error: 'Data del pagamento non valida' }
  if (commissionIds.length === 0) return { success: false as const, error: 'Scegli almeno una provvigione' }
  const client = db()
  const { data: rows } = await client
    .from('agent_commissions')
    .select('id, status, matures_at, commission_cents')
    .eq('agent_id', agentId)
    .in('id', commissionIds)
  const payable = (rows ?? []).filter((r) => commissionState(r.status as string, r.matures_at as string) === 'matured')
  if (payable.length === 0) return { success: false as const, error: 'Nessuna provvigione maturata tra quelle scelte' }
  const amount = payable.reduce((n, r) => n + (r.commission_cents as number), 0)
  const { data: payout, error } = await client
    .from('agent_payouts')
    .insert({ agent_id: agentId, amount_cents: amount, paid_on: paidOn, reference: reference.trim().slice(0, 200) || null, created_by: admin.id })
    .select('id')
    .single()
  if (error || !payout) return { success: false as const, error: error?.message ?? 'Pagamento non registrato' }
  const { error: updateError } = await client
    .from('agent_commissions')
    .update({ status: 'paid', payout_id: payout.id })
    .in('id', payable.map((r) => r.id as string))
    .eq('status', 'pending')
  if (updateError) return { success: false as const, error: updateError.message }
  return { success: true as const, amountCents: amount, count: payable.length }
}

// Annulla a mano una provvigione non ancora pagata (es. accordo con il cliente)
export async function adminCancelAgentCommission(commissionId: string, note: string) {
  if (!(await verifyAdmin('users.write'))) return { success: false as const, error: 'Non autorizzato' }
  const { error, count } = await db()
    .from('agent_commissions')
    .update({ status: 'cancelled', note: note.trim().slice(0, 300) || 'Annullata dallo Staff' }, { count: 'exact' })
    .eq('id', commissionId)
    .eq('status', 'pending')
  if (error) return { success: false as const, error: error.message }
  if (!count) return { success: false as const, error: 'Provvigione già pagata o annullata' }
  return { success: true as const }
}

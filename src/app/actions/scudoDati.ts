'use server'

import { createHash } from 'node:crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { awardToolPoint } from '@/lib/toolPoints'
import { EMAIL_RE, type ScudoBreach, type ScudoResponse, type ScudoResult } from '@/lib/scudoDati'

// SCUDO DATI: l'email (propria o di un altro, a pagamento in KU Karma) si
// controlla su XposedOrNot dal server. Nel database resta solo l'impronta
// sha256 dell'email con l'esito (24 ore, per non richiamare il servizio) e i
// contatori dei limiti. Le email non vengono mai scritte nei log.

const CACHE_HOURS = 24
const TIMEOUT_MS = 8000
const MAX_BREACHES = 200

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

type XonBreach = {
  breach?: string
  domain?: string
  xposed_date?: string | number
  xposed_data?: string
  password_risk?: string
  logo?: string
}

type XonResponse = {
  ExposedBreaches?: { breaches_details?: XonBreach[] } | null
  PastesSummary?: { cnt?: number | string } | null
}

function normalize(data: XonResponse): ScudoResult {
  const details = Array.isArray(data.ExposedBreaches?.breaches_details) ? data.ExposedBreaches!.breaches_details! : []
  const breaches: ScudoBreach[] = details
    .map((b) => ({
      name: String(b.breach ?? '').slice(0, 120),
      domain: String(b.domain ?? '').slice(0, 120),
      date: String(b.xposed_date ?? '').slice(0, 7),
      dataClasses: String(b.xposed_data ?? '')
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 30),
      ...(b.password_risk ? { passwordRisk: String(b.password_risk).slice(0, 30) } : {}),
      ...(b.logo && /^https:\/\//.test(b.logo) ? { logo: String(b.logo).slice(0, 300) } : {}),
    }))
    .filter((b) => b.name)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_BREACHES)
  const pasteCount = Number(data.PastesSummary?.cnt ?? 0)
  return {
    breached: breaches.length > 0,
    breaches,
    pasteCount: Number.isFinite(pasteCount) && pasteCount > 0 ? pasteCount : 0,
    checkedAt: new Date().toISOString(),
  }
}

// Esito in cache (meno di 24 ore) per questa email, se c'è
async function cached(hash: string): Promise<ScudoResult | null> {
  const { data } = await service().from('scudo_dati_cache').select('result, checked_at').eq('email_hash', hash).maybeSingle()
  if (!data) return null
  if (Date.now() - new Date(data.checked_at as string).getTime() > CACHE_HOURS * 3600_000) return null
  return data.result as ScudoResult
}

// Chiamata a XposedOrNot (con il tetto giornaliero di tutto il sito)
async function fetchXon(email: string, hash: string): Promise<ScudoResult | 'busy' | 'failed'> {
  const db = service()
  const { data: allowed, error: capError } = await db.rpc('scudo_dati_take_call')
  if (capError) return 'failed'
  if (allowed !== true) return 'busy'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const headers: Record<string, string> = { 'User-Agent': 'KUMANI', Accept: 'application/json' }
    if (process.env.XON_API_KEY) headers['x-api-key'] = process.env.XON_API_KEY
    const res = await fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })
    let result: ScudoResult
    if (res.status === 404) {
      result = { breached: false, breaches: [], pasteCount: 0, checkedAt: new Date().toISOString() }
    } else if (!res.ok) {
      console.error('[scudo-dati] XposedOrNot status', res.status)
      return res.status === 429 ? 'busy' : 'failed'
    } else {
      result = normalize((await res.json()) as XonResponse)
    }
    await db.from('scudo_dati_cache').upsert({ email_hash: hash, result, checked_at: result.checkedAt }, { onConflict: 'email_hash' })
    return result
  } catch (error) {
    console.error('[scudo-dati] XposedOrNot error:', error instanceof Error ? error.name : 'unknown')
    return 'failed'
  } finally {
    clearTimeout(timer)
  }
}

const hashEmail = (email: string) => createHash('sha256').update(email).digest('hex')

async function costOfOther(): Promise<number> {
  const { data } = await service().from('system_settings').select('value').eq('key', 'scudo_dati_other_cost').maybeSingle()
  const value = parseInt(String(data?.value ?? '3').replace(/"/g, ''), 10)
  return Number.isFinite(value) && value >= 0 ? value : 3
}

// Controlla l'email dell'account (gratis, 5 controlli nuovi al giorno)
export async function checkMyEmail(): Promise<ScudoResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'auth' }
  const email = (user.email ?? '').trim().toLowerCase()
  if (!email) return { ok: false, error: 'no_email' }
  const hash = hashEmail(email)

  // Già controllata nelle ultime 24 ore: nessun limite consumato (serve
  // comunque il servizio incluso nel piano)
  const hit = await cached(hash)
  if (hit) {
    const { data: access } = await supabase.rpc('can_use_tool', { p_tool: 'scudo-dati' }).maybeSingle<{ allowed: boolean }>()
    if (!access?.allowed) return { ok: false, error: 'not_allowed' }
    await awardToolPoint('scudo-dati')
    return { ok: true, result: hit }
  }

  const { data: reservation } = await supabase.rpc('scudo_dati_reserve', { p_kind: 'own' })
  const reserved = (reservation as { result?: string } | null)?.result
  if (reserved === 'not_allowed') return { ok: false, error: 'not_allowed' }
  if (reserved === 'user_limit') return { ok: false, error: 'limit' }
  if (reserved !== 'ok') return { ok: false, error: 'failed' }

  const result = await fetchXon(email, hash)
  if (typeof result === 'string') {
    await service().rpc('scudo_dati_release_for', { p_user: user.id, p_kind: 'own' })
    return { ok: false, error: result }
  }
  await awardToolPoint('scudo-dati')
  return { ok: true, result }
}

// Controlla un'altra email: costa KU Karma (scalati solo se il controllo
// riesce), 10 al giorno
export async function checkOtherEmail(rawEmail: string): Promise<ScudoResponse> {
  const email = String(rawEmail ?? '').trim().toLowerCase()
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: 'invalid' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'auth' }

  const [cost, { data: profile }] = await Promise.all([
    costOfOther(),
    supabase.rpc('get_my_profile').maybeSingle<{ daily_points: number | null }>(),
  ])
  const balance = profile?.daily_points ?? 0
  if (balance < cost) return { ok: false, error: 'karma', cost, balance }

  const { data: reservation } = await supabase.rpc('scudo_dati_reserve', { p_kind: 'other' })
  const reserved = (reservation as { result?: string } | null)?.result
  if (reserved === 'not_allowed') return { ok: false, error: 'not_allowed' }
  if (reserved === 'user_limit') return { ok: false, error: 'limit' }
  if (reserved !== 'ok') return { ok: false, error: 'failed' }

  const hash = hashEmail(email)
  const result = (await cached(hash)) ?? (await fetchXon(email, hash))
  if (typeof result === 'string') {
    await service().rpc('scudo_dati_release_for', { p_user: user.id, p_kind: 'other' })
    return { ok: false, error: result }
  }

  // Controllo riuscito: ora si scalano i KU Karma
  let newBalance = balance
  if (cost > 0) {
    const { data: spent, error: spendError } = await supabase
      .rpc('spend_daily_points', { p_amount: cost })
      .single<{ success: boolean; new_daily_points: number }>()
    if (spendError || !spent?.success) {
      await service().rpc('scudo_dati_release_for', { p_user: user.id, p_kind: 'other' })
      return { ok: false, error: 'karma', cost, balance: spent?.new_daily_points ?? balance }
    }
    newBalance = spent.new_daily_points
  }
  // KU Karma del giorno per l'uso del servizio (una volta al giorno): il
  // saldo restituito tiene conto anche di questo
  const award = await awardToolPoint('scudo-dati')
  if (award?.awarded) newBalance = award.new_balance
  return { ok: true, result, balance: newBalance }
}

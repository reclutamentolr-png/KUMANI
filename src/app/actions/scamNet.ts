'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { awardRareCard, captureScamCard, cardForCategory, type CapturedCard } from '@/lib/scamCards/capture'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { localizedPath, notifyUser } from '@/lib/push'
import { appLimitValue } from '@/lib/appLimits'
import { notifyAdminsOfScamReport } from '@/lib/staffAlerts'
import {
  SCAM_CATEGORIES,
  SCAM_CONTEST_MAX,
  SCAM_DESCRIPTION_MAX,
  SCAM_KINDS,
  guardianLevel,
  maskIban,
  normalizeEmail,
  normalizeQr,
  normalizeScamIban,
  normalizeSite,
  normalizeSocial,
  siteKeys,
  type GuardianLevel,
  type ScamCategory,
  type ScamKind,
  type ScamTargetKey,
} from '@/lib/scamNet'
import { normalizePhone, phoneInfo, type PhoneInfo } from '@/lib/scamNetPhone'

// RETE ANTI-TRUFFA: tutto passa dal server con la chiave di servizio; le
// tabelle non hanno regole di lettura per gli utenti. Chi segnala resta
// anonimo: agli altri arrivano solo conteggi, categorie, città e testi.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALIDITY_MS = 365 * 86_400_000 // un avviso vale 12 mesi dall'ultima segnalazione
const DAY = 86_400_000

type Ok<T> = { success: true; data: T }
type Fail = { success: false; message: string }

async function currentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

function normalize(kind: ScamKind, value: string): ScamTargetKey | null {
  switch (kind) {
    case 'phone':
      return normalizePhone(value)
    case 'site':
      return normalizeSite(value)
    case 'iban':
      return normalizeScamIban(value)
    case 'email':
      return normalizeEmail(value)
    case 'social':
      return normalizeSocial(value)
    case 'qr': {
      if (/^(tel:|\+|00)/i.test(value.trim())) return normalizePhone(value)
      return normalizeQr(value)
    }
  }
}

// Dato come lo vedono gli altri: numeri e IBAN in parte nascosti
// I numeri confermati come truffa si vedono interi (sono dei truffatori); gli
// IBAN restano in parte nascosti
function shownValue(kind: string, display: string, key: string): string {
  if (kind === 'iban') return maskIban(key)
  return display
}

// ---------- Segnalare ----------

export async function submitScamReport(input: { kind: string; value: string; category: string; description?: string; evidencePath?: string | null }): Promise<Ok<{ status: 'pending' | 'confirmed'; id: string }> | Fail> {
  const user = await currentUser()
  if (!user) return { success: false, message: 'auth' }
  if (!(SCAM_KINDS as readonly string[]).includes(input.kind)) return { success: false, message: 'invalid_kind' }
  if (!(SCAM_CATEGORIES as readonly string[]).includes(input.category)) return { success: false, message: 'invalid_category' }
  const target = normalize(input.kind as ScamKind, String(input.value ?? ''))
  if (!target) return { success: false, message: 'invalid_value' }
  const description = String(input.description ?? '').trim().slice(0, SCAM_DESCRIPTION_MAX) || null
  const evidence = input.evidencePath && input.evidencePath.startsWith(`${user.id}/`) ? input.evidencePath.slice(0, 200) : null
  const service = db()

  // Limite al giorno per persona
  const limit = (await appLimitValue('scam_reports_per_day')) ?? 5
  const { count } = await service.from('scam_reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(Date.now() - DAY).toISOString())
  if ((count ?? 0) >= limit) return { success: false, message: 'limit' }

  // Il dato segnalato (uno solo per numero/sito/IBAN…)
  let { data: row } = await service.from('scam_targets').select('id, status').eq('kind', target.kind).eq('value_key', target.key).maybeSingle()
  if (!row) {
    const { data: created, error } = await service
      .from('scam_targets')
      .insert({ kind: target.kind, value_key: target.key, display: target.display, category: input.category })
      .select('id, status')
      .single()
    if (error) {
      // creato nello stesso istante da un'altra persona
      const again = await service.from('scam_targets').select('id, status').eq('kind', target.kind).eq('value_key', target.key).maybeSingle()
      row = again.data
    } else row = created
  }
  if (!row) return { success: false, message: 'save' }

  // Su un dato già confermato la segnalazione vale subito (e dà i KU Karma)
  const confirmedTarget = row.status === 'confirmed'
  const { data: report, error } = await service
    .from('scam_reports')
    .insert({ target_id: row.id, user_id: user.id, category: input.category, description, evidence_path: confirmedTarget ? null : evidence, status: confirmedTarget ? 'confirmed' : 'pending', rewarded: false })
    .select('id')
    .single()
  if (error) return { success: false, message: error.code === '23505' ? 'already' : 'save' }
  if (confirmedTarget) {
    if (evidence) await service.storage.from('scam-evidence').remove([evidence])
    await rewardReports([report.id])
  } else if (row.status === 'dismissed') {
    // nuova segnalazione su un dato scartato: torna da controllare
    await service.from('scam_targets').update({ status: 'pending' }).eq('id', row.id)
  }
  await service.from('scam_targets').update({ last_report_at: new Date().toISOString() }).eq('id', row.id)
  await service.rpc('scam_target_refresh', { p_target: row.id })
  await notifyAdminsOfScamReport({ id: report.id, value: target.display, confirmed: confirmedTarget }, user.id)
  return { success: true, data: { status: confirmedTarget ? 'confirmed' : 'pending', id: report.id } }
}

// KU Karma per segnalazioni confermate subito (dato già confermato)
async function rewardReports(ids: string[]) {
  const service = db()
  const { data: points } = await service.from('ku_activity_points').select('points').eq('key', 'scam_report_confirmed').maybeSingle()
  const ku = points?.points ?? 2
  for (const id of ids) {
    const { data } = await service.from('scam_reports').update({ rewarded: true, decided_at: new Date().toISOString() }).eq('id', id).eq('rewarded', false).select('user_id').maybeSingle()
    if (!data?.user_id || ku <= 0) continue
    const { data: profile } = await service.from('profiles').select('daily_points, ku_earned_total').eq('id', data.user_id).maybeSingle()
    if (!profile) continue
    await service
      .from('profiles')
      .update({ daily_points: (profile.daily_points ?? 0) + ku, ku_earned_total: (profile.ku_earned_total ?? 0) + ku })
      .eq('id', data.user_id)
  }
}

// ---------- Controllare ----------

export type ScamMatch = {
  kind: ScamKind
  value: string
  reports: number
  category: ScamCategory | null
  lastReportAt: string
  quotes: { text: string; city: string | null; at: string }[]
  targetId: string
  // Carte Antitruffa: la carta di questa truffa, catturata da chi controlla
  card?: CapturedCard | null
}

// Avvisi confermati per i dati di un controllo (SVAT, IBAN, CheckMail, QR, numero)
export async function scamLookup(items: { kind: string; value: string }[]): Promise<ScamMatch[]> {
  const user = await currentUser()
  if (!user) return []
  const service = db()
  const keys: { kind: ScamKind; key: string }[] = []
  for (const item of items.slice(0, 12)) {
    if (!(SCAM_KINDS as readonly string[]).includes(item.kind)) continue
    const target = normalize(item.kind as ScamKind, String(item.value ?? ''))
    if (!target) continue
    if (target.kind === 'site') for (const k of siteKeys(target.key)) keys.push({ kind: 'site', key: k })
    else keys.push({ kind: target.kind, key: target.key })
    // l'email di un mittente vale anche per il suo dominio
    if (target.kind === 'email') for (const k of siteKeys(target.key.split('@')[1] ?? '')) keys.push({ kind: 'site', key: k })
  }
  if (!keys.length) return []
  const since = new Date(Date.now() - VALIDITY_MS).toISOString()
  const found: ScamMatch[] = []
  const seen = new Set<string>()
  for (const kind of [...new Set(keys.map((k) => k.kind))]) {
    const values = [...new Set(keys.filter((k) => k.kind === kind).map((k) => k.key))]
    const { data } = await service
      .from('scam_targets')
      .select('id, kind, value_key, display, category, confirmed_reports, last_report_at, public_story')
      .eq('kind', kind)
      .eq('status', 'confirmed')
      .gte('last_report_at', since)
      .in('value_key', values)
    for (const t of data ?? []) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      const { data: reports } = await service
        .from('scam_reports')
        .select('category')
        .eq('target_id', t.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(20)
      const counts = new Map<string, number>()
      for (const r of reports ?? []) counts.set(r.category, (counts.get(r.category) ?? 0) + 1)
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? t.category
      found.push({
        kind: t.kind as ScamKind,
        value: t.display,
        reports: Math.max(t.confirmed_reports, 1),
        category: (top as ScamCategory) ?? null,
        lastReportAt: t.last_report_at,
        // Solo il racconto approvato dallo Staff: mai chi ha segnalato né la sua città
        quotes: t.public_story ? [{ text: t.public_story as string, city: null, at: t.last_report_at }] : [],
        targetId: t.id,
      })
    }
  }
  if (found.length) await service.from('scam_hits').insert(found.map((f) => ({ target_id: f.targetId })))
  // Carte Antitruffa: la prima truffa confermata di cui c'è la carta
  const withCard = found.find((f) => cardForCategory(f.category) || f.kind === 'qr')
  if (withCard) withCard.card = await captureScamCard(user.id, cardForCategory(withCard.category) ?? 15, 'community')
  return found
}

// «Chi mi ha chiamato?»: che numero è e se la community l'ha segnalato
export async function checkPhone(raw: string): Promise<Ok<{ info: PhoneInfo; match: ScamMatch | null }> | Fail> {
  const user = await currentUser()
  if (!user) return { success: false, message: 'auth' }
  const info = phoneInfo(raw)
  if (!info) return { success: false, message: 'invalid_value' }
  const [match] = await scamLookup([{ kind: 'phone', value: info.e164 }])
  return { success: true, data: { info, match: match ?? null } }
}

// ---------- Allerta della community ----------

export type ScamAlerts = {
  reports7: number
  hits7: number
  reporters7: number
  categories: { category: ScamCategory; count: number; prev: number; kinds: ScamKind[] }[]
  recent: { kind: ScamKind; value: string; category: ScamCategory | null; reports: number; at: string; story: string | null }[]
  alertsOn: boolean
}

export async function scamAlerts(): Promise<ScamAlerts | null> {
  const user = await currentUser()
  if (!user) return null
  const service = db()
  const week = new Date(Date.now() - 7 * DAY).toISOString()
  const twoWeeks = new Date(Date.now() - 14 * DAY).toISOString()
  const [{ data: recentReports }, { count: hits7 }, { data: confirmedTargets }, { data: pref }] = await Promise.all([
    service.from('scam_reports').select('user_id, category, created_at, status, scam_targets!inner(kind, status)').gte('created_at', twoWeeks).neq('status', 'dismissed').limit(10000),
    service.from('scam_hits').select('id', { count: 'exact', head: true }).gte('created_at', week),
    service
      .from('scam_targets')
      .select('kind, value_key, display, category, confirmed_reports, last_report_at, public_story')
      .eq('status', 'confirmed')
      .gte('last_report_at', new Date(Date.now() - VALIDITY_MS).toISOString())
      .order('last_report_at', { ascending: false })
      .limit(12),
    service.from('push_preferences').select('alerts').eq('user_id', user.id).maybeSingle(),
  ])
  type Row = { user_id: string | null; category: string; created_at: string; scam_targets: { kind: string; status: string } | { kind: string; status: string }[] }
  const rows = (recentReports ?? []) as Row[]
  const targetOf = (r: Row) => (Array.isArray(r.scam_targets) ? r.scam_targets[0] : r.scam_targets)
  const thisWeek = rows.filter((r) => r.created_at >= week)
  const byCategory = new Map<string, { count: number; prev: number; kinds: Set<ScamKind> }>()
  for (const r of rows) {
    if (targetOf(r)?.status !== 'confirmed') continue
    const entry = byCategory.get(r.category) ?? { count: 0, prev: 0, kinds: new Set<ScamKind>() }
    if (r.created_at >= week) {
      entry.count += 1
      entry.kinds.add(targetOf(r).kind as ScamKind)
    } else entry.prev += 1
    byCategory.set(r.category, entry)
  }
  return {
    reports7: thisWeek.length,
    hits7: hits7 ?? 0,
    reporters7: new Set(thisWeek.map((r) => r.user_id).filter(Boolean)).size,
    categories: [...byCategory.entries()]
      .filter(([, v]) => v.count > 0)
      .map(([category, v]) => ({ category: category as ScamCategory, count: v.count, prev: v.prev, kinds: [...v.kinds] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    recent: (confirmedTargets ?? []).map((t) => ({
      kind: t.kind as ScamKind,
      value: shownValue(t.kind, t.display, t.value_key),
      category: (t.category as ScamCategory) ?? null,
      reports: Math.max(t.confirmed_reports, 1),
      at: t.last_report_at,
      story: (t.public_story as string | null) ?? null,
    })),
    alertsOn: pref?.alerts === true,
  }
}

export async function setScamAlerts(on: boolean): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false
  const { error } = await db().from('push_preferences').upsert({ user_id: user.id, alerts: !!on }, { onConflict: 'user_id' })
  return !error
}

// ---------- Le mie segnalazioni ----------

export type MyScamReport = {
  id: string
  kind: ScamKind
  value: string
  category: ScamCategory
  status: 'pending' | 'confirmed' | 'dismissed' | 'needs_info'
  staffNote: string | null
  createdAt: string
  warned: number
  hasEvidence: boolean
}

export async function myScamReports(): Promise<{ reports: MyScamReport[]; confirmed: number; warned: number; level: GuardianLevel | null; nextAt: number | null } | null> {
  const user = await currentUser()
  if (!user) return null
  const service = db()
  const { data } = await service
    .from('scam_reports')
    .select('id, category, status, staff_note, created_at, evidence_path, target_id, scam_targets!inner(kind, display, value_key)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  type Row = { id: string; category: string; status: string; staff_note: string | null; created_at: string; evidence_path: string | null; target_id: string; scam_targets: { kind: string; display: string; value_key: string } | { kind: string; display: string; value_key: string }[] }
  const rows = (data ?? []) as Row[]
  const confirmedRows = rows.filter((r) => r.status === 'confirmed')
  const warnedBy = new Map<string, number>()
  if (confirmedRows.length) {
    const oldest = confirmedRows.map((r) => r.created_at).sort()[0]
    const { data: hits } = await service.from('scam_hits').select('target_id, created_at').in('target_id', confirmedRows.map((r) => r.target_id)).gte('created_at', oldest).limit(20000)
    for (const r of confirmedRows) warnedBy.set(r.id, (hits ?? []).filter((h) => h.target_id === r.target_id && h.created_at >= r.created_at).length)
  }
  const reports: MyScamReport[] = rows.map((r) => {
    const t = Array.isArray(r.scam_targets) ? r.scam_targets[0] : r.scam_targets
    return {
      id: r.id,
      kind: t.kind as ScamKind,
      value: t.kind === 'iban' ? maskIban(t.value_key) : t.display,
      category: r.category as ScamCategory,
      status: r.status as MyScamReport['status'],
      staffNote: r.staff_note,
      createdAt: r.created_at,
      warned: warnedBy.get(r.id) ?? 0,
      hasEvidence: !!r.evidence_path,
    }
  })
  const { level, next } = guardianLevel(confirmedRows.length)
  return {
    reports,
    confirmed: confirmedRows.length,
    warned: [...warnedBy.values()].reduce((a, b) => a + b, 0),
    level,
    nextAt: next?.min ?? null,
  }
}

// Prova aggiunta dopo la richiesta dello Staff: la segnalazione torna da controllare
export async function addScamEvidence(reportId: string, path: string, note?: string): Promise<boolean> {
  const user = await currentUser()
  if (!user || !UUID_RE.test(reportId) || !path.startsWith(`${user.id}/`)) return false
  const update: Record<string, unknown> = { evidence_path: path.slice(0, 200), status: 'pending' }
  if (note?.trim()) update.description = note.trim().slice(0, SCAM_DESCRIPTION_MAX)
  const { error } = await db().from('scam_reports').update(update).eq('id', reportId).eq('user_id', user.id).eq('status', 'needs_info')
  return !error
}

// Il titolare (o chi pensa sia un errore) contesta un avviso
export async function contestScam(targetId: string, message: string): Promise<boolean> {
  const user = await currentUser()
  const text = String(message ?? '').trim()
  if (!user || !UUID_RE.test(targetId) || text.length < 10) return false
  const service = db()
  const { count } = await service.from('scam_contests').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(Date.now() - DAY).toISOString())
  if ((count ?? 0) >= 3) return false
  const { error } = await service.from('scam_contests').insert({ target_id: targetId, user_id: user.id, message: text.slice(0, SCAM_CONTEST_MAX) })
  return !error
}

// ---------- Staff ----------

export type AdminScamTarget = {
  id: string
  kind: ScamKind
  value: string
  status: string
  category: string | null
  reportsCount: number
  confirmedReports: number
  hits: number
  lastReportAt: string
  staffNote: string | null
  publicStory: string | null
  phone: PhoneInfo | null
  reports: { id: string; category: string; description: string | null; status: string; createdAt: string; reporter: string; city: string | null; hasEvidence: boolean; staffNote: string | null }[]
  contests: { id: string; message: string; createdAt: string; status: string; who: string }[]
}

export async function adminScamQueue(view: 'pending' | 'confirmed' | 'contests'): Promise<{ rows: AdminScamTarget[]; error: string | null }> {
  if (!(await verifyAdmin('listings.read'))) return { rows: [], error: 'Non autorizzato' }
  const service = db()
  let ids: string[] | null = null
  if (view === 'contests') {
    const { data } = await service.from('scam_contests').select('target_id').eq('status', 'open').limit(200)
    ids = [...new Set((data ?? []).map((c) => c.target_id))]
    if (!ids.length) return { rows: [], error: null }
  }
  let query = service.from('scam_targets').select('*').order('last_report_at', { ascending: false }).limit(100)
  query = ids ? query.in('id', ids) : query.eq('status', view === 'pending' ? 'pending' : 'confirmed')
  const { data: targets, error } = await query
  if (error) return { rows: [], error: error.message }
  const targetIds = (targets ?? []).map((t) => t.id)
  if (!targetIds.length) return { rows: [], error: null }
  const [{ data: reports }, { data: contests }, { data: hits }] = await Promise.all([
    service.from('scam_reports').select('id, target_id, user_id, category, description, status, created_at, evidence_path, staff_note').in('target_id', targetIds).order('created_at', { ascending: false }),
    service.from('scam_contests').select('id, target_id, user_id, message, status, created_at').in('target_id', targetIds).order('created_at', { ascending: false }),
    service.from('scam_hits').select('target_id').in('target_id', targetIds).limit(50000),
  ])
  const people = [...new Set([...(reports ?? []).map((r) => r.user_id), ...(contests ?? []).map((c) => c.user_id)].filter(Boolean))] as string[]
  const { data: profiles } = people.length ? await service.from('profiles').select('id, first_name, last_name, email, city').in('id', people) : { data: [] }
  const who = new Map((profiles ?? []).map((p) => [p.id, { name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || p.id.slice(0, 8), city: p.city as string | null }]))
  const hitCount = new Map<string, number>()
  for (const h of hits ?? []) hitCount.set(h.target_id, (hitCount.get(h.target_id) ?? 0) + 1)
  return {
    error: null,
    rows: (targets ?? []).map((t) => ({
      id: t.id,
      kind: t.kind,
      value: t.kind === 'phone' ? t.display : t.kind === 'iban' ? t.value_key : t.display,
      status: t.status,
      category: t.category,
      reportsCount: t.reports_count,
      confirmedReports: t.confirmed_reports,
      hits: hitCount.get(t.id) ?? 0,
      lastReportAt: t.last_report_at,
      staffNote: t.staff_note,
      publicStory: t.public_story ?? null,
      phone: t.kind === 'phone' ? phoneInfo(t.value_key) : null,
      reports: (reports ?? [])
        .filter((r) => r.target_id === t.id)
        .map((r) => ({
          id: r.id,
          category: r.category,
          description: r.description,
          status: r.status,
          createdAt: r.created_at,
          reporter: r.user_id ? (who.get(r.user_id)?.name ?? '—') : '—',
          city: r.user_id ? (who.get(r.user_id)?.city ?? null) : null,
          hasEvidence: !!r.evidence_path,
          staffNote: r.staff_note,
        })),
      contests: (contests ?? [])
        .filter((c) => c.target_id === t.id)
        .map((c) => ({ id: c.id, message: c.message, createdAt: c.created_at, status: c.status, who: c.user_id ? (who.get(c.user_id)?.name ?? '—') : '—' })),
    })),
  }
}

export async function adminScamEvidence(reportId: string): Promise<string | null> {
  if (!(await verifyAdmin('listings.read')) || !UUID_RE.test(reportId)) return null
  const service = db()
  const { data } = await service.from('scam_reports').select('evidence_path').eq('id', reportId).maybeSingle()
  if (!data?.evidence_path) return null
  const { data: signed } = await service.storage.from('scam-evidence').createSignedUrl(data.evidence_path, 600)
  return signed?.signedUrl ?? null
}

export async function adminScamDecide(targetId: string, decision: 'confirm' | 'dismiss' | 'needs_info' | 'remove', note: string | null, story?: string | null): Promise<{ success: boolean; error?: string }> {
  if (!(await verifyAdmin('listings.write'))) return { success: false, error: 'Non autorizzato' }
  if (!UUID_RE.test(targetId) || !['confirm', 'dismiss', 'needs_info', 'remove'].includes(decision)) return { success: false, error: 'Dati non validi' }
  const service = db()
  const { data: target } = await service.from('scam_targets').select('kind, display, value_key, status').eq('id', targetId).maybeSingle()
  if (!target) return { success: false, error: 'Segnalazione non trovata' }
  // Caso nuovo: mai confermato prima (per la carta rara di chi l'ha scoperto)
  const newCase = decision === 'confirm' && target.status !== 'confirmed'
  const { data, error } = await service.rpc('scam_staff_decide', { p_target: targetId, p_decision: decision, p_note: note?.trim() || null })
  if (error) return { success: false, error: error.message }
  const rows = (data ?? []) as { user_id: string | null; report_id: string; evidence_path: string | null; rewarded_ku: number }[]
  // Le prove si cancellano appena c'è una decisione
  const paths = rows.map((r) => r.evidence_path).filter(Boolean) as string[]
  if (paths.length) await service.storage.from('scam-evidence').remove(paths)
  if (decision === 'remove') {
    await service.from('scam_contests').update({ status: 'accepted' }).eq('target_id', targetId).eq('status', 'open')
    return { success: true }
  }
  await service.rpc('scam_target_refresh', { p_target: targetId })
  // Racconto per la community: lo scrive o lo approva lo Staff alla conferma
  if (decision === 'confirm' && story !== undefined) await service.from('scam_targets').update({ public_story: cleanStory(story) }).eq('id', targetId)
  const value = shownValue(target.kind, target.display, target.value_key)
  // Carte Antitruffa: la carta rara a chi l'ha segnalato per primo
  if (newCase) {
    const { data: first } = await service
      .from('scam_reports')
      .select('user_id, category')
      .eq('target_id', targetId)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    const rare = first?.user_id ? await awardRareCard(first.user_id as string, first.category as ScamCategory) : null
    if (rare?.isNew) {
      await notifyUser(
        first!.user_id as string,
        'staff',
        (t, locale) => ({ title: t('scamRareTitle'), body: t('scamRareBody', { name: rare.name }), url: localizedPath(locale, '/app/carte-antitruffa'), tag: `scam-rare-${targetId}` }),
        { kind: 'scam_rare_card', ref: targetId }
      )
    }
  }
  const kind = decision === 'confirm' ? 'Confirmed' : decision === 'dismiss' ? 'Dismissed' : 'NeedsInfo'
  for (const r of rows) {
    if (!r.user_id) continue
    await notifyUser(
      r.user_id,
      'staff',
      (t, locale) => ({
        title: t(`scam${kind}Title`),
        body: t(`scam${kind}Body`, { value, ku: r.rewarded_ku, note: note?.trim() || '' }),
        url: localizedPath(locale, '/app/rete-antitruffa?tab=mie'),
        tag: `scam-${r.report_id}`,
      }),
      { kind: `scam_${decision}`, ref: r.report_id }
    )
  }
  return { success: true }
}

const cleanStory = (story: string | null) => String(story ?? '').trim().slice(0, SCAM_DESCRIPTION_MAX) || null

// Admin: cambia il racconto visibile a tutti di un avviso già confermato
export async function adminScamSetStory(targetId: string, story: string | null): Promise<boolean> {
  if (!(await verifyAdmin('listings.write')) || !UUID_RE.test(targetId)) return false
  const { error } = await db().from('scam_targets').update({ public_story: cleanStory(story) }).eq('id', targetId).eq('status', 'confirmed')
  return !error
}

export async function adminScamContestReject(contestId: string): Promise<boolean> {
  if (!(await verifyAdmin('listings.write')) || !UUID_RE.test(contestId)) return false
  const { error } = await db().from('scam_contests').update({ status: 'rejected' }).eq('id', contestId)
  return !error
}

// Admin → Rete Anti-Truffa: lo Staff inserisce direttamente un dato (sito,
// telefono, IBAN…) che sa con certezza essere una truffa. Nasce una
// segnalazione dello Staff (senza KU Karma) confermata subito: da quel momento
// chi lo controlla in Speculum vede l'avviso rosso.
export async function adminAddConfirmedScam(input: { kind: string; value: string; category: string; description: string }): Promise<{ success: boolean; error?: string; display?: string }> {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!(SCAM_KINDS as readonly string[]).includes(input.kind)) return { success: false, error: 'Tipo non valido' }
  if (!(SCAM_CATEGORIES as readonly string[]).includes(input.category)) return { success: false, error: 'Categoria non valida' }
  const target = normalize(input.kind as ScamKind, String(input.value ?? ''))
  if (!target) return { success: false, error: 'Valore non valido: controlla di averlo scritto bene' }
  const description = String(input.description ?? '').trim().slice(0, SCAM_DESCRIPTION_MAX)
  if (description.length < 10) return { success: false, error: 'Scrivi una descrizione di almeno 10 caratteri: la vedono gli utenti nell’avviso' }
  const service = db()

  let { data: row } = await service.from('scam_targets').select('id').eq('kind', target.kind).eq('value_key', target.key).maybeSingle()
  if (!row) {
    const { data: created } = await service
      .from('scam_targets')
      .insert({ kind: target.kind, value_key: target.key, display: target.display, category: input.category })
      .select('id')
      .single()
    row = created ?? (await service.from('scam_targets').select('id').eq('kind', target.kind).eq('value_key', target.key).maybeSingle()).data
  }
  if (!row) return { success: false, error: 'Salvataggio non riuscito' }

  // Segnalazione dello Staff: già «premiata», così non dà KU Karma a chi la inserisce
  const { error } = await service
    .from('scam_reports')
    .insert({ target_id: row.id, user_id: admin.id, category: input.category, description, status: 'pending', rewarded: true })
  if (error && error.code !== '23505') return { success: false, error: error.message }
  await service.from('scam_targets').update({ last_report_at: new Date().toISOString() }).eq('id', row.id)
  const decided = await adminScamDecide(row.id, 'confirm', 'Inserita dallo Staff come truffa certa', description)
  return decided.success ? { success: true, display: target.display } : { success: false, error: decided.error }
}

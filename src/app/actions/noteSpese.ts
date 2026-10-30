'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { limitError } from '@/lib/appLimits'
import {
  DATE_RE,
  EXPENSE_BUCKET,
  EXPENSE_CATEGORIES,
  EXPENSE_LIMITS,
  REPORT_STATUSES,
  addDays,
  daysBetween,
  parseCents,
  parseDecimal,
  romeToday,
  type ExpenseItem,
  type ExpenseReport,
  type ExpenseReportSummary,
  type ItemFormData,
  type ReportFormData,
  type ReportStatus,
} from '@/lib/noteSpese'

// Note spese: proprietario e piano li controlla anche il database (RLS,
// can_use_tool, trigger sulla nota della stessa persona); qui la
// validazione dei campi.

type ActionResult<T> = { success: true; data: T } | { success: false; message: string; limitText?: string }

const TOOL = 'note-spese'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const REPORT_COLUMNS = 'id, title, employee_name, recipient, period_from, period_to, status, submitted_on, reimbursed_on, advance_cents, km_rate, notes, created_at'
const ITEM_COLUMNS = 'id, report_id, spent_on, category, description, amount_cents, route_from, route_to, km, round_trip, km_rate, receipt_path'

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const orNull = (value: string) => value || null
const validDay = (value: unknown) => (typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value)) ? value : null)

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!(await hasActiveToolAccess(supabase, user.id, TOOL))) return null
  return { supabase, userId: user.id }
}

type Supabase = NonNullable<Awaited<ReturnType<typeof gate>>>['supabase']

const toReport = (row: Record<string, unknown>): ExpenseReport => ({
  ...(row as unknown as ExpenseReport),
  advance_cents: Number(row.advance_cents) || 0,
  km_rate: row.km_rate === null || row.km_rate === undefined ? null : Number(row.km_rate),
})

const toItem = (row: Record<string, unknown>, url: string | null = null): ExpenseItem => ({
  ...(row as unknown as ExpenseItem),
  amount_cents: Number(row.amount_cents) || 0,
  km: row.km === null || row.km === undefined ? null : Number(row.km),
  km_rate: row.km_rate === null || row.km_rate === undefined ? null : Number(row.km_rate),
  receipt_url: url,
})

// Link firmati che scadono dopo un'ora: lo spazio resta privato
async function signReceipts(supabase: Supabase, paths: string[]): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}
  if (!paths.length) return urls
  const { data } = await supabase.storage.from(EXPENSE_BUCKET).createSignedUrls(paths, 3600)
  for (const s of data ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl
  return urls
}

// Solo foto nella cartella della nota dell'utente: altrimenti si potrebbe
// puntare (e poi cancellare) la foto di un altro
function ownReceiptPath(path: string | null, userId: string, reportId: string): string | null {
  return path && path.startsWith(`${userId}/${reportId}/`) && !path.includes('..') && path.length <= 300 ? path : null
}

function reportFields(form: ReportFormData) {
  const from = validDay(form.periodFrom)
  let to = validDay(form.periodTo)
  if (from && to && to < from) to = from
  const advance = form.advance?.trim() ? parseCents(form.advance) : 0
  return {
    fields: {
      title: clip(form.title, EXPENSE_LIMITS.title),
      employee_name: orNull(clip(form.employeeName, EXPENSE_LIMITS.employeeName)),
      recipient: orNull(clip(form.recipient, EXPENSE_LIMITS.recipient)),
      period_from: from,
      period_to: to,
      advance_cents: advance ?? 0,
      notes: orNull(clip(form.notes, EXPENSE_LIMITS.notes)),
    },
    advanceOk: advance !== null && advance >= 0 && advance <= EXPENSE_LIMITS.maxAdvanceCents,
  }
}

// ——— Note spese ———

export async function listReports(): Promise<ExpenseReportSummary[]> {
  const g = await gate()
  if (!g) return []
  const [{ data: reports, error }, { data: items }] = await Promise.all([
    g.supabase.from('expense_reports').select(REPORT_COLUMNS).eq('user_id', g.userId).order('created_at', { ascending: false }).limit(1000),
    g.supabase.from('expense_items').select('report_id, amount_cents').eq('user_id', g.userId).limit(20000),
  ])
  if (error) {
    console.error('[NoteSpese] listReports failed:', error)
    return []
  }
  const sums = new Map<string, { count: number; cents: number }>()
  for (const it of items ?? []) {
    const s = sums.get(it.report_id) ?? { count: 0, cents: 0 }
    s.count += 1
    s.cents += Number(it.amount_cents) || 0
    sums.set(it.report_id, s)
  }
  return (reports ?? []).map((r) => ({ ...toReport(r), items_count: sums.get(r.id)?.count ?? 0, total_cents: sums.get(r.id)?.cents ?? 0 }))
}

export async function getReport(id: string): Promise<{ report: ExpenseReport; items: ExpenseItem[] } | null> {
  if (!UUID_RE.test(id)) return null
  const g = await gate()
  if (!g) return null
  const [{ data: report }, { data: items }] = await Promise.all([
    g.supabase.from('expense_reports').select(REPORT_COLUMNS).eq('id', id).eq('user_id', g.userId).maybeSingle(),
    g.supabase.from('expense_items').select(ITEM_COLUMNS).eq('report_id', id).eq('user_id', g.userId).order('spent_on').order('created_at').limit(EXPENSE_LIMITS.maxItemsPerReport),
  ])
  if (!report) return null
  const rows = items ?? []
  const urls = await signReceipts(g.supabase, rows.map((r) => r.receipt_path).filter((p): p is string => !!p))
  return { report: toReport(report), items: rows.map((r) => toItem(r, r.receipt_path ? (urls[r.receipt_path] ?? null) : null)) }
}

// Nuova nota spese (id vuoto) o modifica
export async function saveReport(id: string | null, form: ReportFormData): Promise<ActionResult<ExpenseReport>> {
  if (id && !UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { fields, advanceOk } = reportFields(form)
  if (!fields.title) return { success: false, message: 'titleRequired' }
  if (!advanceOk) return { success: false, message: 'amountInvalid' }

  const query = id
    ? g.supabase.from('expense_reports').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', g.userId)
    : g.supabase.from('expense_reports').insert({ ...fields, user_id: g.userId })
  const { data, error } = await query.select(REPORT_COLUMNS).single()
  if (error || !data) {
    console.error('[NoteSpese] saveReport failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: toReport(data) }
}

// Stato: aperta, consegnata (con data), rimborsata (con data)
export async function setReportStatus(id: string, status: ReportStatus, day: string): Promise<ActionResult<ExpenseReport>> {
  if (!UUID_RE.test(id) || !(REPORT_STATUSES as readonly string[]).includes(status)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const date = validDay(day) ?? romeToday()
  const patch =
    status === 'open'
      ? { status, submitted_on: null, reimbursed_on: null }
      : status === 'submitted'
        ? { status, submitted_on: date, reimbursed_on: null }
        : { status, reimbursed_on: date }
  const { data, error } = await g.supabase
    .from('expense_reports')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', g.userId)
    .select(REPORT_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[NoteSpese] setReportStatus failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: toReport(data) }
}

export async function deleteReport(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { data: items } = await g.supabase.from('expense_items').select('receipt_path').eq('report_id', id).eq('user_id', g.userId).not('receipt_path', 'is', null)
  const { error } = await g.supabase.from('expense_reports').delete().eq('id', id).eq('user_id', g.userId)
  if (error) {
    console.error('[NoteSpese] deleteReport failed:', error)
    return { success: false, message: 'saveError' }
  }
  const paths = (items ?? []).map((i) => i.receipt_path).filter((p): p is string => !!p)
  if (paths.length) await g.supabase.storage.from(EXPENSE_BUCKET).remove(paths)
  return { success: true, data: null }
}

// Duplica per una trasferta che si ripete: stesse voci (senza foto, gli
// scontrini sono diversi), date spostate in avanti dalla nuova data di inizio
export async function duplicateReport(id: string, title: string, newStart: string): Promise<ActionResult<ExpenseReport>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const cleanTitle = clip(title, EXPENSE_LIMITS.title)
  if (!cleanTitle) return { success: false, message: 'titleRequired' }
  const start = validDay(newStart) ?? romeToday()

  const [{ data: source }, { data: items }] = await Promise.all([
    g.supabase.from('expense_reports').select(REPORT_COLUMNS).eq('id', id).eq('user_id', g.userId).maybeSingle(),
    g.supabase.from('expense_items').select(ITEM_COLUMNS).eq('report_id', id).eq('user_id', g.userId).order('spent_on').order('created_at').limit(EXPENSE_LIMITS.maxItemsPerReport),
  ])
  if (!source) return { success: false, message: 'saveError' }
  const rows = items ?? []
  const firstDay = source.period_from ?? rows[0]?.spent_on ?? start
  const shift = daysBetween(firstDay, start)
  const move = (day: string | null) => (day ? addDays(day, shift) : null)

  const { data: copy, error } = await g.supabase
    .from('expense_reports')
    .insert({
      user_id: g.userId,
      title: cleanTitle,
      employee_name: source.employee_name,
      recipient: source.recipient,
      period_from: source.period_from ? move(source.period_from) : start,
      period_to: move(source.period_to),
      advance_cents: 0,
      km_rate: source.km_rate,
      notes: source.notes,
    })
    .select(REPORT_COLUMNS)
    .single()
  if (error || !copy) {
    console.error('[NoteSpese] duplicateReport failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  if (rows.length) {
    const { error: itemsError } = await g.supabase.from('expense_items').insert(
      rows.map((r) => ({
        user_id: g.userId,
        report_id: copy.id,
        spent_on: move(r.spent_on),
        category: r.category,
        description: r.description,
        amount_cents: r.amount_cents,
        route_from: r.route_from,
        route_to: r.route_to,
        km: r.km,
        round_trip: r.round_trip,
        km_rate: r.km_rate,
      })),
    )
    if (itemsError) {
      // Niente copie a metà: si toglie la nota appena creata
      console.error('[NoteSpese] duplicateReport items failed:', itemsError)
      await g.supabase.from('expense_reports').delete().eq('id', copy.id).eq('user_id', g.userId)
      const limit = await limitError(itemsError)
      if (limit) return limit
      return { success: false, message: 'saveError' }
    }
  }
  return { success: true, data: toReport(copy) }
}

// ——— Voci ———

type ItemRow = {
  spent_on: string
  category: string
  description: string
  amount_cents: number
  route_from: string | null
  route_to: string | null
  km: number | null
  round_trip: boolean
  km_rate: number | null
}

function itemFields(form: ItemFormData): { row: ItemRow } | { error: string } {
  const spentOn = validDay(form.spentOn)
  if (!spentOn) return { error: 'dateRequired' }
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(form.category)) return { error: 'saveError' }
  const description = clip(form.description, EXPENSE_LIMITS.description)
  if (form.category === 'mileage') {
    const km = parseDecimal(form.km ?? '')
    if (km === null || km <= 0 || km > EXPENSE_LIMITS.maxKm) return { error: 'kmInvalid' }
    const rate = parseDecimal(form.kmRate ?? '')
    if (rate === null || rate <= 0 || rate > EXPENSE_LIMITS.maxRate) return { error: 'rateInvalid' }
    return {
      row: {
        spent_on: spentOn,
        category: 'mileage',
        description,
        // L'importo lo ricalcola il database (km × tariffa)
        amount_cents: 0,
        route_from: orNull(clip(form.routeFrom, EXPENSE_LIMITS.place)),
        route_to: orNull(clip(form.routeTo, EXPENSE_LIMITS.place)),
        km: Math.round(km * 10) / 10,
        round_trip: form.roundTrip === true,
        km_rate: Math.round(rate * 10000) / 10000,
      },
    }
  }
  const cents = parseCents(form.amount ?? '')
  if (cents === null || cents <= 0 || cents > EXPENSE_LIMITS.maxAmountCents) return { error: 'amountInvalid' }
  return {
    row: { spent_on: spentOn, category: form.category, description, amount_cents: cents, route_from: null, route_to: null, km: null, round_trip: false, km_rate: null },
  }
}

// Nuova voce (itemId vuoto) o modifica. receiptPath: foto appena caricata;
// removeReceipt: togliere quella che c'era.
export async function saveItem(
  reportId: string,
  itemId: string | null,
  form: ItemFormData,
  receiptPath: string | null,
  removeReceipt: boolean,
): Promise<ActionResult<{ item: ExpenseItem; kmRate: number | null }>> {
  if (!UUID_RE.test(reportId) || (itemId && !UUID_RE.test(itemId))) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const parsed = itemFields(form)
  if ('error' in parsed) return { success: false, message: parsed.error }
  const newPath = ownReceiptPath(receiptPath, g.userId, reportId)

  const { data: report } = await g.supabase.from('expense_reports').select('id, km_rate').eq('id', reportId).eq('user_id', g.userId).maybeSingle()
  if (!report) return { success: false, message: 'saveError' }

  let oldPath: string | null = null
  if (itemId) {
    const { data: before } = await g.supabase.from('expense_items').select('receipt_path').eq('id', itemId).eq('user_id', g.userId).eq('report_id', reportId).maybeSingle()
    if (!before) return { success: false, message: 'saveError' }
    oldPath = before.receipt_path
  } else {
    const { count } = await g.supabase.from('expense_items').select('id', { count: 'exact', head: true }).eq('report_id', reportId).eq('user_id', g.userId)
    if ((count ?? 0) >= EXPENSE_LIMITS.maxItemsPerReport) return { success: false, message: 'tooManyItems' }
  }

  const payload: ItemRow & { receipt_path?: string | null } = { ...parsed.row }
  if (newPath) payload.receipt_path = newPath
  else if (removeReceipt) payload.receipt_path = null

  const query = itemId
    ? g.supabase.from('expense_items').update(payload).eq('id', itemId).eq('user_id', g.userId)
    : g.supabase.from('expense_items').insert({ ...payload, user_id: g.userId, report_id: reportId })
  const { data, error } = await query.select(ITEM_COLUMNS).single()
  if (error || !data) {
    console.error('[NoteSpese] saveItem failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }

  // Foto sostituita o tolta: quella vecchia non resta nello spazio file
  if (oldPath && oldPath !== data.receipt_path) await g.supabase.storage.from(EXPENSE_BUCKET).remove([oldPath])

  // La tariffa al km scritta diventa quella proposta per le prossime voci
  let kmRate = report.km_rate === null ? null : Number(report.km_rate)
  if (parsed.row.km_rate !== null && parsed.row.km_rate !== kmRate) {
    const { error: rateError } = await g.supabase.from('expense_reports').update({ km_rate: parsed.row.km_rate }).eq('id', reportId).eq('user_id', g.userId)
    if (!rateError) kmRate = parsed.row.km_rate
  }

  if (!itemId) await awardToolPoint(TOOL)
  const urls = await signReceipts(g.supabase, data.receipt_path ? [data.receipt_path] : [])
  return { success: true, data: { item: toItem(data, data.receipt_path ? (urls[data.receipt_path] ?? null) : null), kmRate } }
}

export async function deleteItem(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { data: row } = await g.supabase.from('expense_items').select('receipt_path').eq('id', id).eq('user_id', g.userId).maybeSingle()
  if (!row) return { success: false, message: 'saveError' }
  const { error } = await g.supabase.from('expense_items').delete().eq('id', id).eq('user_id', g.userId)
  if (error) {
    console.error('[NoteSpese] deleteItem failed:', error)
    return { success: false, message: 'saveError' }
  }
  if (row.receipt_path) await g.supabase.storage.from(EXPENSE_BUCKET).remove([row.receipt_path])
  return { success: true, data: null }
}

// Link firmati nuovi (per il PDF, se la pagina è aperta da più di un'ora)
export async function refreshReceiptUrls(reportId: string): Promise<Record<string, string>> {
  if (!UUID_RE.test(reportId)) return {}
  const g = await gate()
  if (!g) return {}
  const { data } = await g.supabase.from('expense_items').select('id, receipt_path').eq('report_id', reportId).eq('user_id', g.userId).not('receipt_path', 'is', null)
  const rows = data ?? []
  const urls = await signReceipts(g.supabase, rows.map((r) => r.receipt_path as string))
  return Object.fromEntries(rows.map((r) => [r.id, urls[r.receipt_path as string]]).filter(([, u]) => u))
}

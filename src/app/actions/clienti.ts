'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { limitError } from '@/lib/appLimits'
import {
  CLIENT_LIMITS,
  JOB_STAGES,
  PAYMENT_METHODS,
  parseEuro,
  quoteGross,
  quoteNet,
  COST_KINDS,
  JOB_FILE_MAX_BYTES,
  JOB_FILE_TYPES,
  type ChecklistItem,
  type CostKind,
  type JobCost,
  type JobFile,
  type JobProduct,
  type TimeEntry,
  type TodayData,
  type ClientFormData,
  type ClientJob,
  type ClientPayment,
  type JobFormData,
  type JobStage,
  type PaymentFormData,
  type ClientOverview,
  type ClientQuote,
  type ClientRecord,
} from '@/lib/clienti'

// Clienti e Lavori (PRO): proprietario e piano li controlla anche il database
// (RLS di quote_clients e my_clients_overview); qui validazione dei campi.

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const orNull = (value: string) => value || null

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!(await hasActiveToolAccess(supabase, user.id, 'clienti'))) return null
  return { supabase, userId: user.id }
}

function clientFields(form: ClientFormData) {
  return {
    name: clip(form.name, CLIENT_LIMITS.name),
    contact_name: orNull(clip(form.contactName, CLIENT_LIMITS.contactName)),
    vat: orNull(clip(form.vat, CLIENT_LIMITS.vat)),
    address: orNull(clip(form.address, CLIENT_LIMITS.address)),
    city: orNull(clip(form.city, CLIENT_LIMITS.city)),
    postal_code: orNull(clip(form.postalCode, CLIENT_LIMITS.postalCode)),
    pec: orNull(clip(form.pec, CLIENT_LIMITS.pec)),
    email: orNull(clip(form.email, CLIENT_LIMITS.email)),
    phone: orNull(clip(form.phone, CLIENT_LIMITS.phone)),
  }
}

export async function listClients(): Promise<ClientOverview[]> {
  const g = await gate()
  if (!g) return []
  const { data, error } = await g.supabase.rpc('my_clients_overview')
  if (error) {
    console.error('[Clienti] listClients failed:', error)
    return []
  }
  return ((data ?? []) as ClientOverview[]).map((c) => ({
    ...c,
    quotes_count: Number(c.quotes_count) || 0,
    open_jobs: Number(c.open_jobs) || 0,
    accepted_total: Number(c.accepted_total) || 0,
    paid_total: Number(c.paid_total) || 0,
    owed: Number(c.owed) || 0,
  }))
}

type Supabase = NonNullable<Awaited<ReturnType<typeof gate>>>['supabase']

const JOB_COLUMNS = 'id, client_id, quote_id, title, stage, amount, address, start_date, due_date, notes, checklist, hourly_cost'
const PAYMENT_COLUMNS = 'id, job_id, amount, paid_on, method, note'

function toJob(row: Record<string, unknown>): ClientJob {
  return {
    ...(row as unknown as ClientJob),
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    hourly_cost: row.hourly_cost === null || row.hourly_cost === undefined ? null : Number(row.hourly_cost),
    checklist: Array.isArray(row.checklist) ? (row.checklist as ChecklistItem[]) : [],
  }
}
const toPayment = (row: Record<string, unknown>): ClientPayment => ({ ...(row as unknown as ClientPayment), amount: Number(row.amount) || 0 })

async function loadQuotes(supabase: Supabase, userId: string, clientId: string): Promise<ClientQuote[]> {
  const { data: rows } = await supabase
    .from('quotes')
    .select('id, quote_number, subject, issue_date, total, vat_mode, vat_rate, accepted_at, payment_status, paid_amount, paid_at')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .order('issue_date', { ascending: false })
    .order('quote_number', { ascending: false })
    .limit(200)
  return (rows ?? []).map((q) => ({
    id: q.id,
    quote_number: q.quote_number,
    subject: q.subject,
    issue_date: q.issue_date,
    gross: quoteGross(Number(q.total) || 0, q.vat_mode, q.vat_rate === null ? null : Number(q.vat_rate)),
    net: quoteNet(Number(q.total) || 0, q.vat_mode, q.vat_rate === null ? null : Number(q.vat_rate)),
    accepted: (!!q.accepted_at || q.payment_status === 'paid') && q.payment_status !== 'refunded',
    payment_status: q.payment_status ?? 'unpaid',
    paid_amount: q.payment_status === 'paid' ? Number(q.paid_amount) || 0 : 0,
    paid_at: q.payment_status === 'paid' ? q.paid_at : null,
  }))
}

export async function getClientCard(
  id: string
): Promise<{ client: ClientRecord; quotes: ClientQuote[]; jobs: ClientJob[]; payments: ClientPayment[] } | null> {
  if (!UUID_RE.test(id)) return null
  const g = await gate()
  if (!g) return null
  const { data: client } = await g.supabase
    .from('quote_clients')
    .select('id, name, contact_name, vat, address, city, postal_code, pec, email, phone, notes, next_step, next_step_due')
    .eq('id', id)
    .eq('user_id', g.userId)
    .maybeSingle()
  if (!client) return null
  const [quotes, { data: jobs }, { data: payments }] = await Promise.all([
    loadQuotes(g.supabase, g.userId, id),
    g.supabase.from('client_jobs').select(JOB_COLUMNS).eq('user_id', g.userId).eq('client_id', id).order('created_at', { ascending: false }).limit(200),
    g.supabase.from('client_payments').select(PAYMENT_COLUMNS).eq('user_id', g.userId).eq('client_id', id).order('paid_on', { ascending: false }).order('created_at', { ascending: false }).limit(500),
  ])
  return { client: client as ClientRecord, quotes, jobs: (jobs ?? []).map(toJob), payments: (payments ?? []).map(toPayment) }
}

export async function createClientRecord(form: ClientFormData): Promise<ActionResult<{ id: string }>> {
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const fields = clientFields(form)
  if (!fields.name) return { success: false, message: 'nameRequired' }
  // Stesso nome di un cliente già salvato: si apre quello (i Preventivi li riconoscono per nome)
  const { data: existing } = await g.supabase
    .from('quote_clients')
    .select('id')
    .eq('user_id', g.userId)
    .ilike('name', fields.name.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1)
    .maybeSingle()
  if (existing) return { success: false, message: 'duplicateName' }
  const { data, error } = await g.supabase
    .from('quote_clients')
    .insert({ user_id: g.userId, ...fields })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[Clienti] create failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('clienti')
  return { success: true, data: { id: data.id } }
}

export async function updateClientRecord(id: string, form: ClientFormData): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const fields = clientFields(form)
  if (!fields.name) return { success: false, message: 'nameRequired' }
  const { data: other } = await g.supabase
    .from('quote_clients')
    .select('id')
    .eq('user_id', g.userId)
    .ilike('name', fields.name.replace(/[\\%_]/g, (c) => `\\${c}`))
    .neq('id', id)
    .limit(1)
    .maybeSingle()
  if (other) return { success: false, message: 'duplicateName' }
  const { error } = await g.supabase
    .from('quote_clients')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', g.userId)
  if (error) {
    console.error('[Clienti] update failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

export async function saveClientNotes(id: string, notes: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { error } = await g.supabase
    .from('quote_clients')
    .update({ notes: orNull(clip(notes, CLIENT_LIMITS.notes)), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', g.userId)
  if (error) {
    console.error('[Clienti] notes failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

// Prossimo passo: testo e data; testo vuoto = passo fatto (si toglie)
export async function setNextStep(id: string, step: string, due: string | null): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const text = clip(step, CLIENT_LIMITS.nextStep)
  const date = text && due && DATE_RE.test(due) ? due : null
  const { error } = await g.supabase
    .from('quote_clients')
    .update({ next_step: orNull(text), next_step_due: date, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', g.userId)
  if (error) {
    console.error('[Clienti] next step failed:', error)
    return { success: false, message: 'saveError' }
  }
  if (text) await awardToolPoint('clienti')
  return { success: true, data: null }
}

// Elimina il cliente: i preventivi restano (perdono solo il collegamento)
export async function deleteClientRecord(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { data: jobRows } = await g.supabase.from('client_jobs').select('id').eq('client_id', id).eq('user_id', g.userId)
  const jobIds = (jobRows ?? []).map((j) => j.id)
  const { data: fileRows } = jobIds.length ? await g.supabase.from('job_files').select('path').in('job_id', jobIds).eq('user_id', g.userId) : { data: [] }
  const { error } = await g.supabase.from('quote_clients').delete().eq('id', id).eq('user_id', g.userId)
  if (!error && fileRows?.length) await g.supabase.storage.from(JOB_BUCKET).remove(fileRows.map((f) => f.path))
  if (error) {
    console.error('[Clienti] delete failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

// ——— Lavori (fase 2) ———

const dateOrNull = (value: string) => (DATE_RE.test(value) ? value : null)
function amountOrNull(value: string): number | null | 'invalid' {
  if (!value.trim()) return null
  const n = parseEuro(value)
  return n === null || n < 0 || n > CLIENT_LIMITS.maxAmount ? 'invalid' : n
}

function jobFields(form: JobFormData) {
  return {
    amount: amountOrNull(form.amount),
    fields: {
      title: clip(form.title, CLIENT_LIMITS.jobTitle),
      quote_id: UUID_RE.test(form.quoteId) ? form.quoteId : null,
      address: orNull(clip(form.address, CLIENT_LIMITS.address)),
      start_date: dateOrNull(form.startDate),
      due_date: dateOrNull(form.dueDate),
    },
  }
}

export async function createJob(clientId: string, form: JobFormData): Promise<ActionResult<{ id: string }>> {
  if (!UUID_RE.test(clientId)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { amount, fields } = jobFields(form)
  if (!fields.title) return { success: false, message: 'titleRequired' }
  if (amount === 'invalid') return { success: false, message: 'amountInvalid' }
  const { data, error } = await g.supabase
    .from('client_jobs')
    .insert({ user_id: g.userId, client_id: clientId, ...fields, amount, hourly_cost: await lastHourlyCost() })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[Clienti] createJob failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('clienti')
  return { success: true, data: { id: data.id } }
}

export async function getJob(jobId: string): Promise<{
  job: ClientJob
  client: { id: string; name: string; phone: string | null }
  payments: ClientPayment[]
  quote: ClientQuote | null
  quotes: ClientQuote[]
  entries: TimeEntry[]
  costs: JobCost[]
  files: JobFile[]
  products: JobProduct[] | null
} | null> {
  if (!UUID_RE.test(jobId)) return null
  const g = await gate()
  if (!g) return null
  const { data: row } = await g.supabase.from('client_jobs').select(JOB_COLUMNS).eq('id', jobId).eq('user_id', g.userId).maybeSingle()
  if (!row) return null
  const job = toJob(row)
  const [{ data: client }, { data: payments }, quotes, { data: entries }, { data: costs }, files, products] = await Promise.all([
    g.supabase.from('quote_clients').select('id, name, phone').eq('id', job.client_id).eq('user_id', g.userId).maybeSingle(),
    g.supabase.from('client_payments').select(PAYMENT_COLUMNS).eq('user_id', g.userId).eq('job_id', jobId).order('paid_on', { ascending: false }).limit(500),
    loadQuotes(g.supabase, g.userId, job.client_id),
    g.supabase.from('job_time_entries').select(ENTRY_COLUMNS).eq('user_id', g.userId).eq('job_id', jobId).order('started_at', { ascending: false }).limit(1000),
    g.supabase.from('job_costs').select(COST_COLUMNS).eq('user_id', g.userId).eq('job_id', jobId).order('created_at').limit(1000),
    loadJobFiles(g.supabase, g.userId, jobId),
    loadProducts(g.supabase, g.userId),
  ])
  if (!client) return null
  return {
    job,
    client,
    payments: (payments ?? []).map(toPayment),
    quote: quotes.find((q) => q.id === job.quote_id) ?? null,
    quotes,
    entries: (entries ?? []) as TimeEntry[],
    costs: (costs ?? []).map(toCost),
    files,
    products,
  }
}

export async function updateJob(jobId: string, form: JobFormData, notes: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(jobId)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { amount, fields } = jobFields(form)
  if (!fields.title) return { success: false, message: 'titleRequired' }
  if (amount === 'invalid') return { success: false, message: 'amountInvalid' }
  const { error } = await g.supabase
    .from('client_jobs')
    .update({ ...fields, amount, notes: orNull(clip(notes, CLIENT_LIMITS.notes)), updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('user_id', g.userId)
  if (error) {
    console.error('[Clienti] updateJob failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

export async function setJobStage(jobId: string, stage: JobStage): Promise<ActionResult<null>> {
  if (!UUID_RE.test(jobId) || !JOB_STAGES.includes(stage)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { error } = await g.supabase.from('client_jobs').update({ stage, updated_at: new Date().toISOString() }).eq('id', jobId).eq('user_id', g.userId)
  if (error) {
    console.error('[Clienti] setJobStage failed:', error)
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('clienti')
  return { success: true, data: null }
}

export async function saveChecklist(jobId: string, items: ChecklistItem[]): Promise<ActionResult<null>> {
  if (!UUID_RE.test(jobId)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const checklist = (Array.isArray(items) ? items : [])
    .map((i) => ({ text: clip(i?.text, CLIENT_LIMITS.checklistItem), done: i?.done === true }))
    .filter((i) => i.text)
    .slice(0, CLIENT_LIMITS.checklistItems)
  const { error } = await g.supabase.from('client_jobs').update({ checklist, updated_at: new Date().toISOString() }).eq('id', jobId).eq('user_id', g.userId)
  if (error) {
    console.error('[Clienti] saveChecklist failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

// Elimina il lavoro: i suoi pagamenti restano al cliente (senza lavoro)
export async function deleteJob(jobId: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(jobId)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { data: files } = await g.supabase.from('job_files').select('path').eq('job_id', jobId).eq('user_id', g.userId)
  const { error } = await g.supabase.from('client_jobs').delete().eq('id', jobId).eq('user_id', g.userId)
  if (!error && files?.length) await g.supabase.storage.from(JOB_BUCKET).remove(files.map((f) => f.path))
  if (error) {
    console.error('[Clienti] deleteJob failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

// ——— Pagamenti registrati a mano (contanti, bonifico, POS…) ———

export async function addPayment(clientId: string, form: PaymentFormData): Promise<ActionResult<ClientPayment>> {
  if (!UUID_RE.test(clientId)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const amount = parseEuro(form.amount)
  if (amount === null || amount <= 0 || amount > CLIENT_LIMITS.maxAmount) return { success: false, message: 'amountInvalid' }
  const { data, error } = await g.supabase
    .from('client_payments')
    .insert({
      user_id: g.userId,
      client_id: clientId,
      job_id: UUID_RE.test(form.jobId) ? form.jobId : null,
      amount,
      paid_on: dateOrNull(form.paidOn) ?? new Date().toISOString().slice(0, 10),
      method: PAYMENT_METHODS.includes(form.method) ? form.method : 'other',
      note: orNull(clip(form.note, CLIENT_LIMITS.paymentNote)),
    })
    .select(PAYMENT_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[Clienti] addPayment failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('clienti')
  return { success: true, data: toPayment(data) }
}

export async function deletePayment(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { error } = await g.supabase.from('client_payments').delete().eq('id', id).eq('user_id', g.userId)
  if (error) {
    console.error('[Clienti] deletePayment failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

// ——— Tempo, costi, foto e documenti del lavoro (fase 3) ———

const JOB_BUCKET = 'job-files'
const ENTRY_COLUMNS = 'id, started_at, ended_at, note'
const COST_COLUMNS = 'id, kind, description, quantity, unit_cost, product_id, stock_unloaded'
const MAX_SESSION_MS = 7 * 86_400_000

const toCost = (row: Record<string, unknown>): JobCost => ({
  ...(row as unknown as JobCost),
  quantity: Number(row.quantity) || 0,
  unit_cost: Number(row.unit_cost) || 0,
})

async function loadJobFiles(supabase: Supabase, userId: string, jobId: string): Promise<JobFile[]> {
  const { data } = await supabase.from('job_files').select('id, path, name, mime, size, created_at').eq('user_id', userId).eq('job_id', jobId).order('created_at').limit(500)
  const rows = data ?? []
  const urls: Record<string, string> = {}
  if (rows.length) {
    // Link firmati che scadono dopo un'ora: lo spazio resta privato
    const { data: signed } = await supabase.storage.from(JOB_BUCKET).createSignedUrls(rows.map((r) => r.path), 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl
  }
  return rows.map((r) => ({ id: r.id, name: r.name, mime: r.mime, size: r.size, created_at: r.created_at, url: urls[r.path] ?? null }))
}

// Prodotti del Magazzino da usare come materiali: null senza il Magazzino
async function loadProducts(supabase: Supabase, userId: string): Promise<JobProduct[] | null> {
  if (!(await hasActiveToolAccess(supabase, userId, 'magazzino'))) return null
  const { data } = await supabase
    .from('inventory_products')
    .select('id, name, unit, purchase_price, stock')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('name')
    .limit(1000)
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, unit: p.unit, purchase_price: Number(p.purchase_price) || 0, stock: Number(p.stock) || 0 }))
}

// Ferma il cronometro acceso (al massimo 7 giorni dopo l'avvio)
async function stopRunning(supabase: Supabase, userId: string): Promise<TimeEntry | null> {
  const { data: running } = await supabase.from('job_time_entries').select(ENTRY_COLUMNS).eq('user_id', userId).is('ended_at', null).maybeSingle()
  if (!running) return null
  const started = new Date(running.started_at).getTime()
  const end = new Date(Math.max(started + 1000, Math.min(Date.now(), started + MAX_SESSION_MS))).toISOString()
  const { data } = await supabase.from('job_time_entries').update({ ended_at: end }).eq('id', running.id).eq('user_id', userId).select(ENTRY_COLUMNS).single()
  return (data as TimeEntry) ?? null
}

export async function startTimer(jobId: string): Promise<ActionResult<{ entry: TimeEntry; stopped: TimeEntry | null }>> {
  if (!UUID_RE.test(jobId)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const stopped = await stopRunning(g.supabase, g.userId)
  const { data, error } = await g.supabase
    .from('job_time_entries')
    .insert({ user_id: g.userId, job_id: jobId, started_at: new Date().toISOString() })
    .select(ENTRY_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[Clienti] startTimer failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('clienti')
  return { success: true, data: { entry: data as TimeEntry, stopped } }
}

export async function stopTimer(): Promise<ActionResult<TimeEntry | null>> {
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  return { success: true, data: await stopRunning(g.supabase, g.userId) }
}

// Cronometro acceso (per la fascia nell'elenco dei clienti)
export async function getRunningTimer(): Promise<{ jobId: string; jobTitle: string; clientName: string; startedAt: string } | null> {
  const g = await gate()
  if (!g) return null
  const { data } = await g.supabase.from('job_time_entries').select('job_id, started_at').eq('user_id', g.userId).is('ended_at', null).maybeSingle()
  if (!data) return null
  const { data: job } = await g.supabase.from('client_jobs').select('title, client_id').eq('id', data.job_id).eq('user_id', g.userId).maybeSingle()
  if (!job) return null
  const { data: client } = await g.supabase.from('quote_clients').select('name').eq('id', job.client_id).eq('user_id', g.userId).maybeSingle()
  return { jobId: data.job_id, jobTitle: job.title, clientName: client?.name ?? '', startedAt: data.started_at }
}

// Ore aggiunte a mano: giorno, ore (anche «1,5») e nota
export async function addTimeEntry(jobId: string, day: string, hours: string, note: string): Promise<ActionResult<TimeEntry>> {
  if (!UUID_RE.test(jobId) || !DATE_RE.test(day)) return { success: false, message: 'saveError' }
  const value = parseEuro(hours)
  if (value === null || value <= 0 || value > CLIENT_LIMITS.maxHoursEntry) return { success: false, message: 'hoursInvalid' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const start = new Date(`${day}T08:00:00Z`)
  const end = new Date(start.getTime() + Math.round(value * 60) * 60_000)
  const { data, error } = await g.supabase
    .from('job_time_entries')
    .insert({ user_id: g.userId, job_id: jobId, started_at: start.toISOString(), ended_at: end.toISOString(), note: orNull(clip(note, CLIENT_LIMITS.timeNote)) })
    .select(ENTRY_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[Clienti] addTimeEntry failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('clienti')
  return { success: true, data: data as TimeEntry }
}

export async function deleteTimeEntry(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { error } = await g.supabase.from('job_time_entries').delete().eq('id', id).eq('user_id', g.userId)
  if (error) return { success: false, message: 'saveError' }
  return { success: true, data: null }
}

export async function setHourlyCost(jobId: string, value: string): Promise<ActionResult<number | null>> {
  if (!UUID_RE.test(jobId)) return { success: false, message: 'saveError' }
  const cost = value.trim() ? parseEuro(value) : null
  if (cost !== null && (cost < 0 || cost > CLIENT_LIMITS.maxHourlyCost)) return { success: false, message: 'amountInvalid' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { error } = await g.supabase.from('client_jobs').update({ hourly_cost: cost, updated_at: new Date().toISOString() }).eq('id', jobId).eq('user_id', g.userId)
  if (error) return { success: false, message: 'saveError' }
  return { success: true, data: cost }
}

// Costo orario proposto sui lavori nuovi: l'ultimo usato
export async function lastHourlyCost(): Promise<number | null> {
  const g = await gate()
  if (!g) return null
  const { data } = await g.supabase
    .from('client_jobs')
    .select('hourly_cost')
    .eq('user_id', g.userId)
    .not('hourly_cost', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.hourly_cost === undefined || data?.hourly_cost === null ? null : Number(data.hourly_cost)
}

// Materiale o spesa; un prodotto del Magazzino può anche essere scaricato
export async function addJobCost(
  jobId: string,
  input: { kind: CostKind; description: string; quantity: string; unitCost: string; productId: string; unload: boolean }
): Promise<ActionResult<JobCost> & { stockError?: boolean }> {
  if (!UUID_RE.test(jobId)) return { success: false, message: 'saveError' }
  const kind = COST_KINDS.includes(input.kind) ? input.kind : 'expense'
  const quantity = input.quantity.trim() ? parseEuro(input.quantity) : 1
  const unitCost = parseEuro(input.unitCost)
  if (quantity === null || quantity <= 0 || quantity > 1_000_000) return { success: false, message: 'quantityInvalid' }
  if (unitCost === null || unitCost < 0 || unitCost > CLIENT_LIMITS.maxAmount) return { success: false, message: 'amountInvalid' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }

  let description = clip(input.description, CLIENT_LIMITS.costDescription)
  let productId: string | null = null
  if (kind === 'material' && UUID_RE.test(input.productId)) {
    const products = await loadProducts(g.supabase, g.userId)
    const product = products?.find((p) => p.id === input.productId)
    if (!product) return { success: false, message: 'saveError' }
    productId = product.id
    if (!description) description = product.name.slice(0, CLIENT_LIMITS.costDescription)
  }
  if (!description) return { success: false, message: 'descriptionRequired' }

  // Scarico dal Magazzino prima di registrare il costo: se la giacenza non basta si avvisa
  let unloaded = false
  if (productId && input.unload) {
    const { data: job } = await g.supabase.from('client_jobs').select('title').eq('id', jobId).eq('user_id', g.userId).maybeSingle()
    if (!job) return { success: false, message: 'saveError' }
    const { data: moved, error: moveError } = await g.supabase.rpc('inventory_move', {
      p_product: productId,
      p_type: 'unload',
      p_quantity: quantity,
      p_reason: 'other',
      p_unit_cost: null,
      p_unit_price: null,
      p_notes: clip(`${job.title}`, 300),
    })
    const result = moved as { error?: string } | null
    if (moveError || result?.error) return { success: false, message: result?.error === 'insufficient' ? 'stockInsufficient' : 'stockError', stockError: true }
    unloaded = true
  }

  const { data, error } = await g.supabase
    .from('job_costs')
    .insert({ user_id: g.userId, job_id: jobId, kind, description, quantity, unit_cost: unitCost, product_id: productId, stock_unloaded: unloaded })
    .select(COST_COLUMNS)
    .single()
  if (error || !data) {
    console.error('[Clienti] addJobCost failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('clienti')
  return { success: true, data: toCost(data) }
}

export async function deleteJobCost(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { error } = await g.supabase.from('job_costs').delete().eq('id', id).eq('user_id', g.userId)
  if (error) return { success: false, message: 'saveError' }
  return { success: true, data: null }
}

// Dopo il caricamento dal browser nella propria cartella: si registra il file
export async function registerJobFile(jobId: string, file: { path: string; name: string; mime: string; size: number }): Promise<ActionResult<JobFile>> {
  if (!UUID_RE.test(jobId)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const pathOk = new RegExp(`^${g.userId}/${jobId}/[0-9a-f-]{36}\\.(jpg|png|webp|pdf)$`).test(file.path)
  if (!pathOk || !JOB_FILE_TYPES.includes(file.mime) || !(file.size > 0 && file.size <= JOB_FILE_MAX_BYTES)) return { success: false, message: 'saveError' }
  const name = clip(file.name, 200) || 'file'
  const { data, error } = await g.supabase
    .from('job_files')
    .insert({ user_id: g.userId, job_id: jobId, path: file.path, name, mime: file.mime, size: file.size })
    .select('id, created_at')
    .single()
  if (error || !data) {
    console.error('[Clienti] registerJobFile failed:', error)
    await g.supabase.storage.from(JOB_BUCKET).remove([file.path])
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  const { data: signed } = await g.supabase.storage.from(JOB_BUCKET).createSignedUrl(file.path, 3600)
  await awardToolPoint('clienti')
  return { success: true, data: { id: data.id, name, mime: file.mime, size: file.size, created_at: data.created_at, url: signed?.signedUrl ?? null } }
}

export async function deleteJobFile(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { data: row } = await g.supabase.from('job_files').select('path').eq('id', id).eq('user_id', g.userId).maybeSingle()
  if (!row) return { success: false, message: 'saveError' }
  const { error } = await g.supabase.from('job_files').delete().eq('id', id).eq('user_id', g.userId)
  if (error) return { success: false, message: 'saveError' }
  await g.supabase.storage.from(JOB_BUCKET).remove([row.path])
  return { success: true, data: null }
}

// ——— «Oggi» (fase 4) ———

export async function getToday(): Promise<TodayData | null> {
  const g = await gate()
  if (!g) return null
  const { data, error } = await g.supabase.rpc('my_clients_today')
  if (error || !data) {
    console.error('[Clienti] getToday failed:', error)
    return null
  }
  const d = data as TodayData
  return { ...d, toCollect: d.toCollect.map((x) => ({ ...x, left: Number(x.left) || 0, days: Number(x.days) || 0 })), openJobs: Number(d.openJobs) || 0 }
}

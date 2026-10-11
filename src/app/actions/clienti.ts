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
  type ChecklistItem,
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

const JOB_COLUMNS = 'id, client_id, quote_id, title, stage, amount, address, start_date, due_date, notes, checklist'
const PAYMENT_COLUMNS = 'id, job_id, amount, paid_on, method, note'

function toJob(row: Record<string, unknown>): ClientJob {
  return {
    ...(row as unknown as ClientJob),
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
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
  const { error } = await g.supabase.from('quote_clients').delete().eq('id', id).eq('user_id', g.userId)
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
    .insert({ user_id: g.userId, client_id: clientId, ...fields, amount })
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
} | null> {
  if (!UUID_RE.test(jobId)) return null
  const g = await gate()
  if (!g) return null
  const { data: row } = await g.supabase.from('client_jobs').select(JOB_COLUMNS).eq('id', jobId).eq('user_id', g.userId).maybeSingle()
  if (!row) return null
  const job = toJob(row)
  const [{ data: client }, { data: payments }, quotes] = await Promise.all([
    g.supabase.from('quote_clients').select('id, name, phone').eq('id', job.client_id).eq('user_id', g.userId).maybeSingle(),
    g.supabase.from('client_payments').select(PAYMENT_COLUMNS).eq('user_id', g.userId).eq('job_id', jobId).order('paid_on', { ascending: false }).limit(500),
    loadQuotes(g.supabase, g.userId, job.client_id),
  ])
  if (!client) return null
  return { job, client, payments: (payments ?? []).map(toPayment), quote: quotes.find((q) => q.id === job.quote_id) ?? null, quotes }
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
  const { error } = await g.supabase.from('client_jobs').delete().eq('id', jobId).eq('user_id', g.userId)
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

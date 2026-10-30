'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { limitError } from '@/lib/appLimits'
import { normalizeExternalUrl } from '@/lib/linkUtils'
import {
  APPLICATION_LIMITS,
  CLOSED_STATUSES,
  SALARY_PERIODS,
  isSource,
  isStatus,
  romeLocalToDate,
  romeToday,
  type ApplicationEvent,
  type ApplicationForm,
  type ApplicationStatus,
  type JobApplication,
  type SalaryPeriod,
} from '@/lib/candidature'

// Le mie candidature: proprietario e piano li controlla anche il database
// (RLS di job_applications); qui la pulizia dei campi.

type ActionResult<T> = { success: true; data: T } | { success: false; message: string; limitText?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COLUMNS =
  'id, company, role, city, source, ad_url, contact_name, contact_email, contact_phone, sent_on, status, status_changed_at, interview_at, follow_up_on, notes, salary, salary_period, created_at, updated_at'

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const orNull = (value: string) => value || null
const validDay = (value: unknown) => {
  const day = clip(value, 10)
  return DATE_RE.test(day) && day >= '2000-01-01' && day <= '2100-12-31' && !Number.isNaN(new Date(`${day}T12:00:00Z`).getTime()) ? day : null
}

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!(await hasActiveToolAccess(supabase, user.id, 'candidature'))) return null
  return { supabase, userId: user.id }
}

function toApplication(row: Record<string, unknown>): JobApplication {
  return {
    ...(row as unknown as JobApplication),
    salary: row.salary === null || row.salary === undefined ? null : Number(row.salary),
  }
}

type Fields = Record<string, string | number | null>

function fields(form: ApplicationForm): { ok: true; row: Fields } | { ok: false; message: string } {
  const company = clip(form.company, APPLICATION_LIMITS.company)
  if (!company) return { ok: false, message: 'companyRequired' }

  const email = clip(form.contactEmail, APPLICATION_LIMITS.contactEmail)
  if (email && !EMAIL_RE.test(email)) return { ok: false, message: 'badEmail' }

  const rawUrl = clip(form.adUrl, APPLICATION_LIMITS.adUrl)
  const url = rawUrl ? normalizeExternalUrl(rawUrl) : ''
  if (url && (!/^https?:\/\/[^\s/]+\.[^\s]+/i.test(url) || url.length > APPLICATION_LIMITS.adUrl)) return { ok: false, message: 'badUrl' }

  let interviewAt: string | null = null
  if (form.interviewAt) {
    const at = romeLocalToDate(clip(form.interviewAt, 16))
    if (!at || at.getUTCFullYear() < 2000 || at.getUTCFullYear() > 2099) return { ok: false, message: 'badDate' }
    interviewAt = at.toISOString()
  }

  let salary: number | null = null
  const rawSalary = clip(form.salary, 20)
  if (rawSalary) {
    // «1.400», «1400,50», «1 400 €»: si tengono cifre e separatori
    const cleaned = rawSalary.replace(/[^\d.,]/g, '')
    const normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.')
    salary = Number(normalized)
    if (!Number.isFinite(salary) || salary < 0 || salary > 10_000_000) return { ok: false, message: 'badSalary' }
    salary = Math.round(salary * 100) / 100
  }

  const status: ApplicationStatus = isStatus(form.status) ? form.status : 'sent'
  let sentOn = form.sentOn ? validDay(form.sentOn) : null
  if (form.sentOn && !sentOn) return { ok: false, message: 'badDate' }
  // Segnata come già mandata senza data: oggi
  if (!sentOn && status !== 'to_send') sentOn = romeToday()

  const followUp = form.followUpOn ? validDay(form.followUpOn) : null
  if (form.followUpOn && !followUp) return { ok: false, message: 'badDate' }

  return {
    ok: true,
    row: {
      company,
      role: orNull(clip(form.role, APPLICATION_LIMITS.role)),
      city: orNull(clip(form.city, APPLICATION_LIMITS.city)),
      source: isSource(form.source) ? form.source : null,
      ad_url: orNull(url),
      contact_name: orNull(clip(form.contactName, APPLICATION_LIMITS.contactName)),
      contact_email: orNull(email),
      contact_phone: orNull(clip(form.contactPhone, APPLICATION_LIMITS.contactPhone)),
      sent_on: sentOn,
      status,
      interview_at: interviewAt,
      follow_up_on: followUp,
      notes: orNull(clip(form.notes, APPLICATION_LIMITS.notes)),
      salary,
      salary_period: (SALARY_PERIODS as readonly string[]).includes(form.salaryPeriod) ? (form.salaryPeriod as SalaryPeriod) : 'month',
    },
  }
}

export async function listApplications(): Promise<JobApplication[]> {
  const g = await gate()
  if (!g) return []
  const { data, error } = await g.supabase
    .from('job_applications')
    .select(COLUMNS)
    .eq('user_id', g.userId)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) {
    console.error('[Candidature] list failed:', error)
    return []
  }
  return (data ?? []).map((row) => toApplication(row as Record<string, unknown>))
}

export async function listApplicationEvents(id: string): Promise<ApplicationEvent[]> {
  if (!UUID_RE.test(id)) return []
  const g = await gate()
  if (!g) return []
  const { data } = await g.supabase
    .from('job_application_events')
    .select('id, from_status, to_status, created_at')
    .eq('user_id', g.userId)
    .eq('application_id', id)
    .order('created_at', { ascending: false })
    .limit(100)
  return (data ?? []) as ApplicationEvent[]
}

export async function saveApplication(id: string | null, form: ApplicationForm): Promise<ActionResult<JobApplication>> {
  if (id !== null && !UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const checked = fields(form)
  if (!checked.ok) return { success: false, message: checked.message }

  const query = id
    ? g.supabase.from('job_applications').update(checked.row).eq('id', id).eq('user_id', g.userId)
    : g.supabase.from('job_applications').insert({ user_id: g.userId, ...checked.row })
  const { data, error } = await query.select(COLUMNS).single()

  if (error || !data) {
    console.error('[Candidature] save failed:', error)
    const limit = error ? await limitError(error) : null
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }
  if (!id) await awardToolPoint('candidature')
  return { success: true, data: toApplication(data as Record<string, unknown>) }
}

// Cambio di stato con un tocco (lo storico lo scrive il database)
export async function setApplicationStatus(id: string, status: ApplicationStatus): Promise<ActionResult<JobApplication>> {
  if (!UUID_RE.test(id) || !isStatus(status)) return { success: false, message: 'saveError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }

  const { data: current } = await g.supabase.from('job_applications').select('sent_on, follow_up_on').eq('id', id).eq('user_id', g.userId).maybeSingle()
  if (!current) return { success: false, message: 'saveError' }

  const patch: Fields = { status }
  // Appena mandata: data di invio di oggi
  if (status !== 'to_send' && !current.sent_on) patch.sent_on = romeToday()
  // Candidatura chiusa: il richiamo non serve più
  if (CLOSED_STATUSES.includes(status)) patch.follow_up_on = null

  const { data, error } = await g.supabase.from('job_applications').update(patch).eq('id', id).eq('user_id', g.userId).select(COLUMNS).single()
  if (error || !data) {
    console.error('[Candidature] status failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: toApplication(data as Record<string, unknown>) }
}

// Data in cui richiamare (null = richiamo fatto, si toglie)
export async function setFollowUp(id: string, day: string | null): Promise<ActionResult<JobApplication>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'saveError' }
  const followUp = day === null ? null : validDay(day)
  if (day !== null && !followUp) return { success: false, message: 'badDate' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { data, error } = await g.supabase
    .from('job_applications')
    .update({ follow_up_on: followUp })
    .eq('id', id)
    .eq('user_id', g.userId)
    .select(COLUMNS)
    .single()
  if (error || !data) {
    console.error('[Candidature] follow-up failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: toApplication(data as Record<string, unknown>) }
}

export async function deleteApplication(id: string): Promise<ActionResult<null>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'deleteError' }
  const g = await gate()
  if (!g) return { success: false, message: 'subscriptionRequired' }
  const { error } = await g.supabase.from('job_applications').delete().eq('id', id).eq('user_id', g.userId)
  if (error) {
    console.error('[Candidature] delete failed:', error)
    return { success: false, message: 'deleteError' }
  }
  return { success: true, data: null }
}

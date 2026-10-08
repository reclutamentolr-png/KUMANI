'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { romeToInstant } from '@/lib/agenda'
import { appLimitValue, limitError } from '@/lib/appLimits'
import { cleanContact, emailKey, phoneKey, type ImportedContact } from '@/lib/contactsImport'

// MemoLife = l'agenda: appuntamenti, promemoria, note, rubrica. Ogni azione
// ricontrolla accesso (piano) e proprietà del dato. Le bollette non sono più
// qui: vivono in Spendly e compaiono nel calendario.

type Result = { success: true } | { success: false; message: string }

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'memolife'))) return { ok: false as const, message: 'subscriptionRequired' }
  return { ok: true as const, supabase, userId: user.id }
}

const clean = (value: string | null | undefined, max: number) => (value ?? '').trim().slice(0, max) || null
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

async function save(table: string, id: string | undefined, fields: Record<string, unknown>): Promise<Result> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { error } = id
    ? await g.supabase.from(table).update(fields).eq('id', id).eq('user_id', g.userId)
    : await g.supabase.from(table).insert({ ...fields, user_id: g.userId })
  if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  if (!id) await awardToolPoint('memolife')
  return { success: true }
}

async function remove(table: string, id: string): Promise<Result> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { error } = await g.supabase.from(table).delete().eq('id', id).eq('user_id', g.userId)
  return error ? { success: false, message: 'saveError' } : { success: true }
}

export async function saveAppointment(input: { id?: string; title: string; date: string; time: string; description: string }): Promise<Result> {
  const title = clean(input.title, 200)
  if (!title || !isDate(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) return { success: false, message: 'invalid' }
  return save('appointments', input.id, { title, description: clean(input.description, 2000), date_time: romeToInstant(input.date, input.time) })
}

export async function deleteAppointment(id: string): Promise<Result> {
  return remove('appointments', id)
}

export async function saveTask(input: { id?: string; title: string; dueDate: string; priority: string; description: string }): Promise<Result> {
  const title = clean(input.title, 200)
  if (!title || (input.dueDate && !isDate(input.dueDate))) return { success: false, message: 'invalid' }
  return save('tasks', input.id, {
    title,
    description: clean(input.description, 2000),
    due_date: input.dueDate || null,
    priority: ['low', 'medium', 'high'].includes(input.priority) ? input.priority : 'medium',
  })
}

export async function deleteTask(id: string): Promise<Result> {
  return remove('tasks', id)
}

export async function saveNote(input: { id?: string; title: string; content: string }): Promise<Result> {
  const content = clean(input.content, 10000)
  if (!content) return { success: false, message: 'invalid' }
  return save('notes', input.id, { title: clean(input.title, 200), content })
}

export async function deleteNote(id: string): Promise<Result> {
  return remove('notes', id)
}

export async function saveContact(input: { id?: string; name: string; phone: string; email: string; company: string; notes: string }): Promise<Result> {
  const name = clean(input.name, 120)
  if (!name) return { success: false, message: 'invalid' }
  return save('contacts', input.id, {
    name,
    phone: clean(input.phone, 40),
    email: clean(input.email, 200),
    company: clean(input.company, 120),
    notes: clean(input.notes, 2000),
  })
}

export async function deleteContact(id: string): Promise<Result> {
  return remove('contacts', id)
}

// Importazione della rubrica (file .vcf / .csv o rubrica del telefono). Lo
// stesso contatto (stesso telefono o stessa email) non viene duplicato: si
// completano solo i campi vuoti di quello già salvato. Si aggiungono contatti
// solo fino al limite impostato dall'Admin.
export type ImportContactsResult =
  | { success: true; added: number; updated: number; skipped: number; overLimit: number }
  | { success: false; message: string }

const IMPORT_MAX = 3000

export async function importContacts(items: ImportedContact[]): Promise<ImportContactsResult> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (!Array.isArray(items) || !items.length) return { success: false, message: 'invalid' }
  const incoming = items.slice(0, IMPORT_MAX).map((c) => cleanContact(c ?? {})).filter((c): c is ImportedContact => !!c)

  const { data: existing, error } = await g.supabase.from('contacts').select('id, name, phone, email, company, notes').eq('user_id', g.userId).limit(20000)
  if (error) return { success: false, message: 'saveError' }
  type Row = NonNullable<typeof existing>[number]
  const byPhone = new Map<string, Row>()
  const byEmail = new Map<string, Row>()
  const index = (row: Row) => {
    const p = phoneKey(row.phone)
    const e = emailKey(row.email)
    if (p && !byPhone.has(p)) byPhone.set(p, row)
    if (e && !byEmail.has(e)) byEmail.set(e, row)
  }
  for (const row of existing ?? []) index(row)

  const toInsert: ImportedContact[] = []
  const updates = new Map<string, Partial<Row>>()
  let skipped = 0
  for (const c of incoming) {
    const match = (phoneKey(c.phone) && byPhone.get(phoneKey(c.phone))) || (emailKey(c.email) && byEmail.get(emailKey(c.email))) || null
    if (!match) {
      const row = { id: '', ...c } as Row
      toInsert.push(c)
      index(row)
      continue
    }
    if (!match.id) {
      skipped++
      continue
    }
    const patch: Partial<Row> = {}
    for (const field of ['phone', 'email', 'company', 'notes'] as const) {
      if (!match[field] && c[field]) patch[field] = match[field] = c[field]
    }
    if (Object.keys(patch).length) updates.set(match.id, { ...updates.get(match.id), ...patch })
    else skipped++
  }

  for (const [id, patch] of updates) {
    await g.supabase.from('contacts').update(patch).eq('id', id).eq('user_id', g.userId)
  }

  const max = await appLimitValue('memolife_contacts')
  const room = max === null ? toInsert.length : Math.max(0, max - (existing?.length ?? 0))
  const accepted = toInsert.slice(0, room)
  let added = 0
  for (let i = 0; i < accepted.length; i += 200) {
    const chunk = accepted.slice(i, i + 200).map((c) => ({
      user_id: g.userId,
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      company: c.company || null,
      notes: c.notes || null,
    }))
    const { error: insertError } = await g.supabase.from('contacts').insert(chunk)
    if (insertError) break
    added += chunk.length
  }
  if (added) await awardToolPoint('memolife')
  return { success: true, added, updated: updates.size, skipped, overLimit: toInsert.length - added }
}

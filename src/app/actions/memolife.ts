'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { romeToInstant } from '@/lib/agenda'

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
  if (error) return { success: false, message: 'saveError' }
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

'use server'

import { createClient } from '@/lib/supabase/server'
import { awardToolPoint } from '@/lib/toolPoints'
import {
  TIMEBANK_CATEGORIES,
  TIMEBANK_LANGUAGES,
  type TimebankMessage,
  type TimebankMy,
  type TimebankPost,
  type TimebankStatus,
} from '@/lib/timebank'

// KUMANI Time Bank: le regole (verifica, saldo, limiti, conferme) sono nelle
// funzioni SQL timebank_*; qui validazione e passaggio dei dati.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    // Servizio spento dallo Staff (tool_require_online)
    if (error.message?.includes('suspended')) return 'suspended' as unknown as T
    console.error(`[TimeBank] ${name} failed:`, error.message)
    return null
  }
  return data as T
}

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const pick = <T extends string>(values: unknown, allowed: readonly T[]) =>
  Array.isArray(values) ? [...new Set(values.filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v)))] : []

export async function getTimebankStatus(): Promise<TimebankStatus | null> {
  return rpc<TimebankStatus>('timebank_status')
}

export async function saveTimebankProfile(input: {
  offers: string[]
  seeks: string[]
  bio: string
  city: string
  countryCode: string
  inPerson: boolean
  online: boolean
  languages: string[]
  availability: string
}): Promise<string> {
  const result = await rpc<string>('timebank_save_profile', {
    p: {
      offers: pick(input.offers, TIMEBANK_CATEGORIES),
      seeks: pick(input.seeks, TIMEBANK_CATEGORIES),
      bio: clean(input.bio, 500),
      city: clean(input.city, 80),
      country_code: /^[A-Z]{2}$/i.test(input.countryCode) ? input.countryCode.toUpperCase() : '',
      in_person: !!input.inPerson,
      online: !!input.online,
      languages: pick(input.languages, TIMEBANK_LANGUAGES),
      availability: clean(input.availability, 120),
    },
  })
  return result ?? 'saveError'
}

export async function listTimebankBoard(filters: { kind?: string; category?: string; mode?: string; city?: string; query?: string }): Promise<TimebankPost[]> {
  return (
    (await rpc<TimebankPost[]>('timebank_board', {
      p_kind: ['request', 'offer'].includes(filters.kind ?? '') ? filters.kind : '',
      p_category: (TIMEBANK_CATEGORIES as readonly string[]).includes(filters.category ?? '') ? filters.category : '',
      p_mode: ['in_person', 'online'].includes(filters.mode ?? '') ? filters.mode : '',
      p_city: clean(filters.city, 80),
      p_query: clean(filters.query, 80),
    })) ?? []
  )
}

export async function getTimebankMy(): Promise<TimebankMy> {
  return (await rpc<TimebankMy>('timebank_my')) ?? { exchanges: [], posts: [], ledger: [] }
}

export async function saveTimebankPost(
  postId: string | null,
  input: { kind: string; title: string; description: string; category: string; hours: string; mode: string; city: string; countryCode: string; languages: string[]; whenText: string },
): Promise<{ id?: string; error?: string }> {
  if (postId && !UUID_RE.test(postId)) return { error: 'invalid' }
  const hours = Number(String(input.hours).replace(',', '.'))
  const result = await rpc<{ id?: string; error?: string } | string>('timebank_post_save', {
    p_post: postId,
    p: {
      kind: input.kind,
      title: clean(input.title, 100),
      description: clean(input.description, 1500),
      category: input.category,
      hours: Number.isFinite(hours) ? hours : 0,
      mode: input.mode,
      city: clean(input.city, 80),
      country_code: /^[A-Z]{2}$/i.test(input.countryCode) ? input.countryCode.toUpperCase() : '',
      languages: pick(input.languages, TIMEBANK_LANGUAGES),
      when_text: clean(input.whenText, 120),
    },
  })
  if (result === 'suspended') return { error: 'suspended' }
  if (!result || typeof result === 'string') return { error: 'saveError' }
  if (result.id && !postId) await awardToolPoint('timebank')
  return result
}

export async function closeTimebankPost(postId: string): Promise<string> {
  if (!UUID_RE.test(postId)) return 'invalid'
  return (await rpc<string>('timebank_post_close', { p_post: postId })) ?? 'saveError'
}

export async function proposeTimebankExchange(postId: string, hours: string, note: string, day: string): Promise<{ id?: string; error?: string }> {
  if (!UUID_RE.test(postId)) return { error: 'invalid' }
  const value = Number(String(hours).replace(',', '.'))
  const result = await rpc<{ id?: string; error?: string } | string>('timebank_propose', {
    p_post: postId,
    p_hours: Number.isFinite(value) ? value : 0,
    p_note: clean(note, 500),
    p_day: DATE_RE.test(day) ? day : null,
  })
  if (result === 'suspended') return { error: 'suspended' }
  if (!result || typeof result === 'string') return { error: 'saveError' }
  return result
}

async function exchangeAction(name: string, exchangeId: string, extra: Record<string, unknown> = {}): Promise<string> {
  if (!UUID_RE.test(exchangeId)) return 'invalid'
  return (await rpc<string>(name, { p_exchange: exchangeId, ...extra })) ?? 'saveError'
}

export async function respondTimebankExchange(exchangeId: string, accept: boolean): Promise<string> {
  return exchangeAction('timebank_respond', exchangeId, { p_accept: accept })
}

export async function cancelTimebankExchange(exchangeId: string): Promise<string> {
  return exchangeAction('timebank_cancel', exchangeId)
}

export async function confirmTimebankExchange(exchangeId: string): Promise<string> {
  // A scambio completato il punto KU va a entrambe le parti (timebank_complete)
  return exchangeAction('timebank_confirm', exchangeId)
}

export async function disputeTimebankExchange(exchangeId: string, reason: string): Promise<string> {
  return exchangeAction('timebank_dispute', exchangeId, { p_reason: clean(reason, 1000) })
}

export async function listTimebankMessages(exchangeId: string): Promise<TimebankMessage[]> {
  if (!UUID_RE.test(exchangeId)) return []
  return (await rpc<TimebankMessage[]>('timebank_messages_list', { p_exchange: exchangeId })) ?? []
}

export async function sendTimebankMessage(exchangeId: string, body: string): Promise<string> {
  return exchangeAction('timebank_send', exchangeId, { p_body: clean(body, 1000) })
}

export async function reportTimebank(target: { postId?: string; exchangeId?: string }, reason: string): Promise<string> {
  const postId = target.postId && UUID_RE.test(target.postId) ? target.postId : null
  const exchangeId = target.exchangeId && UUID_RE.test(target.exchangeId) ? target.exchangeId : null
  if (!postId && !exchangeId) return 'invalid'
  return (await rpc<string>('timebank_report', { p_post: postId, p_exchange: exchangeId, p_reason: clean(reason, 1000) })) ?? 'saveError'
}

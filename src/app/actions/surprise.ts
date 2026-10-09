'use server'

import { createClient } from '@/lib/supabase/server'
import { limitError } from '@/lib/appLimits'
import { surpriseDb } from '@/lib/surpriseServer'
import { isSurpriseKind, isSurpriseTheme, SURPRISE_MAX } from '@/lib/surprise'

// KUMANI Sorpresa: azioni di chi crea il regalo. Tutto passa dalle regole
// del database (solo le proprie sorprese; stato, pagamento e link li decide
// solo il server).

type Result = { success: true; id?: string } | { success: false; message: string; limitText?: string }

async function me() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { supabase, userId: user.id } : null
}

const clip = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

export async function createSurprise(locale: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { data, error } = await g.supabase
    .from('surprise_gifts')
    .insert({ user_id: g.userId, locale: /^[a-z]{2}$/.test(locale) ? locale : 'it' })
    .select('id')
    .single()
  if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  return { success: true, id: data.id }
}

export type SurpriseInput = {
  kind: string
  theme: string
  recipientName: string
  senderName: string
  title: string
  message: string
  howToUse: string
  validUntil: string
  startAt: string | null
  coverPath: string | null
}

export async function saveSurprise(id: string, input: SurpriseInput): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const startAt = input.startAt ? new Date(input.startAt) : null
  if (startAt && Number.isNaN(startAt.getTime())) return { success: false, message: 'invalid' }
  const coverPath = input.coverPath && input.coverPath.startsWith(`${g.userId}/`) ? input.coverPath : null
  const { error } = await g.supabase
    .from('surprise_gifts')
    .update({
      ...(isSurpriseKind(input.kind) ? { kind: input.kind } : {}),
      ...(isSurpriseTheme(input.theme) ? { theme: input.theme } : {}),
      recipient_name: clip(input.recipientName, SURPRISE_MAX.recipient),
      sender_name: clip(input.senderName, SURPRISE_MAX.sender),
      title: clip(input.title, SURPRISE_MAX.title),
      message: clip(input.message, SURPRISE_MAX.message),
      how_to_use: clip(input.howToUse, SURPRISE_MAX.howToUse),
      valid_until: input.validUntil && isDate(input.validUntil) ? input.validUntil : null,
      start_at: startAt ? startAt.toISOString() : null,
      cover_path: coverPath,
    })
    .eq('id', id)
    .eq('user_id', g.userId)
  return error ? { success: false, message: 'saveError' } : { success: true }
}

export type StepInput = {
  id?: string
  day: number
  title: string
  message: string
  hint: string
  mediaPath: string | null
  mediaType: string | null
}

export async function saveSurpriseStep(giftId: string, input: StepInput): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const day = Math.min(7, Math.max(1, Math.round(Number(input.day) || 1)))
  const mediaType = ['image', 'video', 'audio'].includes(String(input.mediaType)) ? (input.mediaType as 'image' | 'video' | 'audio') : null
  const mediaPath = input.mediaPath && input.mediaPath.startsWith(`${g.userId}/`) ? input.mediaPath : null
  const fields = {
    day,
    title: clip(input.title, SURPRISE_MAX.stepTitle),
    message: clip(input.message, SURPRISE_MAX.stepMessage),
    hint: clip(input.hint, SURPRISE_MAX.hint),
    media_path: mediaPath,
    media_type: mediaPath ? mediaType : null,
  }
  if (!fields.title && !fields.message && !fields.media_path && !fields.hint) return { success: false, message: 'stepEmpty' }
  if (input.id) {
    const { error } = await g.supabase.from('surprise_steps').update(fields).eq('id', input.id).eq('user_id', g.userId)
    return error ? { success: false, message: 'saveError' } : { success: true, id: input.id }
  }
  const { count } = await g.supabase.from('surprise_steps').select('id', { count: 'exact', head: true }).eq('gift_id', giftId)
  const { data, error } = await g.supabase
    .from('surprise_steps')
    .insert({ ...fields, gift_id: giftId, user_id: g.userId, position: count ?? 0 })
    .select('id')
    .single()
  if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  return { success: true, id: data.id }
}

export async function deleteSurpriseStep(stepId: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { data } = await g.supabase.from('surprise_steps').delete().eq('id', stepId).eq('user_id', g.userId).select('media_path')
  const path = data?.[0]?.media_path as string | null | undefined
  if (path) await g.supabase.storage.from('surprise-media').remove([path])
  return { success: true }
}

// Solo le bozze si cancellano: una sorpresa pagata resta (il link funziona)
export async function deleteSurprise(id: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { data: gift } = await g.supabase.from('surprise_gifts').select('status').eq('id', id).eq('user_id', g.userId).maybeSingle()
  if (!gift) return { success: false, message: 'notFound' }
  if (gift.status !== 'draft') return { success: false, message: 'activeCannotDelete' }
  const db = surpriseDb()
  const { data: files } = await db.storage.from('surprise-media').list(`${g.userId}/${id}`, { limit: 1000 })
  if (files?.length) await db.storage.from('surprise-media').remove(files.map((f) => `${g.userId}/${id}/${f.name}`))
  await g.supabase.from('surprise_gifts').delete().eq('id', id).eq('user_id', g.userId)
  return { success: true }
}

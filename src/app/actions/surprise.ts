'use server'

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { templateByKey } from '@/lib/surpriseTemplates'
import { limitError } from '@/lib/appLimits'
import { surpriseDb } from '@/lib/surpriseServer'
import { GALLERY_MAX, isMusic, isOccasion, isRevealStyle, isStepKind, isSurpriseKind, isSurpriseTheme, SURPRISE_MAX, type StepExtra } from '@/lib/surprise'

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

// Nuova sorpresa vuota oppure da un modello pronto (testi nella lingua di
// chi crea, da cambiare a piacere)
export async function createSurprise(locale: string, templateKey?: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const lang = /^[a-z]{2}$/.test(locale) ? locale : 'it'
  const tpl = templateKey ? templateByKey(templateKey) : null
  const t = tpl ? await getTranslations({ locale: lang, namespace: 'surpriseTpl' }) : null
  const { data, error } = await g.supabase
    .from('surprise_gifts')
    .insert({
      user_id: g.userId,
      locale: lang,
      ...(tpl && t
        ? {
            kind: tpl.kind,
            occasion: tpl.occasion,
            reveal_style: tpl.reveal,
            music: tpl.music,
            theme: tpl.theme,
            title: t(`${tpl.key}_title`),
            message: t(`${tpl.key}_message`),
            how_to_use: t(`${tpl.key}_howTo`),
          }
        : {}),
    })
    .select('id')
    .single()
  if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  if (tpl && t && tpl.steps.length) {
    await g.supabase.from('surprise_steps').insert(
      tpl.steps.map((step, i) => ({
        gift_id: data.id,
        user_id: g.userId,
        day: step.day,
        position: i,
        kind: step.kind,
        title: t(`${tpl.key}_s${i + 1}_title`),
        message: t(`${tpl.key}_s${i + 1}_message`),
        hint: step.hint ? t(`${tpl.key}_s${i + 1}_hint`) : '',
      }))
    )
  }
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
  occasion: string
  revealStyle: string
  music: string | null
  musicPath: string | null
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
      ...(isOccasion(input.occasion) ? { occasion: input.occasion } : {}),
      ...(isRevealStyle(input.revealStyle) ? { reveal_style: input.revealStyle } : {}),
      music: isMusic(input.music) ? input.music : null,
      music_path: input.music === 'own' && input.musicPath && input.musicPath.startsWith(`${g.userId}/`) ? input.musicPath : null,
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
  kind: string
  gallery: string[]
  extra: StepExtra
  riddleAnswer: string
}

// Solo link web veri (http/https): niente javascript: o altro
const cleanUrl = (value: unknown) => {
  const v = clip(value, SURPRISE_MAX.link)
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : ''
  } catch {
    return ''
  }
}

export async function saveSurpriseStep(giftId: string, input: StepInput): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const day = Math.min(7, Math.max(1, Math.round(Number(input.day) || 1)))
  const mediaType = ['image', 'video', 'audio'].includes(String(input.mediaType)) ? (input.mediaType as 'image' | 'video' | 'audio') : null
  const mediaPath = input.mediaPath && input.mediaPath.startsWith(`${g.userId}/`) ? input.mediaPath : null
  const kind = isStepKind(input.kind) ? input.kind : 'message'
  const gallery = kind === 'gallery' ? (Array.isArray(input.gallery) ? input.gallery : []).filter((p) => typeof p === 'string' && p.startsWith(`${g.userId}/`)).slice(0, GALLERY_MAX) : []
  const extra: StepExtra = {
    ...(kind === 'riddle' ? { question: clip(input.extra?.question, SURPRISE_MAX.question) } : {}),
    ...(kind === 'place'
      ? { placeName: clip(input.extra?.placeName, SURPRISE_MAX.place), placeAddress: clip(input.extra?.placeAddress, SURPRISE_MAX.place), mapUrl: cleanUrl(input.extra?.mapUrl) }
      : {}),
    ...(kind === 'song' ? { songTitle: clip(input.extra?.songTitle, SURPRISE_MAX.place), songUrl: cleanUrl(input.extra?.songUrl) } : {}),
  }
  const riddleAnswer = kind === 'riddle' ? clip(input.riddleAnswer, SURPRISE_MAX.answer) : ''
  if (kind === 'riddle' && (!extra.question || !riddleAnswer)) return { success: false, message: 'riddleIncomplete' }
  if (kind === 'song' && !extra.songUrl) return { success: false, message: 'songIncomplete' }
  if (kind === 'place' && !extra.placeName && !extra.placeAddress) return { success: false, message: 'placeIncomplete' }
  const fields = {
    day,
    kind,
    gallery,
    extra,
    riddle_answer: kind === 'riddle' ? riddleAnswer : null,
    title: clip(input.title, SURPRISE_MAX.stepTitle),
    message: clip(input.message, SURPRISE_MAX.stepMessage),
    hint: clip(input.hint, SURPRISE_MAX.hint),
    media_path: kind === 'gallery' ? null : mediaPath,
    media_type: kind === 'gallery' || !mediaPath ? null : mediaType,
  }
  if (kind === 'message' && !fields.title && !fields.message && !fields.media_path && !fields.hint) return { success: false, message: 'stepEmpty' }
  if (kind === 'gallery' && !gallery.length) return { success: false, message: 'galleryEmpty' }
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
  const { data } = await g.supabase.from('surprise_steps').delete().eq('id', stepId).eq('user_id', g.userId).select('media_path, gallery')
  const paths = [data?.[0]?.media_path, ...((data?.[0]?.gallery as string[] | undefined) ?? [])].filter(Boolean) as string[]
  if (paths.length) await g.supabase.storage.from('surprise-media').remove(paths)
  return { success: true }
}

// Si cancellano solo le bozze (con file e tappe): una sorpresa pagata resta,
// perché dietro c'è un pagamento
export async function deleteSurprise(id: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false, message: 'notFound' }
  const { data: gift } = await g.supabase.from('surprise_gifts').select('status').eq('id', id).eq('user_id', g.userId).maybeSingle()
  if (!gift) return { success: false, message: 'notFound' }
  if (gift.status !== 'draft') return { success: false, message: 'activeCannotDelete' }
  const db = surpriseDb()
  const { data: files } = await db.storage.from('surprise-media').list(`${g.userId}/${id}`, { limit: 1000 })
  if (files?.length) await db.storage.from('surprise-media').remove(files.map((f) => `${g.userId}/${id}/${f.name}`))
  const { error } = await g.supabase.from('surprise_gifts').delete().eq('id', id).eq('user_id', g.userId).eq('status', 'draft')
  if (error) return { success: false, message: 'deleteError' }
  return { success: true }
}

// Ringraziamenti letti: di una sorpresa (aprendola) o tutti (dal popup della
// dashboard). Solo per le sorprese di chi lo chiede.
export async function markSurpriseRepliesRead(giftId?: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  let query = g.supabase.from('surprise_gifts').select('id').eq('user_id', g.userId)
  if (giftId) query = query.eq('id', giftId)
  const { data: gifts } = await query
  const ids = (gifts ?? []).map((x) => x.id as string)
  if (!ids.length) return { success: true }
  await surpriseDb().from('surprise_replies').update({ read_at: new Date().toISOString() }).in('gift_id', ids).is('read_at', null)
  return { success: true }
}

// Pagamento con i punti (KU Karma oppure KU Points confermati): punti scalati
// e sorpresa attivata insieme, nel database
export async function paySurpriseWithPoints(giftId: string, currency: 'karma' | 'ku_points'): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  if (currency !== 'karma' && currency !== 'ku_points') return { success: false, message: 'invalid' }
  const { data, error } = await g.supabase
    .rpc('pay_surprise_with_points', { p_gift_id: giftId, p_currency: currency })
    .maybeSingle<{ success: boolean; reason: string | null; points: number }>()
  if (error || !data) return { success: false, message: 'payment' }
  return data.success ? { success: true, id: giftId } : { success: false, message: data.reason ?? 'payment' }
}

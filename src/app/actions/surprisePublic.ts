'use server'

import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { notifyUser } from '@/lib/push'
import { clientIp } from '@/lib/securityCore'
import { normalizeAnswer, isReaction, surpriseDays, unlockAt, SURPRISE_MAX, type SurpriseStepRow, type SurpriseViewStep } from '@/lib/surprise'
import { signedStep, STEP_SELECT, surpriseDb } from '@/lib/surpriseServer'

// Azioni di chi riceve la sorpresa (nessun account, solo il link): risposta
// agli indovinelli e ringraziamento a chi ha regalato. Freni in memoria
// contro i tentativi a raffica.

const attempts = new Map<string, number[]>()
function tooMany(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const list = (attempts.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= max) return true
  list.push(now)
  attempts.set(key, list)
  if (attempts.size > 5000) attempts.clear()
  return false
}

async function giftByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null
  const { data } = await surpriseDb()
    .from('surprise_gifts')
    .select('id, user_id, kind, start_at, recipient_name, status, refunded_at')
    .eq('public_token', token)
    .eq('status', 'active')
    .is('refunded_at', null)
    .maybeSingle()
  return data
}

export async function solveSurpriseRiddle(token: string, stepId: string, answer: string): Promise<{ ok: true; step: SurpriseViewStep } | { ok: false; reason: 'wrong' | 'wait' | 'invalid' }> {
  const ip = clientIp(await headers()) ?? 'x'
  if (tooMany(`riddle:${ip}:${stepId}`, 15, 10 * 60_000)) return { ok: false, reason: 'wait' }
  const gift = await giftByToken(token)
  if (!gift) return { ok: false, reason: 'invalid' }
  const db = surpriseDb()
  const { data: row } = await db.from('surprise_steps').select(STEP_SELECT).eq('id', stepId).eq('gift_id', gift.id).maybeSingle()
  const step = row as SurpriseStepRow | null
  if (!step || step.kind !== 'riddle' || !step.riddle_answer) return { ok: false, reason: 'invalid' }
  const day = Math.min(step.day, surpriseDays(gift.kind))
  const at = unlockAt(gift.start_at ?? new Date().toISOString(), day)
  if (at.getTime() > Date.now()) return { ok: false, reason: 'invalid' }
  // Più risposte giuste possibili, separate da «|» (es. «Roma|Rome»)
  const given = normalizeAnswer(String(answer ?? '').slice(0, SURPRISE_MAX.answer))
  const right = step.riddle_answer.split('|').map(normalizeAnswer).filter(Boolean)
  if (!given || !right.includes(given)) return { ok: false, reason: 'wrong' }
  if (!step.solved_at) await db.from('surprise_steps').update({ solved_at: new Date().toISOString() }).eq('id', step.id)
  return { ok: true, step: await signedStep(step, day, at) }
}

export async function sendSurpriseReply(token: string, form: FormData): Promise<{ ok: boolean; reason?: string }> {
  const ip = clientIp(await headers()) ?? 'x'
  if (tooMany(`reply:${ip}`, 6, 60 * 60_000)) return { ok: false, reason: 'wait' }
  const gift = await giftByToken(token)
  if (!gift) return { ok: false, reason: 'invalid' }
  const reaction = form.get('reaction')
  const message = String(form.get('message') ?? '').trim().slice(0, SURPRISE_MAX.reply)
  const photo = form.get('photo')
  if (!isReaction(reaction) && !message && !(photo instanceof File && photo.size > 0)) return { ok: false, reason: 'empty' }
  const db = surpriseDb()
  let photoPath: string | null = null
  if (photo instanceof File && photo.size > 0) {
    if (!/^image\/(jpeg|png|webp)$/.test(photo.type) || photo.size > 6 * 1024 * 1024) return { ok: false, reason: 'photo' }
    const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg'
    photoPath = `${gift.user_id}/${gift.id}/reply-${randomUUID()}.${ext}`
    const { error } = await db.storage.from('surprise-media').upload(photoPath, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type })
    if (error) return { ok: false, reason: 'photo' }
  }
  const { error } = await db.from('surprise_replies').insert({ gift_id: gift.id, reaction: isReaction(reaction) ? reaction : null, message, photo_path: photoPath })
  if (error) {
    if (photoPath) await db.storage.from('surprise-media').remove([photoPath])
    return { ok: false, reason: /app_limit/.test(error.message) ? 'limit' : 'error' }
  }
  await notifyUser(gift.user_id as string, 'messages', (t, locale) => ({
    title: t('surpriseReplyTitle'),
    body: message ? `${gift.recipient_name || '—'}: ${message.slice(0, 120)}` : t('surpriseReplyBody', { name: gift.recipient_name || '—' }),
    url: `${locale === 'it' ? '' : `/${locale}`}/sorprese/${gift.id}`,
    tag: `surprise-reply-${gift.id}`,
  }))
  return { ok: true }
}

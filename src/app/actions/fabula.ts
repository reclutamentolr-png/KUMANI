'use server'

import { createClient } from '@/lib/supabase/server'
import { awardToolPoint } from '@/lib/toolPoints'
import {
  FABULA_DICE,
  FABULA_LOCALES,
  FABULA_MAX_CHARS,
  FABULA_REPORT_REASONS,
  type FabulaGallery,
  type FabulaStatus,
  type FabulaStory,
  type StoryStatus,
} from '@/lib/fabula'

// Kumani Fabula: le regole (lancio del giorno, una storia al giorno,
// pubblicazione o attesa, applausi, segnalazioni) sono nelle funzioni SQL fabula_*.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    // Servizio spento dallo Staff (tool_require_online)
    if (error.message?.includes('suspended')) return 'suspended' as unknown as T
    console.error(`[Fabula] ${name} failed:`, error.message)
    return null
  }
  return data as T
}

export async function getFabulaStatus(): Promise<FabulaStatus | null> {
  return rpc<FabulaStatus>('fabula_status')
}

export async function saveFabulaStory(input: {
  daily: boolean
  dice: number[]
  title: string
  body: string
  locale: string
  publish: boolean
  challenge: boolean
}): Promise<{ id?: string; status?: StoryStatus; error?: string }> {
  const validDice =
    Array.isArray(input.dice) && input.dice.length === 6 && input.dice.every((face, i) => Number.isInteger(face) && face >= 0 && face < FABULA_DICE[i].faces.length)
  if (!validDice || !(FABULA_LOCALES as readonly string[]).includes(input.locale)) return { error: 'invalid' }
  const result = await rpc<{ id?: string; status?: StoryStatus; error?: string } | 'suspended'>('fabula_save', {
    p_daily: !!input.daily,
    p_dice: input.dice,
    p_title: String(input.title ?? '').trim().slice(0, 80),
    p_body: String(input.body ?? '').trim().slice(0, FABULA_MAX_CHARS),
    p_locale: input.locale,
    p_publish: !!input.publish,
    p_challenge: !!input.challenge,
  })
  if (result === 'suspended') return { error: 'suspended' }
  if (!result) return { error: 'saveError' }
  if (result.id) await awardToolPoint('fabula')
  return result
}

export async function setFabulaPublished(storyId: string, publish: boolean): Promise<string> {
  if (!UUID_RE.test(storyId)) return 'invalid'
  return (await rpc<string>('fabula_set_published', { p_story: storyId, p_publish: !!publish })) ?? 'saveError'
}

export async function deleteFabulaStory(storyId: string): Promise<string> {
  if (!UUID_RE.test(storyId)) return 'invalid'
  return (await rpc<string>('fabula_delete', { p_story: storyId })) ?? 'saveError'
}

export async function getFabulaGallery(date: string | null, locale: string | null): Promise<FabulaGallery | null> {
  const day = date && DATE_RE.test(date) ? date : null
  const lang = locale && (FABULA_LOCALES as readonly string[]).includes(locale) ? locale : null
  return rpc<FabulaGallery>('fabula_gallery', { p_date: day, p_locale: lang })
}

export async function getFabulaMy(): Promise<FabulaStory[]> {
  return (await rpc<FabulaStory[]>('fabula_my')) ?? []
}

export async function applaudFabula(storyId: string): Promise<{ applauded?: boolean; count?: number; error?: string }> {
  if (!UUID_RE.test(storyId)) return { error: 'invalid' }
  return (await rpc<{ applauded?: boolean; count?: number; error?: string }>('fabula_applaud', { p_story: storyId })) ?? { error: 'saveError' }
}

export async function reportFabula(storyId: string, reason: string): Promise<string> {
  if (!UUID_RE.test(storyId) || !(FABULA_REPORT_REASONS as readonly string[]).includes(reason)) return 'invalid'
  return (await rpc<string>('fabula_report', { p_story: storyId, p_reason: reason })) ?? 'saveError'
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { getAnthropicClient, MissingApiKeyError } from '@/lib/anthropic'
import { isGuestRequest } from '@/lib/guestServer'
import { isLandingLocale, LANDING_LOCALE_NAMES } from '@/lib/landing'
import { AI_MODELS } from '@/lib/aiModels'
import { socialAiLeft, takeSocialAiQuota } from '@/lib/socialAi'
import { LUMEN_AI_DURATIONS, LUMEN_AI_GOALS, LUMEN_AI_TONES, LUMEN_BODY_MAX, LUMEN_TITLE_MAX, type LumenAiRequest, type LumenScript } from '@/lib/lumen'

// KUMANI LUMEN: qui solo i copioni (tabella lumen_scripts, visibili a chi li
// ha scritti). Il video si registra e si scarica nel browser e non arriva mai
// sul server.

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }
type Supabase = Awaited<ReturnType<typeof createClient>>

async function gate(): Promise<{ ok: true; supabase: Supabase; userId: string } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'lumen'))) return { ok: false, message: 'subscriptionRequired' }
  return { ok: true, supabase, userId: user.id }
}

const COLUMNS = 'id, title, body, updated_at, ai_settings'

export async function listLumenScripts(): Promise<ActionResult<LumenScript[]>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { data, error } = await g.supabase.from('lumen_scripts').select(COLUMNS).order('updated_at', { ascending: false }).limit(200)
  if (error) return { success: false, message: 'loadError' }
  return { success: true, data: (data ?? []) as LumenScript[] }
}

// Nuovo copione (senza id) o modifica di uno esistente
export async function saveLumenScript(input: { id?: string; title: string; body: string }): Promise<ActionResult<LumenScript>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const row = { title: String(input.title ?? '').trim().slice(0, LUMEN_TITLE_MAX), body: String(input.body ?? '').slice(0, LUMEN_BODY_MAX) }
  const query = input.id
    ? g.supabase.from('lumen_scripts').update(row).eq('id', input.id).select(COLUMNS).single()
    : g.supabase.from('lumen_scripts').insert(row).select(COLUMNS).single()
  const { data, error } = await query
  if (error) return { success: false, message: error.message.includes('lumen_limit') ? 'limitReached' : 'saveError' }
  return { success: true, data: data as LumenScript }
}

export async function deleteLumenScript(id: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { error } = await g.supabase.from('lumen_scripts').delete().eq('id', id)
  if (error) return { success: false, message: 'deleteError' }
  return { success: true, data: null }
}

// Dopo una registrazione o un copione letto fino in fondo: KU Karma del
// giorno (una volta al giorno, controllato dal database)
export async function lumenDone(): Promise<void> {
  await awardToolPoint('lumen')
}

const TONE_TEXT: Record<LumenAiRequest['tone'], string> = {
  friendly: 'friendly and warm, like talking to a neighbour',
  professional: 'professional and reassuring, but simple',
  energetic: 'energetic and enthusiastic',
  calm: 'calm and sincere',
}
const GOAL_TEXT: Record<LumenAiRequest['goal'], string> = {
  present: 'introduce yourself or your business',
  offer: 'present an offer or a product and invite people to take advantage of it',
  tips: 'give 2-3 useful practical tips on the topic',
  story: 'tell a short true-to-life story or experience related to the topic',
}

// Copioni con l'AI che restano oggi (e il limite giornaliero)
export async function lumenAiLeft(): Promise<ActionResult<{ left: number; limit: number }>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  return { success: true, data: await socialAiLeft('lumen', g.userId) }
}

// «Scrivi con l'AI»: un copione parlato per Reel, TikTok e Shorts, da
// leggere con LUMEN. Si salva come nuovo copione; con replaceId («Modifica»)
// riscrive quel copione con le nuove scelte. Ogni volta conta nella quota.
export async function generateLumenScript(input: LumenAiRequest, locale: string, replaceId?: string): Promise<ActionResult<LumenScript>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (await isGuestRequest()) return { success: false, message: 'aiUnavailable' }
  const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const topic = clip(input.topic, 600)
  if (topic.length < 5) return { success: false, message: 'aiMissingTopic' }
  const audience = clip(input.audience, 200)
  const cta = clip(input.cta, 200)
  const seconds = LUMEN_AI_DURATIONS.includes(input.seconds) ? input.seconds : 30
  const tone = LUMEN_AI_TONES.includes(input.tone) ? input.tone : 'friendly'
  const goal = LUMEN_AI_GOALS.includes(input.goal) ? input.goal : 'present'
  const lang = LANDING_LOCALE_NAMES[isLandingLocale(locale) ? locale : 'it']

  // Senza chiave API non si consuma la quota giornaliera
  try {
    getAnthropicClient()
  } catch (err) {
    if (err instanceof MissingApiKeyError) return { success: false, message: 'aiUnavailable' }
    throw err
  }
  if (!(await takeSocialAiQuota('lumen', g.userId))) return { success: false, message: 'aiLimitReached' }

  // Circa 2,2 parole al secondo per chi parla in video con calma
  const words = Math.round(seconds * 2.2)
  const maxWords = Math.round(words * 1.1)
  try {
    const message = await getAnthropicClient().messages.create({
      model: AI_MODELS.lumen.model,
      max_tokens: 2000,
      output_config: { effort: AI_MODELS.lumen.effort },
      tools: [
        {
          name: 'emit_script',
          description: 'Returns the video script.',
          input_schema: {
            type: 'object',
            properties: { title: { type: 'string' }, body: { type: 'string' } },
            required: ['title', 'body'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_script' },
      messages: [
        {
          role: 'user',
          content: `Write a spoken script for a short vertical social video (Instagram Reel, TikTok, YouTube Shorts) in ${lang}. The person will read it aloud from a teleprompter while looking into the camera.

Topic, in the person's own words: ${topic}
Who the video is for: ${audience || '(not given)'}
Goal of the video: ${GOAL_TEXT[goal]}
Tone: ${TONE_TEXT[tone]}
Call to action at the end: ${cta || '(choose a natural one, e.g. follow, comment, send a message)'}
Length: about ${seconds} seconds when read aloud: about ${words} words and NEVER more than ${maxWords} words in total. Count them: if it is too long, cut content, not the hook or the call to action.

Rules:
- The first sentence is a hook: a question or a surprising, concrete statement that makes people stop scrolling. Never start with "Hi, today I want to talk about".
- Spoken language: short sentences, simple everyday words, first person, addressing the viewer directly. It must sound natural said out loud.
- Put each sentence on its own line, with an empty line between the main parts (hook, content, call to action).
- Use ONLY what the person wrote. Never invent facts: no names, prices, numbers, years, awards, addresses or claims that were not given.
- No emojis, no hashtags, no stage directions, no headings, no quotation marks around the text.
- End with the call to action.
- title: max 50 characters, a short name for the script (not the hook).`,
        },
      ],
    })
    const block = message.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return { success: false, message: 'aiError' }
    const raw = block.input as { title?: unknown; body?: unknown }
    const body = clip(raw.body, LUMEN_BODY_MAX)
    if (!body) return { success: false, message: 'aiError' }
    const row = { title: clip(raw.title, LUMEN_TITLE_MAX), body, ai_settings: { topic, audience, cta, seconds, tone, goal } }
    const { data, error } = replaceId
      ? await g.supabase.from('lumen_scripts').update(row).eq('id', replaceId).select(COLUMNS).single()
      : await g.supabase.from('lumen_scripts').insert(row).select(COLUMNS).single()
    if (error) return { success: false, message: error.message.includes('lumen_limit') ? 'limitReached' : 'saveError' }
    return { success: true, data: data as LumenScript }
  } catch (err) {
    console.error('[LUMEN] AI script failed:', err)
    return { success: false, message: 'aiError' }
  }
}

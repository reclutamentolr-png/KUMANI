'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { getAnthropicClient, MissingApiKeyError } from '@/lib/anthropic'
import { isGuestRequest } from '@/lib/guestServer'
import { isLandingLocale, LANDING_LOCALE_NAMES } from '@/lib/landing'
import { ANTHROPIC_MODEL } from '@/lib/offermaker'
import { takeSocialAiQuota } from '@/lib/socialAi'
import { addDays, todayKey } from '@/lib/agenda'
import { DIARIUM_DAYS, DIARIUM_FORMATS, DIARIUM_NETWORKS, DIARIUM_PER_WEEK, DIARIUM_TONES, type DiariumPlan, type DiariumPost, type DiariumRequest } from '@/lib/diarium'

// KUMANI DIARIUM: 30 giorni di idee per i social, scritte con l'AI e salvate
// come post con la loro data (compaiono anche nell'Agenda).

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }
type Supabase = Awaited<ReturnType<typeof createClient>>

async function gate(): Promise<{ ok: true; supabase: Supabase; userId: string } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'diarium'))) return { ok: false, message: 'subscriptionRequired' }
  return { ok: true, supabase, userId: user.id }
}

const POST_COLUMNS = 'id, plan_id, post_date, network, format, title, idea, hook, done'
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function listDiariumPlans(): Promise<ActionResult<DiariumPlan[]>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { data: plans, error } = await g.supabase.from('diarium_plans').select('id, title, start_date, created_at').order('created_at', { ascending: false }).limit(12)
  if (error) return { success: false, message: 'loadError' }
  if (!plans?.length) return { success: true, data: [] }
  const { data: posts } = await g.supabase
    .from('diarium_posts')
    .select(POST_COLUMNS)
    .in(
      'plan_id',
      plans.map((p) => p.id)
    )
    .order('post_date')
  return { success: true, data: plans.map((p) => ({ ...p, posts: ((posts ?? []) as DiariumPost[]).filter((x) => x.plan_id === p.id) })) }
}

export async function setDiariumPostDone(id: string, done: boolean): Promise<boolean> {
  const g = await gate()
  if (!g.ok) return false
  const { error } = await g.supabase.from('diarium_posts').update({ done }).eq('id', id)
  return !error
}

export async function deleteDiariumPlan(id: string): Promise<boolean> {
  const g = await gate()
  if (!g.ok) return false
  const { error } = await g.supabase.from('diarium_plans').delete().eq('id', id)
  return !error
}

const TONE_TEXT: Record<DiariumRequest['tone'], string> = {
  friendly: 'friendly and warm',
  professional: 'professional and reassuring',
  energetic: 'energetic and enthusiastic',
  ironic: 'light and witty',
}

export async function generateDiariumPlan(input: DiariumRequest, locale: string): Promise<ActionResult<DiariumPlan>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (await isGuestRequest()) return { success: false, message: 'aiUnavailable' }
  const business = clean(input.business, 300)
  if (business.length < 3) return { success: false, message: 'missingBusiness' }
  const place = clean(input.place, 80)
  const focus = clean(input.focus, 600)
  const networks = (Array.isArray(input.networks) ? input.networks : []).filter((n) => DIARIUM_NETWORKS.includes(n))
  if (!networks.length) return { success: false, message: 'missingNetwork' }
  const perWeek = DIARIUM_PER_WEEK.includes(input.perWeek) ? input.perWeek : 3
  const tone = DIARIUM_TONES.includes(input.tone) ? input.tone : 'friendly'
  const today = todayKey()
  const start = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate) && input.startDate >= today && input.startDate <= addDays(today, 60) ? input.startDate : today
  const total = Math.round((perWeek * DIARIUM_DAYS) / 7)
  const lang = isLandingLocale(locale) ? locale : 'it'

  try {
    getAnthropicClient()
  } catch (err) {
    if (err instanceof MissingApiKeyError) return { success: false, message: 'aiUnavailable' }
    throw err
  }
  if (!(await takeSocialAiQuota('calendar', g.userId))) return { success: false, message: 'aiLimitReached' }

  // Giorni del periodo con il giorno della settimana (per scegliere bene)
  const days = Array.from({ length: DIARIUM_DAYS }, (_, i) => {
    const key = addDays(start, i)
    const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`))
    return `${i + 1}=${weekday} ${key}`
  }).join(', ')

  try {
    const message = await getAnthropicClient().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      tools: [
        {
          name: 'emit_plan',
          description: 'Returns the social media posting plan.',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              posts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    day: { type: 'integer' },
                    network: { type: 'string', enum: networks },
                    format: { type: 'string', enum: [...DIARIUM_FORMATS] },
                    title: { type: 'string' },
                    idea: { type: 'string' },
                    hook: { type: 'string' },
                  },
                  required: ['day', 'network', 'format', 'title', 'idea', 'hook'],
                },
              },
            },
            required: ['title', 'posts'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_plan' },
      messages: [
        {
          role: 'user',
          content: `Create a ${DIARIUM_DAYS}-day social media posting plan, in ${LANDING_LOCALE_NAMES[lang]}, for a small business or person who is new to social media and has little time.

Business / activity: ${business}
City / area: ${place || '(not given)'}
Products, services or topics to highlight: ${focus || '(not given)'}
Networks: ${networks.join(', ')}
Tone: ${TONE_TEXT[tone]}
Number of posts: exactly ${total} in total (about ${perWeek} per week), spread evenly; never two on the same day.
Days of the period (day number = weekday and date): ${days}

Rules:
- Mix formats sensibly for each network: reels/short videos (they can be recorded with a teleprompter), photo posts, carousels with tips, stories for quick news. LinkedIn: no reels or stories, prefer posts and carousels.
- Mix purposes: about 40% useful tips or behind the scenes, 30% showing products/services, 20% people and stories (customers, team, the area), 10% direct offers or calls to action.
- Use the real calendar: weekends, and well-known holidays or seasonal moments that fall in the period in Italy, only if relevant.
- Simple ideas that can be made with a phone in 15 minutes. Never invent prices, discounts, names, events or claims; if an idea needs real details, write it as something to fill in (e.g. "show your best-selling product").
- title: max 60 characters. idea: 1-2 sentences saying exactly what to show or film. hook: the first line or first spoken sentence, max 120 characters.
- title of the plan: max 60 characters.`,
        },
      ],
    })
    const block = message.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      console.error('[DIARIUM] no tool output:', message.stop_reason)
      return { success: false, message: 'aiError' }
    }
    let raw = block.input as { title?: unknown; posts?: unknown }
    // A volte l'elenco arriva come testo JSON (anche con dentro tutto il piano)
    if (typeof raw.posts === 'string') {
      try {
        const parsed = JSON.parse(raw.posts) as unknown
        raw = Array.isArray(parsed) ? { ...raw, posts: parsed } : { title: raw.title ?? (parsed as typeof raw).title, posts: (parsed as typeof raw).posts }
      } catch {
        // resta vuoto: errore qui sotto
      }
    }
    const used = new Set<number>()
    const rows = (Array.isArray(raw.posts) ? raw.posts : [])
      .map((p) => p as { day?: unknown; network?: unknown; format?: unknown; title?: unknown; idea?: unknown; hook?: unknown })
      .map((p) => ({
        day: Math.round(Number(p.day)),
        network: networks.includes(p.network as never) ? (p.network as DiariumPost['network']) : networks[0],
        format: DIARIUM_FORMATS.includes(p.format as never) ? (p.format as DiariumPost['format']) : 'post',
        title: clean(p.title, 120),
        idea: clean(p.idea, 1000),
        hook: clean(p.hook, 300),
      }))
      .filter((p) => p.title && p.day >= 1 && p.day <= DIARIUM_DAYS && !used.has(p.day) && used.add(p.day))
      .slice(0, 31)
    if (!rows.length) {
      console.error('[DIARIUM] no usable posts:', message.stop_reason, JSON.stringify(raw).slice(0, 500))
      return { success: false, message: 'aiError' }
    }

    const { data: plan, error: planError } = await g.supabase
      .from('diarium_plans')
      .insert({ title: clean(raw.title, 120) || business.slice(0, 60), start_date: start, settings: { business, place, focus, networks, perWeek, tone } })
      .select('id, title, start_date, created_at')
      .single()
    if (planError || !plan) return { success: false, message: planError?.message.includes('diarium_limit') ? 'limitReached' : 'saveError' }
    const { data: posts, error: postsError } = await g.supabase
      .from('diarium_posts')
      .insert(rows.map(({ day, ...p }) => ({ ...p, plan_id: plan.id, post_date: addDays(start, day - 1) })))
      .select(POST_COLUMNS)
    if (postsError) {
      await g.supabase.from('diarium_plans').delete().eq('id', plan.id)
      return { success: false, message: 'saveError' }
    }
    void awardToolPoint('diarium')
    return { success: true, data: { ...plan, posts: ((posts ?? []) as DiariumPost[]).sort((a, b) => a.post_date.localeCompare(b.post_date)) } }
  } catch (err) {
    console.error('[DIARIUM] AI plan failed:', err)
    return { success: false, message: 'aiError' }
  }
}

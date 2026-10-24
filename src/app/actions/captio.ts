'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { getAnthropicClient, MissingApiKeyError } from '@/lib/anthropic'
import { isGuestRequest } from '@/lib/guestServer'
import { isLandingLocale, LANDING_LOCALE_NAMES } from '@/lib/landing'
import { AI_MODELS } from '@/lib/aiModels'
import { takeSocialAiQuota } from '@/lib/socialAi'
import { CAPTIO_GOALS, CAPTIO_HASHTAG_COUNT, CAPTIO_IMAGE_MAX_BYTES, CAPTIO_LENGTHS, CAPTIO_NETWORKS, CAPTIO_TONES, type CaptioRequest, type CaptioResult } from '@/lib/captio'

// KUMANI CAPTIO: tre didascalie e gli hashtag per un post. La foto (se c'è)
// arriva già ridotta dal telefono, si usa solo per scrivere e non si salva.

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }

const NETWORK_TEXT: Record<CaptioRequest['network'], string> = {
  instagram: 'Instagram (feed post): the first line must work as a hook before "more"; line breaks between short paragraphs.',
  facebook: 'Facebook: conversational, slightly longer sentences are fine, few hashtags.',
  tiktok: 'TikTok: very short and punchy caption, informal.',
  linkedin: 'LinkedIn: professional but human, first line is a strong statement, short paragraphs, no slang.',
}
const TONE_TEXT: Record<CaptioRequest['tone'], string> = {
  friendly: 'friendly and warm',
  professional: 'professional and reassuring',
  energetic: 'energetic and enthusiastic',
  ironic: 'light, witty and a bit ironic (never offensive)',
}
const GOAL_TEXT: Record<CaptioRequest['goal'], string> = {
  inform: 'inform or explain something useful',
  sell: 'promote a product, service or offer and push to act',
  engage: 'start a conversation: end with a question that invites comments',
  story: 'tell a short story or behind-the-scenes moment',
}
const LENGTH_TEXT: Record<CaptioRequest['length'], string> = {
  short: '1-2 sentences (max ~30 words)',
  medium: '3-5 sentences (about 40-80 words)',
  long: '6-10 sentences (about 90-150 words), in short paragraphs',
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const tag = (v: unknown) =>
  typeof v === 'string'
    ? '#' + v.replace(/^#+/, '').normalize('NFC').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 40)
    : ''

export async function generateCaptions(input: CaptioRequest, locale: string): Promise<ActionResult<CaptioResult>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'captio'))) return { success: false, message: 'subscriptionRequired' }
  if (await isGuestRequest()) return { success: false, message: 'aiUnavailable' }

  const description = clean(input.description, 1000)
  const image = typeof input.image === 'string' && /^[A-Za-z0-9+/=]+$/.test(input.image) && input.image.length <= (CAPTIO_IMAGE_MAX_BYTES * 4) / 3 + 4 ? input.image : ''
  if (description.length < 5 && !image) return { success: false, message: 'missingDescription' }
  const network = CAPTIO_NETWORKS.includes(input.network) ? input.network : 'instagram'
  const tone = CAPTIO_TONES.includes(input.tone) ? input.tone : 'friendly'
  const goal = CAPTIO_GOALS.includes(input.goal) ? input.goal : 'inform'
  const length = CAPTIO_LENGTHS.includes(input.length) ? input.length : 'medium'
  const business = clean(input.business, 200)
  const place = clean(input.place, 80)
  const cta = clean(input.cta, 200)
  const lang = LANDING_LOCALE_NAMES[isLandingLocale(locale) ? locale : 'it']

  try {
    getAnthropicClient()
  } catch (err) {
    if (err instanceof MissingApiKeyError) return { success: false, message: 'aiUnavailable' }
    throw err
  }
  if (!(await takeSocialAiQuota('captions', user.id))) return { success: false, message: 'aiLimitReached' }

  const list = { type: 'array', items: { type: 'string' } }
  const prompt = `Write social media captions in ${lang} for a small business, freelancer or person who is new to social media.

Network: ${NETWORK_TEXT[network]}
What the post is about, in their own words: ${description || '(not given: rely on the photo)'}
${image ? 'A photo of the post is attached: describe only what is really visible, never guess brands, names or places from it.' : ''}
Business / activity: ${business || '(not given)'}
City / area: ${place || '(not given)'}
Goal: ${GOAL_TEXT[goal]}
Tone: ${TONE_TEXT[tone]}
Length of each caption: ${LENGTH_TEXT[length]}
Call to action: ${cta || '(choose a natural one consistent with the goal)'}
Emojis: ${input.emoji ? 'yes, a few well-placed ones (max 4 per caption)' : 'none at all'}

Rules:
- Write 3 clearly different captions (different hooks and angles), each starting with a strong first line.
- Use ONLY the information given. Never invent prices, discounts, dates, numbers, names, addresses, awards or claims.
- Natural everyday language, no clichés like "Are you ready?" or "Look no further". No hashtags inside the captions.
- Hashtags (${CAPTIO_HASHTAG_COUNT[network]} in total across the three groups), in ${lang} unless an English hashtag is clearly more used for that topic: "broad" = popular general ones, "niche" = specific to the topic/sector, "local" = city/area ones only if a city/area was given (otherwise empty). No spaces, no duplicates, no banned or spammy tags like #followforfollow.`

  try {
    const message = await getAnthropicClient().messages.create({
      model: AI_MODELS.captio.model,
      max_tokens: 2600,
      output_config: { effort: AI_MODELS.captio.effort },
      tools: [
        {
          name: 'emit_captions',
          description: 'Returns the captions and hashtags.',
          input_schema: {
            type: 'object',
            properties: {
              captions: list,
              hashtags: { type: 'object', properties: { broad: list, niche: list, local: list }, required: ['broad', 'niche', 'local'] },
            },
            required: ['captions', 'hashtags'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_captions' },
      messages: [
        {
          role: 'user',
          content: image
            ? [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
                { type: 'text', text: prompt },
              ]
            : prompt,
        },
      ],
    })
    const block = message.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return { success: false, message: 'aiError' }
    const raw = block.input as { captions?: unknown; hashtags?: { broad?: unknown; niche?: unknown; local?: unknown } }
    const captions = (Array.isArray(raw.captions) ? raw.captions : []).map((c) => clean(c, 2200)).filter(Boolean).slice(0, 3)
    if (!captions.length) return { success: false, message: 'aiError' }
    const seen = new Set<string>()
    const tags = (v: unknown, max: number) =>
      (Array.isArray(v) ? v : [])
        .map(tag)
        .filter((h) => h.length > 2 && !seen.has(h.toLowerCase()) && seen.add(h.toLowerCase()))
        .slice(0, max)
    void awardToolPoint('captio')
    return {
      success: true,
      data: { captions, hashtags: { broad: tags(raw.hashtags?.broad, 8), niche: tags(raw.hashtags?.niche, 10), local: place ? tags(raw.hashtags?.local, 5) : [] } },
    }
  } catch (err) {
    console.error('[CAPTIO] AI failed:', err)
    return { success: false, message: 'aiError' }
  }
}

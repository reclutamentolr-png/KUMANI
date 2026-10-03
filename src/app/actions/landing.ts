'use server'

import { createHash, randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient, MissingApiKeyError } from '@/lib/anthropic'
import { ANTHROPIC_MODEL } from '@/lib/offermaker'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import {
  cleanLandingContent,
  isLandingLocale,
  isLandingTemplate,
  LANDING_LOCALE_NAMES,
  REPORT_REASONS,
  slugProblem,
  type LandingContent,
  type LandingLocale,
  type LandingTemplate,
  type ReportReason,
} from '@/lib/landing'

const getServiceClient = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Ogni azione: utente collegato + Landing Page inclusa nel suo piano (Pro).
async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'landing-page'))) return { ok: false as const, message: 'proRequired' }
  return { ok: true as const, supabase, userId: user.id }
}

export type LandingSaveInput = {
  slug: string
  isPublished: boolean
  template: LandingTemplate
  accent: string
  contentLocale: LandingLocale
  content: LandingContent
}

export async function saveLanding(input: LandingSaveInput): Promise<{ success: true; content: LandingContent } | { success: false; message: string }> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }

  const slug = String(input.slug ?? '').trim().toLowerCase()
  const problem = slugProblem(slug)
  if (problem) return { success: false, message: problem }
  const content = cleanLandingContent(input.content, g.userId)
  if (input.isPublished && !content.hero.name) return { success: false, message: 'nameRequired' }
  const accent = /^#[0-9a-f]{6}$/i.test(input.accent) ? input.accent.toLowerCase() : '#c79a3b'

  const row = {
    slug,
    is_published: !!input.isPublished,
    template: isLandingTemplate(input.template) ? input.template : 'scuro',
    accent,
    content_locale: isLandingLocale(input.contentLocale) ? input.contentLocale : 'it',
    content,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await g.supabase.from('landing_pages').select('owner_id').eq('owner_id', g.userId).maybeSingle()
  const { error } = existing
    ? await g.supabase.from('landing_pages').update(row).eq('owner_id', g.userId)
    : await g.supabase.from('landing_pages').insert({ owner_id: g.userId, ...row })
  if (error) {
    if (error.code === '23505') return { success: false, message: 'slugTaken' }
    console.error('[Landing] save failed:', error.message)
    return { success: false, message: 'saveError' }
  }

  // Foto non più usate: si tolgono dal bucket (errori ignorati)
  const used = new Set([content.hero.photo, content.hero.logo, content.about.photo, ...content.gallery.photos].filter(Boolean))
  const service = getServiceClient()
  const { data: files } = await service.storage.from('landing-photos').list(g.userId, { limit: 100 })
  const unused = (files ?? []).map((f) => `${g.userId}/${f.name}`).filter((p) => !used.has(p))
  // Si lascia il tempo di salvare una foto appena caricata (caricata ma non ancora nel contenuto)
  const recent = new Set((files ?? []).filter((f) => f.created_at && Date.now() - new Date(f.created_at).getTime() < 60 * 60 * 1000).map((f) => `${g.userId}/${f.name}`))
  const toRemove = unused.filter((p) => !recent.has(p))
  if (toRemove.length) await service.storage.from('landing-photos').remove(toRemove)

  return { success: true, content }
}

// Indirizzo libero? (controllo mentre si scrive; quello vero è al salvataggio)
export async function checkLandingSlug(slugInput: string): Promise<{ ok: boolean; message?: string }> {
  const g = await gate()
  if (!g.ok) return { ok: false, message: g.message }
  const slug = slugInput.trim().toLowerCase()
  const problem = slugProblem(slug)
  if (problem) return { ok: false, message: problem }
  const { data } = await getServiceClient().from('landing_pages').select('owner_id').eq('slug', slug).maybeSingle()
  if (data && data.owner_id !== g.userId) return { ok: false, message: 'slugTaken' }
  return { ok: true }
}

// Foto: il browser la ridimensiona, qui si ricontrollano tipo e peso.
export async function uploadLandingPhoto(formData: FormData): Promise<{ success: true; path: string } | { success: false; message: string }> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const file = formData.get('file')
  if (!(file instanceof File)) return { success: false, message: 'photoError' }
  const allowed: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = allowed[file.type]
  if (!ext || file.size > 2 * 1024 * 1024) return { success: false, message: 'photoError' }

  const service = getServiceClient()
  const { data: files } = await service.storage.from('landing-photos').list(g.userId, { limit: 100 })
  if ((files?.length ?? 0) >= 40) return { success: false, message: 'tooManyPhotos' }

  const path = `${g.userId}/${randomBytes(10).toString('hex')}.${ext}`
  const { error } = await service.storage.from('landing-photos').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) return { success: false, message: 'photoError' }
  return { success: true, path }
}

// ---------------------------------------------------------------------------
// Testi con l'AI: dalle risposte a poche domande, una bozza di presentazione,
// servizi, chi sono, metodo e descrizione per Google. Niente fatti inventati.
// ---------------------------------------------------------------------------

export type LandingAiAnswers = { business: string; city: string; audience: string; services: string; strengths: string }
export type LandingAiDraft = {
  hero: { title: string; subtitle: string; text: string; ctaLabel: string }
  services: { title: string; items: { title: string; text: string }[] }
  about: { title: string; text: string }
  method: { title: string; items: { title: string; text: string }[] }
  seoDescription: string
}

export async function generateLandingDraft(
  answers: LandingAiAnswers,
  locale: LandingLocale,
  name: string
): Promise<{ success: true; draft: LandingAiDraft } | { success: false; message: string }> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const a = {
    business: clip(answers.business, 300),
    city: clip(answers.city, 80),
    audience: clip(answers.audience, 300),
    services: clip(answers.services, 800),
    strengths: clip(answers.strengths, 500),
  }
  if (!a.business || !a.services) return { success: false, message: 'aiMissingAnswers' }
  const lang = isLandingLocale(locale) ? locale : 'it'

  // Senza chiave API non si consuma la quota giornaliera
  try {
    getAnthropicClient()
  } catch (err) {
    if (err instanceof MissingApiKeyError) return { success: false, message: 'aiUnavailable' }
    throw err
  }
  const service = getServiceClient()
  const { data: limitRow } = await service.from('system_settings').select('value').eq('key', 'landing_ai_daily_runs').maybeSingle()
  const limit = Number(String(limitRow?.value ?? '5').replace(/"/g, '')) || 5
  const { data: taken } = await service.rpc('ai_quota_take', { p_kind: 'landing', p_user: g.userId, p_limit: limit })
  if (taken === null || taken === undefined) return { success: false, message: 'aiLimitReached' }

  const titled = { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['title', 'text'] }
  try {
    const message = await getAnthropicClient().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 3000,
      tools: [
        {
          name: 'emit_landing',
          description: 'Returns the texts of the landing page.',
          input_schema: {
            type: 'object',
            properties: {
              hero: {
                type: 'object',
                properties: { title: { type: 'string' }, subtitle: { type: 'string' }, text: { type: 'string' }, ctaLabel: { type: 'string' } },
                required: ['title', 'subtitle', 'text', 'ctaLabel'],
              },
              services: { type: 'object', properties: { title: { type: 'string' }, items: { type: 'array', items: titled } }, required: ['title', 'items'] },
              about: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['title', 'text'] },
              method: { type: 'object', properties: { title: { type: 'string' }, items: { type: 'array', items: titled } }, required: ['title', 'items'] },
              seoDescription: { type: 'string' },
            },
            required: ['hero', 'services', 'about', 'method', 'seoDescription'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_landing' },
      messages: [
        {
          role: 'user',
          content: `Write the texts of a one-page website (landing page) for a small business or freelance professional, in ${LANDING_LOCALE_NAMES[lang]}.

Owner / business name: ${clip(name, 80) || '(not given)'}
What they do: ${a.business}
City / area: ${a.city || '(not given)'}
Who their customers are: ${a.audience || '(not given)'}
Services they offer: ${a.services}
What makes them different: ${a.strengths || '(not given)'}

Rules:
- Use ONLY the information above. Never invent facts: no years of experience, numbers of clients, certifications, awards, prices, guarantees, reviews or testimonials.
- No superlatives or claims that can't be verified ("the best", "number one", "100% guaranteed").
- Clear, warm, professional tone; short sentences; address the visitor directly.
- hero.title: max 60 characters, says what they do (and the city if given). hero.subtitle: max 110 characters. hero.text: 2-3 sentences. hero.ctaLabel: 2-4 words (e.g. "Contact me", "Book a call").
- services.items: one item per service given (max 6), each text 1-2 sentences.
- about.text: 3-5 sentences in first person if it's a person, otherwise "we".
- method.items: 3 short steps describing how they work with a customer, consistent with the info.
- seoDescription: max 155 characters, for Google, with what they do and the city if given.`,
        },
      ],
    })
    const block = message.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') return { success: false, message: 'aiError' }
    const raw = block.input as Partial<LandingAiDraft>
    const items = (v: unknown, max: number) =>
      (Array.isArray(v) ? v : [])
        .map((x) => ({ title: clip((x as { title?: unknown })?.title, 80), text: clip((x as { text?: unknown })?.text, 400) }))
        .filter((x) => x.title)
        .slice(0, max)
    return {
      success: true,
      draft: {
        hero: {
          title: clip(raw.hero?.title, 100),
          subtitle: clip(raw.hero?.subtitle, 160),
          text: clip(raw.hero?.text, 600),
          ctaLabel: clip(raw.hero?.ctaLabel, 40),
        },
        services: { title: clip(raw.services?.title, 80), items: items(raw.services?.items, 6) },
        about: { title: clip(raw.about?.title, 80), text: clip(raw.about?.text, 1500) },
        method: { title: clip(raw.method?.title, 80), items: items(raw.method?.items, 4) },
        seoDescription: clip(raw.seoDescription, 170),
      },
    }
  } catch (err) {
    console.error('[Landing] AI draft failed:', err)
    if (err instanceof MissingApiKeyError) return { success: false, message: 'aiUnavailable' }
    return { success: false, message: 'aiError' }
  }
}

// ---------------------------------------------------------------------------
// Segnalazione di un visitatore (anche senza account)
// ---------------------------------------------------------------------------

export async function reportLanding(slug: string, reason: ReportReason, details: string): Promise<{ success: boolean }> {
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return { success: false }
  const service = getServiceClient()
  const { data: page } = await service.from('landing_pages').select('owner_id').eq('slug', String(slug).toLowerCase()).maybeSingle()
  if (!page) return { success: false }

  // Stessa persona, stessa pagina: una segnalazione al giorno
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  const reporterHash = createHash('sha256').update(`${ip}|${page.owner_id}`).digest('hex').slice(0, 32)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await service
    .from('landing_reports')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', page.owner_id)
    .eq('reporter_hash', reporterHash)
    .gte('created_at', since)
  if ((count ?? 0) > 0) return { success: true }

  const { error } = await service.from('landing_reports').insert({
    owner_id: page.owner_id,
    reason,
    details: String(details ?? '').trim().slice(0, 1000) || null,
    reporter_hash: reporterHash,
  })
  return { success: !error }
}

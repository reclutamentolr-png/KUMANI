'use server'

import { getLocale, getTranslations } from 'next-intl/server'
import { isLandingLocale, LANDING_LOCALE_NAMES } from '@/lib/landing'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getAnthropicClient, MissingApiKeyError } from '@/lib/anthropic'
import { hasActiveOfferMakerAccess } from '@/lib/offermaker-server'
import { awardToolPoint } from '@/lib/toolPoints'
import {
  ANTHROPIC_MODEL,
  generateCampaignCode,
  type GeneratedCampaignDraft,
  type OfferFormAnswers,
} from '@/lib/offermaker'
import { limitError, logAiLimit } from '@/lib/appLimits'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

async function requireActiveOfferMakerSubscription(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'notLoggedIn' }
  }

  const hasAccess = await hasActiveOfferMakerAccess(supabase, user.id)
  if (!hasAccess) {
    return { ok: false, message: 'subscriptionRequired' }
  }

  return { ok: true, userId: user.id }
}

// Limite giornaliero di generazioni AI per utente (tabella offermaker_ai_usage,
// stessa forma di menu_ai_usage): Admin → Impostazioni, 3 se manca.
// Lunghezza massima di ogni risposta.
const OFFERMAKER_AI_DEFAULT_RUNS = 3
const MAX_ANSWER_LENGTH = 500

const serviceDb = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

async function dailyLimit(): Promise<number> {
  const { data } = await serviceDb().from('system_settings').select('value').eq('key', 'offermaker_ai_daily_runs').maybeSingle()
  const n = Number(String(data?.value ?? OFFERMAKER_AI_DEFAULT_RUNS).replace(/"/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : OFFERMAKER_AI_DEFAULT_RUNS
}

// Offerte con l'AI che restano oggi (stesso giorno UTC di ai_quota_take)
export async function offerMakerAiLeft(): Promise<ActionResult<{ left: number; limit: number }>> {
  const gate = await requireActiveOfferMakerSubscription()
  if (!gate.ok) return { success: false, message: gate.message }
  const limit = await dailyLimit()
  const { data } = await serviceDb().from('offermaker_ai_usage').select('runs').eq('owner_id', gate.userId).eq('used_on', new Date().toISOString().slice(0, 10)).maybeSingle()
  return { success: true, data: { left: Math.max(0, limit - Number(data?.runs ?? 0)), limit } }
}

function clampAnswers(answers: OfferFormAnswers): OfferFormAnswers {
  const clip = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_ANSWER_LENGTH) : '')
  return {
    whatOffer: clip(answers?.whatOffer),
    targetAudience: clip(answers?.targetAudience),
    priceInfo: clip(answers?.priceInfo),
    locationInfo: clip(answers?.locationInfo),
    strengthPoint: clip(answers?.strengthPoint),
    objective: clip(answers?.objective).slice(0, 40) as OfferFormAnswers['objective'],
    tone: clip(answers?.tone).slice(0, 40) as OfferFormAnswers['tone'],
    contactWhatsapp: clip(answers?.contactWhatsapp).slice(0, 40),
  }
}

// A volte l'AI infila i campi successivi dentro un testo, con pezzi di
// codice («</description> <parameter name="ctaLabel">Prenota ora»): si
// rimettono al loro posto e si tolgono i resti, così non finiscono sulla
// pagina che vedono i clienti
const LEAK = /<\/?[a-zA-Z_:]*parameter\b[^>]*>|<\/[a-zA-Z_]+>/
const LEAKED_FIELD = /<[a-zA-Z_:]*parameter name="([a-zA-Z]+)">([\s\S]*?)(?=<\/[a-zA-Z_:]*parameter>|<[a-zA-Z_:]*parameter |$)/g
function repairDraft(input: Record<string, unknown>): Partial<GeneratedCampaignDraft> {
  const out: Record<string, string> = {}
  const put = (key: string, value: string) => {
    const clean = value.replace(/<\/?[a-zA-Z_:]+[^>]*>/g, ' ').replace(/[ \t]{2,}/g, ' ').trim()
    if (clean && !out[key]) out[key] = clean
  }
  for (const [key, value] of Object.entries(input ?? {})) {
    if (typeof value !== 'string') continue
    if (!LEAK.test(value)) {
      put(key, value)
      continue
    }
    const first = value.search(LEAK)
    put(key, value.slice(0, first))
    for (const m of value.matchAll(LEAKED_FIELD)) put(m[1], m[2])
  }
  return out as Partial<GeneratedCampaignDraft>
}

// language: la lingua di chi usa il servizio (prima i testi uscivano sempre in italiano)
function buildGenerationPrompt(answers: OfferFormAnswers, language: string): string {
  const objectiveLabels: Record<string, string> = {
    call: 'telefonate',
    whatsapp: 'messaggi WhatsApp',
    quote: 'richieste di preventivo',
    booking: 'prenotazioni',
    sale: 'vendite',
    store_visit: 'visite in negozio',
    other: 'altro',
  }
  const toneLabels: Record<string, string> = {
    professional: 'professionale',
    friendly: 'amichevole',
    premium: 'premium',
    direct: 'diretto',
    elegant: 'elegante',
    energetic: 'energico',
  }

  return `Sei un copywriter esperto in marketing locale per piccole imprese e liberi professionisti.
Crea il contenuto di una campagna promozionale a partire da queste informazioni:

Cosa offre: ${answers.whatOffer}
A chi si rivolge: ${answers.targetAudience}
Prezzo: ${answers.priceInfo || 'non specificato'}
Dove opera: ${answers.locationInfo || 'non specificato'}
Punto di forza: ${answers.strengthPoint}
Obiettivo della campagna: ${objectiveLabels[answers.objective] || answers.objective}
Stile comunicativo richiesto: ${toneLabels[answers.tone] || answers.tone}

Genera: un titolo campagna breve (per uso interno), una headline accattivante per la landing page,
un riassunto dell'offerta in una frase, una descrizione di 2-3 frasi, un'etichetta per il pulsante
di call-to-action (max 4 parole, in maiuscolo), e tre varianti di messaggio WhatsApp da inviare a
potenziali clienti: una "soft" (leggera, informale), una "direct" (diretta, con urgenza) e una
"followup" (per ricontattare chi non ha risposto). Scrivi tutto in ${language}, nello stile richiesto, anche se le informazioni qui sopra sono in un'altra lingua.`
}

export async function generateOfferDraft(
  rawAnswers: OfferFormAnswers
): Promise<ActionResult<GeneratedCampaignDraft>> {
  const gate = await requireActiveOfferMakerSubscription()
  if (!gate.ok) {
    return { success: false, message: gate.message }
  }

  let client
  try {
    client = getAnthropicClient()
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return { success: false, message: 'missingApiKey' }
    }
    return { success: false, message: 'generateError' }
  }

  const answers = clampAnswers(rawAnswers)
  const locale = await getLocale()

  // Limite giornaliero: contato solo dopo aver verificato che la chiave API
  // esista (una chiave mancante non deve consumare la quota), prima della chiamata.
  // Contatore atomico nel database (l'utente non può azzerarlo né superarlo
  // con richieste in parallelo)
  const { data: taken, error: usageError } = await serviceDb().rpc('ai_quota_take', { p_kind: 'offermaker', p_user: gate.userId, p_limit: await dailyLimit() })
  if (usageError) {
    console.error('[OfferMaker] usage update failed:', usageError)
    return { success: false, message: 'generateError' }
  }
  if (taken === null) {
    await logAiLimit(gate.userId, 'offermaker')
    return { success: false, message: 'aiLimitReached' }
  }

  try {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      tools: [
        {
          name: 'emit_offer_campaign',
          description: 'Emette il contenuto strutturato di una campagna promozionale.',
          input_schema: {
            type: 'object',
            properties: {
              campaignTitle: { type: 'string', description: 'Titolo interno breve della campagna' },
              headline: { type: 'string', description: 'Headline principale della landing page' },
              offerSummary: { type: 'string', description: "Riassunto dell'offerta in una frase" },
              description: { type: 'string', description: 'Descrizione estesa, 2-3 frasi' },
              ctaLabel: { type: 'string', description: 'Testo del pulsante CTA, max 4 parole' },
              whatsappMessageSoft: { type: 'string', description: 'Messaggio WhatsApp in tono leggero' },
              whatsappMessageDirect: { type: 'string', description: 'Messaggio WhatsApp diretto e con urgenza' },
              whatsappMessageFollowup: { type: 'string', description: 'Messaggio WhatsApp di follow-up' },
            },
            required: [
              'campaignTitle',
              'headline',
              'offerSummary',
              'description',
              'ctaLabel',
              'whatsappMessageSoft',
              'whatsappMessageDirect',
              'whatsappMessageFollowup',
            ],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_offer_campaign' },
      messages: [{ role: 'user', content: buildGenerationPrompt(answers, LANDING_LOCALE_NAMES[isLandingLocale(locale) ? locale : 'it']) }],
    })

    const toolUse = message.content.find(
      (block): block is Extract<typeof block, { type: 'tool_use' }> => block.type === 'tool_use'
    )

    if (!toolUse) {
      console.error('[OfferMaker] nessuna risposta strutturata, stop_reason:', message.stop_reason)
      return { success: false, message: 'generateError' }
    }

    const raw = repairDraft(toolUse.input as Record<string, unknown>)
    const text = (field: keyof GeneratedCampaignDraft) => (typeof raw[field] === 'string' ? raw[field]!.trim() : '')
    // Indispensabili: senza questi non c'è un'offerta da mostrare
    const essential: Array<keyof GeneratedCampaignDraft> = ['headline', 'description', 'whatsappMessageDirect']
    const missing = essential.filter((field) => !text(field))
    if (missing.length) {
      console.error('[OfferMaker] risposta incompleta, stop_reason:', message.stop_reason, 'campi:', missing)
      return { success: false, message: 'generateError' }
    }
    // Gli altri campi a volte arrivano vuoti (soprattutto il testo del
    // pulsante): si completano invece di scartare tutta l'offerta
    const t = await getTranslations('offermaker')
    const draft: GeneratedCampaignDraft = {
      campaignTitle: text('campaignTitle') || text('headline'),
      headline: text('headline'),
      offerSummary: text('offerSummary') || text('headline'),
      description: text('description'),
      ctaLabel: text('ctaLabel') || t('ctaFallback'),
      whatsappMessageSoft: text('whatsappMessageSoft') || text('whatsappMessageDirect'),
      whatsappMessageDirect: text('whatsappMessageDirect'),
      whatsappMessageFollowup: text('whatsappMessageFollowup') || text('whatsappMessageDirect'),
    }
    const filled = (Object.keys(draft) as Array<keyof GeneratedCampaignDraft>).filter((field) => !text(field))
    if (filled.length) console.warn('[OfferMaker] campi completati in automatico:', filled)

    return { success: true, data: draft }
  } catch (err: unknown) {
    console.error('[OfferMaker] generateOfferDraft failed:', err)
    const status = (err as { status?: number })?.status
    if (status === 429 || (typeof status === 'number' && status >= 500)) {
      return { success: false, message: 'rateLimited' }
    }
    return { success: false, message: 'generateError' }
  }
}

export async function publishOfferCampaign(
  answers: OfferFormAnswers,
  draft: GeneratedCampaignDraft
): Promise<ActionResult<{ id: string; code: string }>> {
  const gate = await requireActiveOfferMakerSubscription()
  if (!gate.ok) {
    return { success: false, message: gate.message }
  }

  const supabase = await createClient()

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCampaignCode()
    const { data, error } = await supabase
      .from('offermaker_campaigns')
      .insert({
        user_id: gate.userId,
        code,
        // Lingua dei testi (prima restava sempre «it»)
        locale: await getLocale(),
        status: 'published',
        what_offer: answers.whatOffer,
        target_audience: answers.targetAudience,
        price_info: answers.priceInfo || null,
        location_info: answers.locationInfo || null,
        strength_point: answers.strengthPoint,
        objective: answers.objective,
        tone: answers.tone,
        contact_whatsapp: answers.contactWhatsapp,
        campaign_title: draft.campaignTitle,
        headline: draft.headline,
        offer_summary: draft.offerSummary,
        description: draft.description,
        cta_label: draft.ctaLabel,
        whatsapp_message_soft: draft.whatsappMessageSoft,
        whatsapp_message_direct: draft.whatsappMessageDirect,
        whatsapp_message_followup: draft.whatsappMessageFollowup,
        ai_model: ANTHROPIC_MODEL,
        ai_generated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      })
      .select('id, code')
      .single()

    if (!error && data) {
      await awardToolPoint('offermaker')
      return { success: true, data: { id: data.id, code: data.code } }
    }

    // Unique violation on `code` — retry with a new one. Any other error, bail out.
    if (error && error.code !== '23505') {
      console.error('[OfferMaker] publishOfferCampaign failed:', error)
      const limit = await limitError(error)
      if (limit) return limit
      return { success: false, message: 'publishError' }
    }
  }

  return { success: false, message: 'publishError' }
}

export async function updateOfferCampaign(
  id: string,
  draft: GeneratedCampaignDraft
): Promise<ActionResult<null>> {
  const gate = await requireActiveOfferMakerSubscription()
  if (!gate.ok) {
    return { success: false, message: gate.message }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('offermaker_campaigns')
    .update({
      campaign_title: draft.campaignTitle,
      headline: draft.headline,
      offer_summary: draft.offerSummary,
      description: draft.description,
      cta_label: draft.ctaLabel,
      whatsapp_message_soft: draft.whatsappMessageSoft,
      whatsapp_message_direct: draft.whatsappMessageDirect,
      whatsapp_message_followup: draft.whatsappMessageFollowup,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[OfferMaker] updateOfferCampaign failed:', error)
    return { success: false, message: 'publishError' }
  }

  return { success: true, data: null }
}

export async function deleteOfferCampaign(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveOfferMakerSubscription()
  if (!gate.ok) {
    return { success: false, message: gate.message }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('offermaker_campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[OfferMaker] deleteOfferCampaign failed:', error)
    return { success: false, message: 'deleteError' }
  }

  return { success: true, data: null }
}

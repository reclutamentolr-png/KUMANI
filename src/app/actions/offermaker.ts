'use server'

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
// stessa forma di menu_ai_usage) e lunghezza massima di ogni risposta.
const OFFERMAKER_AI_DAILY_RUNS = 10
const MAX_ANSWER_LENGTH = 500

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

function buildGenerationPrompt(answers: OfferFormAnswers): string {
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

  return `Sei un copywriter esperto in marketing locale per piccole imprese e liberi professionisti italiani.
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
"followup" (per ricontattare chi non ha risposto). Scrivi tutto in italiano, nello stile richiesto.`
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

  // Limite giornaliero: contato solo dopo aver verificato che la chiave API
  // esista (una chiave mancante non deve consumare la quota), prima della chiamata.
  // Contatore atomico nel database (l'utente non può azzerarlo né superarlo
  // con richieste in parallelo)
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: taken, error: usageError } = await service.rpc('ai_quota_take', { p_kind: 'offermaker', p_user: gate.userId, p_limit: OFFERMAKER_AI_DAILY_RUNS })
  if (usageError) {
    console.error('[OfferMaker] usage update failed:', usageError)
    return { success: false, message: 'generateError' }
  }
  if (taken === null) return { success: false, message: 'aiLimitReached' }

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
      messages: [{ role: 'user', content: buildGenerationPrompt(answers) }],
    })

    const toolUse = message.content.find(
      (block): block is Extract<typeof block, { type: 'tool_use' }> => block.type === 'tool_use'
    )

    if (!toolUse) {
      return { success: false, message: 'generateError' }
    }

    const draft = toolUse.input as Partial<GeneratedCampaignDraft>
    const requiredFields: Array<keyof GeneratedCampaignDraft> = [
      'campaignTitle',
      'headline',
      'offerSummary',
      'description',
      'ctaLabel',
      'whatsappMessageSoft',
      'whatsappMessageDirect',
      'whatsappMessageFollowup',
    ]
    const isComplete = requiredFields.every((field) => typeof draft[field] === 'string' && draft[field]!.trim().length > 0)

    if (!isComplete) {
      return { success: false, message: 'generateError' }
    }

    return { success: true, data: draft as GeneratedCampaignDraft }
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

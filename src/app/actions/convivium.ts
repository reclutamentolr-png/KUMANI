'use server'

import { cookies } from 'next/headers'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { awardToolPoint } from '@/lib/toolPoints'
import { isToolOnline } from '@/lib/toolOnline'
import { localizedPath, notifyUser, pushDb } from '@/lib/push'
import { CONVIVIUM_LIMITS, OCCASION_EMOJI, inviteCodeOk, isOccasion, rsvpCookie, type ConviviumAnswer, type ConviviumOccasion } from '@/lib/convivium'

// KUMANI Convivium: le regole stanno nelle funzioni SQL convivium_* e nelle
// RLS; qui si controllano i dati e si passano al database.

type Result = { success: true; id?: string } | { success: false; error: string }

export type ConviviumInput = {
  occasion: ConviviumOccasion
  title: string
  note: string
  startsAt: string
  place: string
  mapsUrl: string
  maxGuests: number | null
  // Costo: non indicato, offre chi organizza, oppure tot a testa (es. «12,50»)
  costMode: 'none' | 'free' | 'amount'
  cost: string
  costNote: string
  hostJoins: boolean
}

type CleanInput = Omit<ConviviumInput, 'cost'> & { costCents: number | null }

// «12», «12,5», «12.50 €» → centesimi (da 0,50 € a 1.000 €)
function parseEuro(value: string): number | null {
  const s = String(value ?? '').replace(/[€\s]/g, '').replace(',', '.')
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null
  const cents = Math.round(Number(s) * 100)
  return cents >= 50 && cents <= CONVIVIUM_LIMITS.costEuro * 100 ? cents : null
}

function clean(input: ConviviumInput): { ok: true; value: CleanInput } | { ok: false; error: string } {
  const title = String(input.title ?? '').trim().replace(/\s+/g, ' ')
  const note = String(input.note ?? '').trim()
  const place = String(input.place ?? '').trim().replace(/\s+/g, ' ')
  let mapsUrl = String(input.mapsUrl ?? '').trim()
  const starts = new Date(input.startsAt)
  if (!isOccasion(input.occasion)) return { ok: false, error: 'invalid' }
  if (!title || title.length > CONVIVIUM_LIMITS.title) return { ok: false, error: 'title' }
  if (note.length > CONVIVIUM_LIMITS.note || place.length > CONVIVIUM_LIMITS.place) return { ok: false, error: 'invalid' }
  if (Number.isNaN(starts.getTime())) return { ok: false, error: 'date' }
  if (starts.getTime() < Date.now() - 3_600_000) return { ok: false, error: 'past' }
  if (starts.getTime() > Date.now() + 400 * 86_400_000) return { ok: false, error: 'date' }
  // Solo link https (Google Maps, Apple Maps, il sito del locale…)
  if (mapsUrl) {
    try {
      const u = new URL(mapsUrl)
      if (u.protocol !== 'https:' || mapsUrl.length > 500) mapsUrl = ''
    } catch {
      mapsUrl = ''
    }
  }
  const max = input.maxGuests == null ? null : Math.round(Number(input.maxGuests))
  const hostJoins = input.hostJoins !== false
  if (max !== null && (!Number.isFinite(max) || max < 1 || max > CONVIVIUM_LIMITS.maxGuests)) return { ok: false, error: 'invalid' }
  // Con chi organizza al tavolo servono almeno 2 posti
  if (max !== null && hostJoins && max < 2) return { ok: false, error: 'max' }
  const costMode = input.costMode === 'free' || input.costMode === 'amount' ? input.costMode : 'none'
  const costNote = costMode === 'none' ? '' : String(input.costNote ?? '').trim().replace(/\s+/g, ' ')
  if (costNote.length > CONVIVIUM_LIMITS.costNote) return { ok: false, error: 'invalid' }
  let costCents: number | null = null
  if (costMode === 'free') costCents = 0
  if (costMode === 'amount') {
    costCents = parseEuro(input.cost)
    if (costCents === null) return { ok: false, error: 'cost' }
  }
  return { ok: true, value: { occasion: input.occasion, title, note, startsAt: starts.toISOString(), place, mapsUrl, maxGuests: max, costMode, costNote, costCents, hostJoins } }
}

const knownError = (message: string) => (['suspended', 'not_allowed', 'past', 'limit'].find((k) => message.includes(k)) ?? 'generic')

export async function createConvivium(input: ConviviumInput): Promise<Result> {
  if (!(await isToolOnline('convivium'))) return { success: false, error: 'suspended' }
  const checked = clean(input)
  if (!checked.ok) return { success: false, error: checked.error }
  const v = checked.value
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('convivium_create', {
    p_occasion: v.occasion,
    p_title: v.title,
    p_note: v.note,
    p_starts: v.startsAt,
    p_place: v.place,
    p_maps: v.mapsUrl,
    p_max: v.maxGuests,
    p_cost: v.costCents,
    p_cost_note: v.costNote,
    p_host_joins: v.hostJoins,
  })
  if (error || !data) return { success: false, error: error ? knownError(error.message) : 'generic' }
  await awardToolPoint('convivium')
  revalidatePath('/[locale]/convivium', 'page')
  return { success: true, id: data as string }
}

export async function updateConvivium(id: string, input: ConviviumInput): Promise<Result> {
  if (!(await isToolOnline('convivium'))) return { success: false, error: 'suspended' }
  const checked = clean(input)
  if (!checked.ok) return { success: false, error: checked.error }
  const v = checked.value
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('convivium_events')
    .update({
      occasion: v.occasion,
      title: v.title,
      note: v.note || null,
      starts_at: v.startsAt,
      place: v.place || null,
      maps_url: v.mapsUrl || null,
      max_guests: v.maxGuests,
      cost_cents: v.costCents,
      cost_note: v.costNote || null,
      host_joins: v.hostJoins,
    })
    .eq('id', id)
    .select('id')
  if (error || !data?.length) return { success: false, error: 'generic' }
  revalidatePath('/[locale]/convivium/[id]', 'page')
  return { success: true, id }
}

// Annullata: la pagina dell'invito lo dice e non accetta più risposte
export async function setConviviumCancelled(id: string, cancelled: boolean): Promise<Result> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('convivium_events')
    .update({ cancelled_at: cancelled ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id')
  if (error || !data?.length) return { success: false, error: 'generic' }
  revalidatePath('/[locale]/convivium/[id]', 'page')
  return { success: true, id }
}

export async function deleteConvivium(id: string): Promise<Result> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('convivium_events').delete().eq('id', id).select('id')
  if (error || !data?.length) return { success: false, error: 'generic' }
  revalidatePath('/[locale]/convivium', 'page')
  return { success: true }
}

// Chi organizza toglie una risposta (es. un nome scherzoso)
export async function removeConviviumRsvp(rsvpId: string): Promise<Result> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('convivium_rsvps').delete().eq('id', rsvpId).select('id')
  if (error || !data?.length) return { success: false, error: 'generic' }
  revalidatePath('/[locale]/convivium/[id]', 'page')
  return { success: true }
}

// Risposta all'invito, anche senza account: il token resta in un cookie per
// poter cambiare risposta. Chi organizza riceve un avviso a ogni «Ci sto» o
// «Forse» nuovo.
export async function answerConvivium(code: string, name: string, answer: ConviviumAnswer): Promise<{ status: string }> {
  const normalized = String(code ?? '').trim().toUpperCase()
  const cleanName = String(name ?? '').trim().replace(/\s+/g, ' ')
  if (!inviteCodeOk(normalized) || !['yes', 'maybe', 'no'].includes(answer)) return { status: 'invalid' }
  if (!cleanName || cleanName.length > CONVIVIUM_LIMITS.name) return { status: 'name' }

  const jar = await cookies()
  const token = jar.get(rsvpCookie(normalized))?.value ?? null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('convivium_rsvp', { p_code: normalized, p_name: cleanName, p_answer: answer, p_token: token })
  if (error || !data) return { status: 'error' }
  const result = data as { status: string; token?: string; changed?: boolean; event_id?: string }
  if (result.status !== 'ok') return { status: result.status }

  if (result.token) {
    jar.set(rsvpCookie(normalized), result.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 180 * 86_400 })
  }

  // Avviso a chi organizza dopo aver risposto all'invitato (la conferma arriva subito)
  const eventId = result.event_id
  if (result.changed && answer !== 'no' && eventId) {
    after(async () => {
      const { data: event } = await pushDb().from('convivium_events').select('id, owner_id, title, occasion').eq('id', eventId).maybeSingle()
      if (!event) return
      const emoji = OCCASION_EMOJI[event.occasion as ConviviumOccasion] ?? '🥂'
      await notifyUser(event.owner_id as string, 'messages', (t, locale) => ({
        title: t(answer === 'yes' ? 'conviviumYesTitle' : 'conviviumMaybeTitle', { name: cleanName, emoji }),
        body: t('conviviumAnswerBody', { title: event.title as string }),
        url: localizedPath(locale, `/convivium/${event.id}`),
        tag: `convivium-${event.id}`,
      }))
    })
  }
  revalidatePath('/[locale]/convivium/invito/[code]', 'page')
  return { status: 'ok' }
}

// Stesso, dal modulo della pagina d'invito: funziona anche se la pagina non ha
// finito di caricarsi sul telefono (il modulo parte comunque)
export type ConviviumFormState = { status: string; answer: ConviviumAnswer | null } | null

export async function answerConviviumForm(_prev: ConviviumFormState, form: FormData): Promise<ConviviumFormState> {
  const answer = String(form.get('answer') ?? '') as ConviviumAnswer
  const res = await answerConvivium(String(form.get('code') ?? ''), String(form.get('name') ?? ''), answer)
  return { status: res.status, answer: res.status === 'ok' ? answer : null }
}

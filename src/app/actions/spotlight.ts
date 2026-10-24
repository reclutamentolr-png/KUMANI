'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { SPOTLIGHT_HOME_CACHE_TAG, SPOTLIGHT_LOCALE_FLAGS, SPOTLIGHT_STORY_MAX_LENGTH, type SpotlightModerationStatus } from '@/lib/spotlight'

export interface SpotlightFormData {
  displayName: string
  city: string
  country: string
  profession: string
  story: string
  favoriteTools: string[]
  showOnHome: boolean
  storyLocale: string
}

// Ogni cambio che può togliere qualcuno dalla home (revoca, eliminazione,
// modifica che rimette in moderazione) buca subito la cache della landing.
function revalidateSpotlight() {
  revalidatePath('/app/spotlight')
  revalidatePath('/spotlight')
  updateTag(SPOTLIGHT_HOME_CACHE_TAG)
}

type ActionResult = { success: true } | { success: false; message: 'notAuthenticated' | 'saveError' | 'subscriptionRequired' }

type UpsertResult = { success: true; moderationStatus: SpotlightModerationStatus } | Extract<ActionResult, { success: false }>

export async function upsertSpotlightProfile(form: SpotlightFormData): Promise<UpsertResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notAuthenticated' }

  const displayName = form.displayName.trim()
  const story = form.story.trim()
  // Solo gli abbonati attivi possono scrivere/modificare la storia. Revoca
  // ed eliminazione restano sempre possibili (sotto), anche a
  // abbonamento scaduto: il diritto di togliersi non dipende dal pagamento.
  if (!(await hasActiveToolAccess(supabase, user.id, 'spotlight'))) {
    return { success: false, message: 'subscriptionRequired' }
  }

  if (!displayName || !story || story.length > SPOTLIGHT_STORY_MAX_LENGTH) {
    return { success: false, message: 'saveError' }
  }

  const { data: saved, error } = await supabase
    .from('spotlight_profiles')
    .upsert(
    {
      user_id: user.id,
      display_name: displayName,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      profession: form.profession.trim() || null,
      story,
      favorite_tools: form.favoriteTools,
      is_opted_in: true,
      // moderation_status non si invia mai: lo gestisce il trigger DB
      // (una modifica al contenuto torna automaticamente in coda).
      show_on_home: form.showOnHome,
      home_consent_at: form.showOnHome ? new Date().toISOString() : null,
      story_locale: form.storyLocale in SPOTLIGHT_LOCALE_FLAGS ? form.storyLocale : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
    )
    // Lo stato finale lo decide il trigger DB: serve al form per dire
    // all'utente se la storia è in revisione o già in vetrina.
    .select('moderation_status')
    .single<{ moderation_status: SpotlightModerationStatus }>()

  if (error || !saved) return { success: false, message: 'saveError' }

  revalidateSpotlight()
  return { success: true, moderationStatus: saved.moderation_status }
}

export async function revokeSpotlightOptIn(): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notAuthenticated' }

  const { error } = await supabase.from('spotlight_profiles').update({ is_opted_in: false }).eq('user_id', user.id)
  if (error) return { success: false, message: 'saveError' }

  revalidateSpotlight()
  return { success: true }
}

export async function deleteSpotlightProfile(): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notAuthenticated' }

  const { error } = await supabase.from('spotlight_profiles').delete().eq('user_id', user.id)
  if (error) return { success: false, message: 'saveError' }

  revalidateSpotlight()
  return { success: true }
}

// Revoca in 1 click del solo consenso home: il profilo resta nella
// rotazione community, ma sparisce subito dalla landing.
export async function revokeSpotlightHomeConsent(): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notAuthenticated' }

  const { error } = await supabase
    .from('spotlight_profiles')
    .update({ show_on_home: false, home_consent_at: null })
    .eq('user_id', user.id)
  if (error) return { success: false, message: 'saveError' }

  revalidateSpotlight()
  return { success: true }
}

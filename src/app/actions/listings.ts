// src/app/actions/listings.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isToolOnline } from '@/lib/toolOnline'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { invalidateListingsCache } from '@/lib/listings-server'
import { ALL_LISTING_CATEGORIES, LISTING_COST, cleanListingCity, isListingCountry, type CreateListingData, type UpdateListingData } from '@/lib/listings'
import { limitError } from '@/lib/appLimits'
import { getListingMaxPhotos, getListingsFreeMode } from '@/lib/listingsMode'
import { cleanListingRegion } from '@/lib/listingRegions'

// ✅ Service client per bypassare RLS
const getServiceClient = () =>
  createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

// Località dell'annuncio: nazione obbligatoria (dall'elenco), città facoltativa.
// I contatti (email/telefono) non si salvano più: si contatta dalla chat.
function listingLocation(data: { countryCode?: string; region?: string; city?: string; isRemote?: boolean }) {
  const countryCode = (data.countryCode ?? '').toUpperCase()
  if (!isListingCountry(countryCode)) return null
  return { country_code: countryCode, region: cleanListingRegion(countryCode, data.region), city: cleanListingCity(data.city), is_remote: Boolean(data.isRemote) }
}

// Testi, prezzo e immagine ripuliti sul server (i limiti del modulo valgono
// solo nel browser): titolo 100, descrizione 1000, prezzo ≥ 0, immagine solo https
function listingFields(data: { title?: string; description?: string; category?: string; price?: number | string | null; imageUrl?: string | null; images?: string[] }, maxPhotos = 6) {
  const title = String(data.title ?? '').trim().slice(0, 100)
  const description = String(data.description ?? '').trim().slice(0, 1000)
  const priceNumber = data.price === null || data.price === undefined || data.price === '' ? null : Number(data.price)
  const price = priceNumber === null ? null : Number.isFinite(priceNumber) && priceNumber >= 0 ? Math.min(priceNumber, 10_000_000) : NaN
  // Foto: elenco (o la sola imageUrl dei moduli vecchi), solo https, senza doppioni
  const raw = (data.images?.length ? data.images : data.imageUrl ? [data.imageUrl] : []).map((u) => String(u ?? '').trim()).filter(Boolean)
  if (raw.some((u) => !/^https:\/\/[^\s"'<>]{4,2000}$/i.test(u))) return null
  const images = [...new Set(raw)].slice(0, maxPhotos)
  if (!title || !description || Number.isNaN(price)) return null
  // Regalo e scambio non hanno prezzo
  const noPrice = data.category === 'regalo' || data.category === 'baratto'
  return { title, description, category: data.category, price: noPrice ? null : price, image_url: images[0] ?? null, images }
}

export async function createListingAction(data: CreateListingData) {
  if (!(await isToolOnline('listings'))) return { success: false, message: 'listingErr_suspended' }
  const location = listingLocation(data)
  if (!location) return { success: false, message: 'listingErr_country' }
  const fields = listingFields(data, await getListingMaxPhotos())
  if (!fields) return { success: false, message: 'listingErr_fields' }
  const supabase = await createClient()

  // The acting user is always the authenticated session, never data.userId
  // (that field arrives from the client and can't be trusted for
  // authorization — using it directly here would let anyone drain another
  // user's points by passing their id).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'listingErr_login' }

  // «Bacheca libera» (Admin → Bacheca): niente KU Karma. Altrimenti si
  // spende atomicamente da daily_points (mai network_points, che è riservato
  // a voucher e vetrina) — guard "nella WHERE dell'UPDATE", niente race.
  const free = await getListingsFreeMode()
  let spendResult: { success: boolean; new_daily_points: number } | null = null
  if (!free) {
    const { data, error: spendError } = await supabase
      .rpc('spend_daily_points', { p_amount: LISTING_COST })
      .single<{ success: boolean; new_daily_points: number }>()
    if (spendError || !data) {
      return { success: false, message: 'listingErr_points' }
    }
    if (!data.success) {
      return { success: false, message: `Ti servono almeno ${LISTING_COST} punti per pubblicare un annuncio` }
    }
    spendResult = data
  }

  // 3. Crea l'annuncio — con service role: l'inserimento diretto dal
  // browser non è più consentito (si potrebbe saltare il costo in punti).
  // L'utente è quello della sessione, mai un id arrivato dal client.
  const { data: listing, error } = await getServiceClient()
    .from('listings')
    .insert({
      user_id: user.id,
      ...fields,
      ...location,
      // Compare solo dopo il controllo dello Staff (Admin → Bacheca)
      review_status: 'pending',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single()

  if (error) {
    // Rollback punti se fallisce (solo server: refund_points non è più
    // chiamabile dal client, accreditava qualsiasi importo a chiunque).
    if (spendResult) await getServiceClient().rpc('add_daily_points_for', { p_user_id: user.id, p_amount: LISTING_COST })
    const limit = await limitError(error)
    if (limit) return limit
    return { success: false, message: 'listingErr_create' }
  }
  invalidateListingsCache()

  // Avviso allo Staff: c'è un annuncio da controllare (badge della sezione)
  revalidatePath('/admin')
  // La vetrina si sceglie dopo, da «I miei annunci», quando l'annuncio è
  // pubblicato: in revisione i giorni di vetrina andrebbero persi.
  return { success: true, listing, pending: true, free, newPoints: spendResult?.new_daily_points ?? null }
}

// Same ownership pattern as republishListingAction: session-derived user,
// filtered .update() relying on the existing RLS UPDATE policy as a second
// layer. Doesn't touch points/cost — editing is free, only creation costs.
export async function updateListingAction(listingId: string, data: UpdateListingData) {
  if (!(await isToolOnline('listings'))) return { success: false, message: 'listingErr_suspended' }
  const location = listingLocation(data)
  if (!location) return { success: false, message: 'listingErr_country' }
  const fields = listingFields(data, await getListingMaxPhotos())
  if (!fields) return { success: false, message: 'listingErr_fields' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'listingErr_login' }

  const { data: listing, error } = await supabase
    .from('listings')
    .update({
      ...fields,
      ...location,
    })
    .eq('id', listingId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !listing) return { success: false, message: 'listingErr_edit' }
  invalidateListingsCache()
  return { success: true, listing }
}

// Flags a listing for admin review. report_listing() (SECURITY DEFINER, see
// supabase/migrations/20260922210000_add_listing_reports.sql) blocks
// self-reporting and upserts on (listing_id, reporter_id) so re-reporting
// just refreshes the reason instead of spamming duplicate rows.
export async function reportListingAction(listingId: string, reason?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: 'notLoggedIn' as const }

  const { data, error } = await supabase
    .rpc('report_listing', { p_listing_id: listingId, p_reason: reason || null })
    .single<{ success: boolean; reason: string | null }>()

  if (error || !data) return { success: false as const, message: 'error' as const }
  if (!data.success) {
    return { success: false as const, message: (data.reason || 'error') as 'not_found' | 'own_listing' | 'error' }
  }
  return { success: true as const }
}

export async function deleteListingAction(listingId: string, userId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('listings').delete().eq('id', listingId).eq('user_id', userId)

  if (error) return { success: false, message: 'listingErr_delete' }
  invalidateListingsCache()
  return { success: true }
}

// Renews a listing for another 30 days from now. An expired listing (past
// its expires_at) drops out of getActiveListings' public query on its own —
// this doesn't need a separate "is_active" flip, just pushing expires_at
// forward makes it publicly visible again. Ownership is checked via the
// authenticated session, not a client-supplied userId, same reasoning as
// createListingAction.
export async function republishListingAction(listingId: string) {
  if (!(await isToolOnline('listings'))) return { success: false, message: 'listingErr_suspended' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'listingErr_login' }

  const { error } = await supabase
    .from('listings')
    .update({ expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', listingId)
    .eq('user_id', user.id)

  if (error) return { success: false, message: 'listingErr_republish' }
  invalidateListingsCache()
  return { success: true }
}

// Spends network_points to feature the caller's own listing for 7 or 15
// days — the cost check, spend and featured_until update all happen inside
// one SECURITY DEFINER transaction (feature_listing, see
// supabase/migrations/20260922190000_add_listing_showcase.sql).
export async function featureListingAction(listingId: string, durationDays: 7 | 15) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: 'notLoggedIn' as const }

  const { data, error } = await supabase
    .rpc('feature_listing', { p_listing_id: listingId, p_duration_days: durationDays })
    .single<{ success: boolean; reason: string | null; featured_until: string | null; new_network_points: number }>()

  if (error || !data) return { success: false as const, message: 'error' as const }
  if (!data.success) {
    return {
      success: false as const,
      message: (data.reason || 'error') as 'invalid_duration' | 'not_found' | 'not_owner' | 'insufficient_points',
      balance: data.new_network_points,
    }
  }
  return { success: true as const, featuredUntil: data.featured_until as string, balance: data.new_network_points }
}

export async function markMessagesAsRead(userId: string, otherUserId: string, listingId?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('messages')
    .update({ is_read: true })
    .eq('receiver_id', userId)
    .eq('sender_id', otherUserId)
    .eq('is_read', false)
    
  if (listingId) {
    query = query.eq('listing_id', listingId)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('❌ ERRORE SUPABASE markMessagesAsRead:', error)
    return { success: false, error: error.message }
  }
  
  return { success: true, data }
}

// CANCELLAZIONE CONVERSAZIONE: può cancellarla solo chi l'ha iniziata.
// L'utente arriva SEMPRE dalla sessione (mai dal client) e gli id vengono
// validati come UUID prima di finire nel filtro: la cancellazione usa il
// service client, quindi un filtro manipolato potrebbe toccare altre chat.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function deleteConversationAction(
  _currentUserId: string,
  otherUserId: string,
  listingId?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'listingErr_login' }
  const currentUserId = user.id

  if (!UUID_RE.test(otherUserId) || (listingId && listingId !== 'direct' && !UUID_RE.test(listingId))) {
    return { success: false, error: 'chatErr_invalid' }
  }
  const conversationFilter = `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`

  // STEP 1: Verifica chi ha iniziato la conversazione
  let firstMessageQuery = supabase
    .from('messages')
    .select('sender_id')
    .or(conversationFilter)
  if (listingId === 'direct') firstMessageQuery = firstMessageQuery.is('listing_id', null)
  else if (listingId) firstMessageQuery = firstMessageQuery.eq('listing_id', listingId)

  const { data: firstMessages, error: firstMsgError } = await firstMessageQuery
    .order('created_at', { ascending: true })
    .limit(1)
  const firstMessage = firstMessages?.[0]

  if (firstMsgError || !firstMessage) {
    return { success: false, error: 'chatErr_notFound' }
  }

  if (firstMessage.sender_id !== currentUserId) {
    return {
      success: false,
      error: 'chatErr_forbidden'
    }
  }

  // STEP 2: Cancellazione con SERVICE CLIENT (bypass RLS), solo tra i due utenti
  const supabaseAdmin = getServiceClient()

  let deleteQuery = supabaseAdmin
    .from('messages')
    .delete()
    .or(conversationFilter)
  if (listingId === 'direct') deleteQuery = deleteQuery.is('listing_id', null)
  else if (listingId) deleteQuery = deleteQuery.eq('listing_id', listingId)

  const { data: deletedMessages, error: deleteError } = await deleteQuery.select('id')

  if (deleteError) {
    console.error('Errore cancellazione conversazione:', deleteError.message)
    return { success: false, error: deleteError.message }
  }

  const deletedCount = deletedMessages?.length || 0

  // STEP 3: Invalida la cache di Next.js
  revalidatePath('/marketplace/chat')
  revalidatePath('/marketplace')

  return { success: true, deletedCount }
}
// Foto dell'annuncio: il browser la comprime (WebP, lato lungo 1600 px), qui
// si ricontrollano tipo e peso e la si carica con la chiave di servizio.
// Al massimo 40 foto per persona (le più vecchie si possono sostituire).
export async function uploadListingPhoto(formData: FormData): Promise<{ success: true; url: string } | { success: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'listingErr_login' }
  const file = formData.get('file')
  if (!(file instanceof File)) return { success: false, message: 'listingPhotoError' }
  const allowed: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = allowed[file.type]
  if (!ext || file.size > 2 * 1024 * 1024) return { success: false, message: 'listingPhotoError' }

  const service = getServiceClient()
  const { data: files } = await service.storage.from('listing-photos').list(user.id, { limit: 100 })
  if ((files?.length ?? 0) >= 40) return { success: false, message: 'listingPhotoTooMany' }
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await service.storage.from('listing-photos').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) return { success: false, message: 'listingPhotoError' }
  return { success: true, url: service.storage.from('listing-photos').getPublicUrl(path).data.publicUrl }
}

// «Avvisami quando esce»: salva la ricerca della Bacheca (parole, categoria,
// nazione, regione, città). L'avviso parte quando lo Staff approva un
// annuncio adatto (lib/listingAlerts). Al massimo 10 ricerche per persona.
export async function saveListingAlert(input: { q?: string; category?: string; country?: string; region?: string; city?: string }): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'listingErr_login' }
  const country = (input.country ?? '').toUpperCase()
  const row = {
    user_id: user.id,
    query: (input.q ?? '').replace(/[,()*%\:"'`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || null,
    category: (ALL_LISTING_CATEGORIES as string[]).includes(input.category ?? '') ? input.category! : null,
    country_code: isListingCountry(country) ? country : null,
    region: isListingCountry(country) ? cleanListingRegion(country, input.region) : null,
    city: cleanListingCity(input.city),
  }
  if (!row.query && !row.category && !row.country_code && !row.city) return { success: false, message: 'listingAlertEmpty' }
  const { error } = await supabase.from('listing_alerts').insert(row)
  if (error) return { success: false, message: /listing_alerts_limit/.test(error.message) ? 'listingAlertLimit' : 'listingAlertError' }
  revalidatePath('/marketplace/listings')
  return { success: true }
}

export async function deleteListingAlert(id: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return { success: false }
  const { error } = await supabase.from('listing_alerts').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/marketplace/listings')
  return { success: !error }
}

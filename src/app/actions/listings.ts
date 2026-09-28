// src/app/actions/listings.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { isToolOnline } from '@/lib/toolOnline'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { LISTING_COST, type CreateListingData, type UpdateListingData } from '@/lib/listings'

// ✅ Service client per bypassare RLS
const getServiceClient = () =>
  createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

export async function createListingAction(data: CreateListingData) {
  if (!(await isToolOnline('listings'))) return { success: false, message: 'La Bacheca è momentaneamente sospesa: puoi consultare gli annunci ma non pubblicare o modificare.' }
  const supabase = await createClient()

  // The acting user is always the authenticated session, never data.userId
  // (that field arrives from the client and can't be trusted for
  // authorization — using it directly here would let anyone drain another
  // user's points by passing their id).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Devi effettuare l\'accesso' }

  // 1+2. Spende atomicamente da daily_points (mai network_points, che è
  // riservato a voucher/premi) — stesso guard "nella WHERE dell'UPDATE"
  // usato da create_subscription_voucher, evita la race condition del
  // vecchio pattern read-then-write.
  const { data: spendResult, error: spendError } = await supabase
    .rpc('spend_daily_points', { p_amount: LISTING_COST })
    .single<{ success: boolean; new_daily_points: number }>()

  if (spendError || !spendResult) {
    return { success: false, message: 'Errore nell\'aggiornamento punti' }
  }
  if (!spendResult.success) {
    return { success: false, message: `Ti servono almeno ${LISTING_COST} punti per pubblicare un annuncio` }
  }

  // 3. Crea l'annuncio — con service role: l'inserimento diretto dal
  // browser non è più consentito (si potrebbe saltare il costo in punti).
  // L'utente è quello della sessione, mai un id arrivato dal client.
  const { data: listing, error } = await getServiceClient()
    .from('listings')
    .insert({
      user_id: user.id,
      title: data.title,
      description: data.description,
      category: data.category,
      price: data.price,
      image_url: data.imageUrl,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single()

  if (error) {
    // Rollback punti se fallisce (solo server: refund_points non è più
    // chiamabile dal client, accreditava qualsiasi importo a chiunque).
    await getServiceClient().rpc('add_daily_points_for', { p_user_id: user.id, p_amount: LISTING_COST })
    return { success: false, message: 'Errore nella creazione dell\'annuncio' }
  }

  // Vetrina opzionale scelta in fase di creazione: riusa lo stesso RPC
  // atomico (feature_listing) di FeatureListingButton, chiamato subito dopo
  // sull'annuncio appena creato. Se fallisce (es. punti rete insufficienti
  // per una race condition) l'annuncio resta comunque valido — non si fa
  // rollback della creazione, si segnala solo l'esito della vetrina a parte.
  if (data.featureDurationDays) {
    const { data: featureResult } = await supabase
      .rpc('feature_listing', { p_listing_id: listing.id, p_duration_days: data.featureDurationDays })
      .single<{ success: boolean; reason: string | null; featured_until: string | null; new_network_points: number }>()

    if (featureResult?.success) {
      return {
        success: true,
        listing: { ...listing, featured_until: featureResult.featured_until },
        newPoints: spendResult.new_daily_points,
        featured: true,
        newNetworkPoints: featureResult.new_network_points,
      }
    }
    return {
      success: true,
      listing,
      newPoints: spendResult.new_daily_points,
      featured: false,
      featureError: featureResult?.reason || 'error',
    }
  }

  return { success: true, listing, newPoints: spendResult.new_daily_points }
}

// Same ownership pattern as republishListingAction: session-derived user,
// filtered .update() relying on the existing RLS UPDATE policy as a second
// layer. Doesn't touch points/cost — editing is free, only creation costs.
export async function updateListingAction(listingId: string, data: UpdateListingData) {
  if (!(await isToolOnline('listings'))) return { success: false, message: 'La Bacheca è momentaneamente sospesa: puoi consultare gli annunci ma non pubblicare o modificare.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Devi effettuare l\'accesso' }

  const { data: listing, error } = await supabase
    .from('listings')
    .update({
      title: data.title,
      description: data.description,
      category: data.category,
      price: data.price,
      image_url: data.imageUrl,
      contact_email: data.contactEmail,
      contact_phone: data.contactPhone,
    })
    .eq('id', listingId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !listing) return { success: false, message: 'Errore nella modifica dell\'annuncio' }
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

  if (error) return { success: false, message: 'Errore nell\'eliminazione' }
  return { success: true }
}

// Renews a listing for another 30 days from now. An expired listing (past
// its expires_at) drops out of getActiveListings' public query on its own —
// this doesn't need a separate "is_active" flip, just pushing expires_at
// forward makes it publicly visible again. Ownership is checked via the
// authenticated session, not a client-supplied userId, same reasoning as
// createListingAction.
export async function republishListingAction(listingId: string) {
  if (!(await isToolOnline('listings'))) return { success: false, message: 'La Bacheca è momentaneamente sospesa: puoi consultare gli annunci ma non pubblicare o modificare.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Devi effettuare l\'accesso' }

  const { error } = await supabase
    .from('listings')
    .update({ expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('id', listingId)
    .eq('user_id', user.id)

  if (error) return { success: false, message: 'Errore durante la ripubblicazione' }
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
  if (!user) return { success: false, error: 'Non autenticato' }
  const currentUserId = user.id

  if (!UUID_RE.test(otherUserId) || (listingId && listingId !== 'direct' && !UUID_RE.test(listingId))) {
    return { success: false, error: 'Conversazione non valida' }
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
    return { success: false, error: 'Conversazione non trovata' }
  }

  if (firstMessage.sender_id !== currentUserId) {
    return {
      success: false,
      error: 'Non hai i permessi per cancellare questa conversazione'
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
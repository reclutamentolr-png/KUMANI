// src/lib/listings-server.ts
import { createClient } from '@/lib/supabase/server'
import type { ListingCategory } from '@/lib/listings'

export async function getActiveListings(options?: {
  category?: ListingCategory
  limit?: number
  excludeUserId?: string
  excludeFeatured?: boolean
}) {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  let query = supabase
    .from('listings')
    .select(`
      *,
      profiles:user_id (first_name)
    `)
    .eq('is_active', true)
    .gte('expires_at', nowIso)
    .order('created_at', { ascending: false })

  if (options?.category) query = query.eq('category', options.category)
  if (options?.limit) query = query.limit(options.limit)
  if (options?.excludeUserId) query = query.neq('user_id', options.excludeUserId)
  // Currently-showcased listings get their own section above the grid —
  // excluded here so they don't also clutter the regular listing (they
  // still count for category filters/totals via the separate query).
  if (options?.excludeFeatured) query = query.or(`featured_until.is.null,featured_until.lt.${nowIso}`)

  const { data, error } = await query
  return error ? [] : (data || [])
}

/** Currently-showcased ("In Vetrina") listings, most-recently-featured first. */
export async function getFeaturedListings(options?: { category?: ListingCategory }) {
  const supabase = await createClient()
  const nowIso = new Date().toISOString()

  let query = supabase
    .from('listings')
    .select(`
      *,
      profiles:user_id (first_name)
    `)
    .eq('is_active', true)
    .gte('expires_at', nowIso)
    .gt('featured_until', nowIso)
    .order('featured_until', { ascending: false })

  if (options?.category) query = query.eq('category', options.category)

  const { data, error } = await query
  return error ? [] : (data || [])
}

export async function getUserListings(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  return data || []
}
export async function getUnreadMessagesCount(userId: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('is_read', false)
  
  return count || 0
}

export async function getUserConversations(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('messages')
    .select(`
      id, sender_id, receiver_id, listing_id, content, created_at, is_read,
      sender:sender_id (id, first_name),
      receiver:receiver_id (id, first_name),
      listing:listing_id (id, title)
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: true }) // ✅ Ascending per calcolare il primo messaggio
  
  const conversationsMap = new Map()
  
  data?.forEach((msg: any) => {
    const isUserSender = msg.sender_id === userId
    const otherUserId = isUserSender ? msg.receiver_id : msg.sender_id
    const otherUser = isUserSender ? msg.receiver : msg.sender
    // Degli altri Kumani si mostra solo il nome
    const otherUserName = otherUser?.first_name?.trim() || 'Utente'
    
    const listingId = msg.listing_id || 'direct'
    const key = `${listingId}_${otherUserId}`
    
    if (!conversationsMap.has(key)) {
      conversationsMap.set(key, {
        key,
        listingId: msg.listing_id,
        listingTitle: msg.listing?.title || 'Messaggio diretto',
        otherUserId,
        otherUserName,
        lastMessage: msg.content,
        createdAt: msg.created_at,
        // ✅ Chi ha inviato il PRIMO messaggio è colui che ha iniziato la conversazione
        initiatedBy: msg.sender_id,
        unreadCount: 0,
        lastMessageAt: msg.created_at
      })
    } else {
      const conv = conversationsMap.get(key)
      // Aggiorna l'ultimo messaggio e la data
      conv.lastMessage = msg.content
      conv.lastMessageAt = msg.created_at
    }
  })
  
  // Secondo passaggio: calcoliamo i non letti (ora che abbiamo tutte le conversazioni)
  data?.forEach((msg: any) => {
    const isUserSender = msg.sender_id === userId
    const otherUserId = isUserSender ? msg.receiver_id : msg.sender_id
    const listingId = msg.listing_id || 'direct'
    const key = `${listingId}_${otherUserId}`
    
    if (conversationsMap.has(key)) {
      const conv = conversationsMap.get(key)
      if (!isUserSender && !msg.is_read) {
        conv.unreadCount += 1
      }
    }
  })
  
  // Ordina per data dell'ultimo messaggio (più recenti in cima)
  return Array.from(conversationsMap.values()).sort((a: any, b: any) => 
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )
}
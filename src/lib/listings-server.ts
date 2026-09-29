// src/lib/listings-server.ts
import { revalidateTag, unstable_cache } from 'next/cache'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Conversation, ListingCategory, ListingMessage } from '@/lib/listings'

// Ricerca libera nella Bacheca: testo (titolo o descrizione) oppure nome di
// una categoria. Si tolgono i caratteri che hanno un significato nei filtri
// del database, così la ricerca non può alterare la query.
export function cleanListingSearch(raw?: string | null) {
  return (raw ?? '').replace(/[,()*%\\:"'`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

// Ogni parola cercata deve comparire nel titolo, nella descrizione o nel nome
// della categoria (in qualsiasi ordine): "consulenza informatica" trova anche
// "Consulenza in ambito informatico".
export type ListingSearchTerm = { word: string; categories: ListingCategory[] }

function termFilter(term: ListingSearchTerm) {
  const parts = [`title.ilike.%${term.word}%`, `description.ilike.%${term.word}%`]
  if (term.categories.length > 0) parts.push(`category.in.(${term.categories.join(',')})`)
  return parts.join(',')
}

// Ricerca: parole, nazione (codice ISO) e città. Con una città si vedono
// anche gli annunci "anche online / a distanza" della stessa nazione.
export type ListingSearch = { terms?: ListingSearchTerm[]; country?: string; city?: string }

// Filtri "oppure" separati si sommano come condizioni "e" (una per parola)
function applySearch<Q extends { or: (filters: string) => Q; eq: (column: string, value: string) => Q }>(
  query: Q,
  search?: ListingSearch
) {
  for (const term of search?.terms ?? []) query = query.or(termFilter(term))
  if (search?.country) query = query.eq('country_code', search.country)
  if (search?.city) query = query.or(`city.ilike."${search.city}",is_remote.eq.true`)
  return query
}

// Annunci per pagina nella Bacheca
export const LISTINGS_PAGE_SIZE = 30

export async function getActiveListings(options?: {
  category?: ListingCategory
  limit?: number
  // Pagina (da 1): restituisce fino a LISTINGS_PAGE_SIZE + 1 annunci, quello
  // in più serve solo a sapere se esiste la pagina successiva.
  page?: number
  excludeUserId?: string
  excludeFeatured?: boolean
} & ListingSearch) {
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
  if (options?.page) {
    const from = (options.page - 1) * LISTINGS_PAGE_SIZE
    query = query.range(from, from + LISTINGS_PAGE_SIZE)
  }
  if (options?.excludeUserId) query = query.neq('user_id', options.excludeUserId)
  // Currently-showcased listings get their own section above the grid —
  // excluded here so they don't also clutter the regular listing (they
  // still count for category filters/totals via the separate query).
  if (options?.excludeFeatured) query = query.or(`featured_until.is.null,featured_until.lt.${nowIso}`)
  query = applySearch(query, options)

  const { data, error } = await query
  return error ? [] : (data || [])
}

/** Currently-showcased ("In Vetrina") listings, most-recently-featured first. */
export async function getFeaturedListings(options?: { category?: ListingCategory } & ListingSearch) {
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
  query = applySearch(query, options)

  const { data, error } = await query
  return error ? [] : (data || [])
}

// Letture uguali per tutti (conteggi e città): chiave di servizio e
// memoria di 5 minuti, invece di rileggere tutti gli annunci a ogni visita.
function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Svuota la memoria di conteggi e città: da chiamare quando un annuncio
// viene pubblicato, modificato, ripubblicato o cancellato.
const LISTINGS_CACHE_TAG = 'listings'
export function invalidateListingsCache() {
  revalidateTag(LISTINGS_CACHE_TAG, { expire: 0 })
}

async function countByCategory(supabase: SupabaseClient, search?: ListingSearch) {
  let query = supabase
    .from('listings')
    .select('category')
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
  query = applySearch(query, search)
  const { data } = await query
  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.category] = (counts[row.category] ?? 0) + 1
  return counts
}

const cachedCategoryCounts = unstable_cache(
  async (country: string, city: string) => countByCategory(serviceClient(), { country: country || undefined, city: city || undefined }),
  ['listing-category-counts'],
  { revalidate: 300, tags: [LISTINGS_CACHE_TAG] }
)

/** Quanti annunci attivi per categoria (con la ricerca, senza il filtro di categoria). */
export async function getActiveListingCategoryCounts(search?: ListingSearch) {
  // Senza parole cercate (il caso più comune) il conteggio è uguale per
  // tutti: dalla memoria. Con le parole si calcola al momento.
  if (!search?.terms?.length) return cachedCategoryCounts(search?.country ?? '', search?.city ?? '')
  return countByCategory(await createClient(), search)
}

/** Un annuncio attivo (per aprirlo da un link condiviso), o null. */
export async function getActiveListingById(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select(`
      *,
      profiles:user_id (first_name)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()
  return data
}

/** Città già usate negli annunci attivi, per nazione (suggerimenti di ricerca e pubblicazione). */
export const getListingCitiesByCountry = unstable_cache(async () => {
  const { data } = await serviceClient()
    .from('listings')
    .select('country_code, city')
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .not('city', 'is', null)
    .not('country_code', 'is', null)
  const byCountry: Record<string, string[]> = {}
  const seen = new Set<string>()
  for (const row of data ?? []) {
    const key = `${row.country_code}|${String(row.city).toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    ;(byCountry[row.country_code] ??= []).push(row.city)
  }
  for (const list of Object.values(byCountry)) list.sort((a, b) => a.localeCompare(b))
  return byCountry
}, ['listing-cities'], { revalidate: 300, tags: [LISTINGS_CACHE_TAG] })

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
    // Gli ultimi 500 messaggi, dai più recenti: prima si leggevano tutti dal
    // più vecchio e, oltre il limite del database (circa 1000 righe), si
    // perdevano proprio i più nuovi. Poi si rimettono in ordine cronologico.
    // "Chi ha iniziato" per chat lunghissime è indicativo: la cancellazione
    // lo ricontrolla sul server (deleteConversationAction).
    .order('created_at', { ascending: false })
    .limit(500)
  // Messaggio con i nomi di mittente e destinatario e il titolo dell'annuncio
  type ConversationRow = ListingMessage & {
    sender: { id: string; first_name: string | null } | null
    receiver: { id: string; first_name: string | null } | null
    listing: { id: string; title: string } | null
  }
  const rows = ((data ?? []) as unknown as ConversationRow[]).reverse()
  
  const conversationsMap = new Map<string, Conversation>()
  
  rows.forEach((msg) => {
    const isUserSender = msg.sender_id === userId
    const otherUserId = isUserSender ? msg.receiver_id : msg.sender_id
    const otherUser = isUserSender ? msg.receiver : msg.sender
    // Degli altri Kumani si mostra solo il nome
    // Vuoto se manca: la pagina mostra "Utente" nella lingua giusta
    const otherUserName = otherUser?.first_name?.trim() || ''
    
    const listingId = msg.listing_id || 'direct'
    const key = `${listingId}_${otherUserId}`
    
    if (!conversationsMap.has(key)) {
      conversationsMap.set(key, {
        key,
        listingId: msg.listing_id,
        listingTitle: msg.listing?.title || '',
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
      const conv = conversationsMap.get(key)!
      // Aggiorna l'ultimo messaggio e la data
      conv.lastMessage = msg.content
      conv.lastMessageAt = msg.created_at
    }
  })
  
  // Secondo passaggio: calcoliamo i non letti (ora che abbiamo tutte le conversazioni)
  rows.forEach((msg) => {
    const isUserSender = msg.sender_id === userId
    const otherUserId = isUserSender ? msg.receiver_id : msg.sender_id
    const listingId = msg.listing_id || 'direct'
    const key = `${listingId}_${otherUserId}`
    
    if (conversationsMap.has(key)) {
      const conv = conversationsMap.get(key)!
      if (!isUserSender && !msg.is_read) {
        conv.unreadCount += 1
      }
    }
  })
  
  // Ordina per data dell'ultimo messaggio (più recenti in cima)
  return Array.from(conversationsMap.values()).sort((a, b) => 
    new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  )
}
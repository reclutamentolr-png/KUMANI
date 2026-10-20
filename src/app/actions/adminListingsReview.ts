'use server'

import { updateTag } from 'next/cache'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { localizedPath, notifyUser, pushDb } from '@/lib/push'
import { LISTINGS_MODE_CACHE_TAG } from '@/lib/listingsMode'
import { invalidateListingsCache } from '@/lib/listings-server'

// Admin → Bacheca: interruttore «Bacheca libera» (pubblicare gratis) e
// controllo degli annunci prima che compaiano (approva / non approvare con
// il motivo). Chi ha scritto l'annuncio riceve l'esito come avviso.

export type PendingListing = {
  id: string
  title: string
  description: string
  category: string
  price: number | null
  imageUrl: string | null
  city: string | null
  region: string | null
  countryCode: string | null
  isRemote: boolean
  createdAt: string
  author: string
  authorEmail: string | null
}

export async function adminGetListingsReview(): Promise<{ free: boolean; pending: PendingListing[] } | { error: string }> {
  if (!(await verifyAdmin('listings.read'))) return { error: 'Non autorizzato' }
  const db = pushDb()
  const [{ data: setting }, { data: rows }] = await Promise.all([
    db.from('system_settings').select('value').eq('key', 'listings_free_mode').maybeSingle(),
    db
      .from('listings')
      .select('id, title, description, category, price, image_url, city, region, country_code, is_remote, created_at, user_id')
      .eq('review_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(200),
  ])
  const ids = [...new Set((rows ?? []).map((r) => r.user_id as string))]
  const { data: people } = ids.length ? await db.from('profiles').select('id, first_name, last_name, email').in('id', ids) : { data: [] }
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]))
  return {
    free: String(setting?.value ?? '').replace(/"/g, '') === 'true',
    pending: (rows ?? []).map((r) => {
      const p = byId.get(r.user_id as string)
      return {
        id: r.id as string,
        title: r.title as string,
        description: r.description as string,
        category: r.category as string,
        price: r.price === null ? null : Number(r.price),
        imageUrl: (r.image_url as string | null) ?? null,
        city: (r.city as string | null) ?? null,
        region: (r.region as string | null) ?? null,
        countryCode: (r.country_code as string | null) ?? null,
        isRemote: Boolean(r.is_remote),
        createdAt: r.created_at as string,
        author: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—',
        authorEmail: (p?.email as string | null) ?? null,
      }
    }),
  }
}

export async function adminSetListingsFreeMode(on: boolean): Promise<{ success: boolean; error?: string }> {
  if (!(await verifyAdmin('listings.write'))) return { success: false, error: 'Non autorizzato' }
  const { error } = await pushDb()
    .from('system_settings')
    .upsert({ key: 'listings_free_mode', value: on ? 'true' : 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  updateTag(LISTINGS_MODE_CACHE_TAG)
  return { success: true }
}

export async function adminReviewListing(id: string, approve: boolean, note: string): Promise<{ success: boolean; error?: string }> {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false, error: 'Annuncio non valido' }
  const reason = note.trim().slice(0, 300)
  if (!approve && !reason) return { success: false, error: 'Scrivi il motivo: lo legge chi ha pubblicato l’annuncio' }
  const db = pushDb()
  const { data: listing, error } = await db
    .from('listings')
    .update({
      review_status: approve ? 'approved' : 'rejected',
      review_note: approve ? null : reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
      // I 30 giorni di visibilità partono dalla pubblicazione, non dall'invio
      ...(approve ? { expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } : {}),
    })
    .eq('id', id)
    .eq('review_status', 'pending')
    .select('id, title, user_id')
    .maybeSingle()
  if (error) return { success: false, error: error.message }
  if (!listing) return { success: false, error: 'Annuncio già controllato o cancellato' }
  invalidateListingsCache()
  await notifyUser(
    listing.user_id as string,
    'alerts',
    (t, locale) => ({
      title: t(approve ? 'listingApprovedTitle' : 'listingRejectedTitle'),
      body: approve ? t('listingApprovedBody', { title: listing.title as string }) : t('listingRejectedBody', { title: listing.title as string, reason }),
      url: localizedPath(locale, '/marketplace/listings'),
      tag: `listing-review-${listing.id}`,
    })
  )
  return { success: true }
}

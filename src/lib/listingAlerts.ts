import { localizedPath, notifyUser, pushDb } from '@/lib/push'

// «Avvisami quando esce»: quando lo Staff approva un annuncio, chi ha salvato
// una ricerca adatta riceve un avviso (campanella e telefono). Una ricerca è
// adatta se categoria, nazione, regione e città coincidono (quelle indicate)
// e tutte le parole cercate compaiono nel titolo o nella descrizione.

type ApprovedListing = {
  id: string
  user_id: string
  title: string
  description: string
  category: string
  country_code: string | null
  region: string | null
  city: string | null
  is_remote: boolean | null
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export async function notifyListingAlerts(listing: ApprovedListing) {
  const db = pushDb()
  let query = db
    .from('listing_alerts')
    .select('id, user_id, query, category, country_code, region, city')
    .neq('user_id', listing.user_id)
    .or(`category.is.null,category.eq.${listing.category}`)
    .limit(2000)
  if (listing.country_code) query = query.or(`country_code.is.null,country_code.eq.${listing.country_code}`)
  const { data: alerts } = await query
  const text = norm(`${listing.title} ${listing.description}`)
  const sent = new Set<string>()
  for (const a of alerts ?? []) {
    if (sent.has(a.user_id as string)) continue
    // Regione e città: chi è «anche online» va bene in tutta la nazione
    if (a.region && norm(a.region) !== norm(listing.region) && !listing.is_remote) continue
    if (a.city && norm(a.city) !== norm(listing.city) && !listing.is_remote) continue
    const words = norm(a.query as string | null)
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => (w.length >= 5 ? w.replace(/[aeiou]$/, '') : w))
    if (words.some((w) => !text.includes(w))) continue
    sent.add(a.user_id as string)
    await notifyUser(
      a.user_id as string,
      'alerts',
      (t, locale) => ({
        title: t('listingAlertTitle'),
        body: t('listingAlertBody', { title: listing.title }),
        url: localizedPath(locale, `/app/listings?listing=${listing.id}`),
        tag: `listing-alert-${listing.id}`,
      }),
      { kind: 'listing_alert', ref: listing.id }
    )
    await db.from('listing_alerts').update({ last_sent_at: new Date().toISOString() }).eq('id', a.id)
  }
}

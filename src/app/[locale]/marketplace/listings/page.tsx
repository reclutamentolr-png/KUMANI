import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { getTranslations } from 'next-intl/server'
import { LISTINGS_PAGE_SIZE, getUnreadMessagesCount, getActiveListings, getFeaturedListings, getUserListings, getActiveListingCategoryCounts, getActiveListingById, getListingCitiesByCountry, cleanListingSearch } from '@/lib/listings-server'
import { CATEGORY_ICONS, CATEGORY_I18N_KEYS, ALL_LISTING_CATEGORIES, LISTING_COUNTRIES, isListingCountry, cleanListingCity, type Listing, type ListingCategory } from '@/lib/listings'
import { countryName } from '@/lib/events'
import { deleteListingAction, republishListingAction } from '@/app/actions/listings'
import { ArrowLeft, MessageCircle, Plus, Tag, Trash2, Eye, Calendar, RefreshCw, Sparkles, Coins, Info, ChevronDown } from 'lucide-react'
import ListingForm from '@/components/ListingForm'
import ChatModalWrapper from '@/components/ChatModalWrapper'
import FeatureListingButton from '@/components/FeatureListingButton'
import ListingDetailButton from '@/components/ListingDetailButton'
import ListingDetailModalWrapper from '@/components/ListingDetailModalWrapper'
import EditListingButton from '@/components/EditListingButton'
import EditListingModalWrapper from '@/components/EditListingModalWrapper'
import ListingCard, { CATEGORY_STYLE } from '@/components/listings/ListingCard'
import ListingsFilters from '@/components/listings/ListingsFilters'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// Parole senza significato nella ricerca (articoli, preposizioni) in 7 lingue
const SEARCH_STOPWORDS = new Set([
  'del', 'dei', 'della', 'delle', 'degli', 'dal', 'dai', 'dalla', 'nel', 'nei', 'nella', 'sul', 'sui', 'sulla', 'per', 'con', 'tra', 'fra', 'gli', 'una', 'uno', 'che', 'non',
  'the', 'and', 'for', 'with', 'from', 'les', 'des', 'une', 'pour', 'avec', 'dans', 'las', 'los', 'por', 'para', 'con', 'una', 'das', 'dos', 'uma', 'com', 'der', 'die', 'und', 'mit', 'für', 'для',
])

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ListingsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ category?: string; showForm?: string; q?: string; listing?: string; country?: string; city?: string; page?: string }>
}) {
  const { locale } = await params
  const { category: rawCategory, showForm, q: rawQuery, listing: sharedListingId, country: rawCountry, city: rawCity, page: rawPage } = await searchParams
  // Pagina degli annunci (30 per volta invece di tutti insieme)
  const page = Math.min(Math.max(parseInt(rawPage ?? '1', 10) || 1, 1), 1000)
  const t = await getTranslations('marketplace')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Link condiviso di un annuncio: dopo l'accesso si torna all'annuncio
    const next = sharedListingId ? `?next=${encodeURIComponent(`/marketplace/listings?listing=${sharedListingId}`)}` : ''
    redirect(`/${locale}/login${next}`)
  }

  const category = ALL_LISTING_CATEGORIES.includes(rawCategory as ListingCategory) ? (rawCategory as ListingCategory) : undefined
  const query = cleanListingSearch(rawQuery)
  const getCategoryLabel = (cat: ListingCategory) => t(CATEGORY_I18N_KEYS[cat] || 'catServizi')

  const { data: profile } = await supabase.rpc('get_my_profile').maybeSingle<{ daily_points: number | null; network_points: number | null; first_name: string | null; last_name: string | null; country_code: string | null }>()

  // Dove: di partenza la nazione del profilo; ?country=all per tutti i paesi
  const profileCountry = (profile?.country_code ?? '').trim().toUpperCase()
  const defaultCountry = isListingCountry(profileCountry) ? profileCountry : ''
  const requestedCountry = (rawCountry ?? '').toUpperCase()
  const country = requestedCountry === 'ALL' ? '' : isListingCountry(requestedCountry) ? requestedCountry : rawCountry ? '' : defaultCountry
  const city = cleanListingCity(rawCity) ?? ''

  // Una condizione per parola (max 5); ogni parola trova anche le categorie
  // per nome (es. "animali")
  const search = {
    terms: query
      .split(' ')
      .filter((word) => word.length > 2 && !SEARCH_STOPWORDS.has(word.toLowerCase()))
      .slice(0, 5)
      // Parole di 5+ lettere senza la vocale finale: "informatica" trova anche
      // "informatico", "bicicletta" anche "biciclette"
      .map((word) => (word.length >= 5 ? word.replace(/[aeiouàèéìòù]$/i, '') : word))
      .map((word) => ({
        word,
        categories: ALL_LISTING_CATEGORIES.filter((cat) => getCategoryLabel(cat).toLowerCase().includes(word.toLowerCase())),
      })),
    country: country || undefined,
    city: city || undefined,
  }

  const { data: showcaseSettings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['listing_feature_cost_7d', 'listing_feature_cost_15d'])
  const parseSetting = (key: string, fallback: number) => {
    const raw = showcaseSettings?.find((s) => s.key === key)?.value
    if (!raw) return fallback
    const parsed = parseInt(JSON.parse(raw), 10)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const featureCost7d = parseSetting('listing_feature_cost_7d', 20)
  const featureCost15d = parseSetting('listing_feature_cost_15d', 35)

  // Vetrina pagabile anche in KU, se attivata in Gestione KU.
  const { data: kuShowcase } = await supabase.from('ku_features').select('enabled, config').eq('key', 'showcase').maybeSingle()
  const kuCosts = kuShowcase?.enabled
    ? {
        cost7d: Number((kuShowcase.config as { cost_7d?: number }).cost_7d ?? 0),
        cost15d: Number((kuShowcase.config as { cost_15d?: number }).cost_15d ?? 0),
      }
    : null

  const [pageListings, featuredListings, categoryCounts, sharedListing, citiesByCountry, unreadCount] = await Promise.all([
    getActiveListings({ category, excludeFeatured: true, page, ...search }),
    getFeaturedListings({ category, ...search }),
    getActiveListingCategoryCounts(search),
    sharedListingId ? getActiveListingById(sharedListingId) : Promise.resolve(null),
    getListingCitiesByCountry(),
    getUnreadMessagesCount(user.id),
  ])
  const countryOptions = [...LISTING_COUNTRIES]
    .map((code) => ({ value: code, label: countryName(code, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))

  const myListings = await getUserListings(user.id)
  const now = new Date().getTime()

  // Si chiede un annuncio in più del necessario solo per sapere se c'è
  // una pagina successiva.
  const hasNextPage = pageListings.length > LISTINGS_PAGE_SIZE
  const allListings = pageListings.slice(0, LISTINGS_PAGE_SIZE)
  // Totale dai conteggi per categoria (vetrina inclusa), senza rileggere
  // tutti gli annunci.
  const totalActiveListings = category
    ? (categoryCounts[category] ?? 0)
    : Object.values(categoryCounts).reduce((sum, n) => sum + n, 0)
  const pageHref = (target: number) => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (query) params.set('q', query)
    if (rawCountry) params.set('country', rawCountry)
    if (city) params.set('city', city)
    if (target > 1) params.set('page', String(target))
    const qs = params.toString()
    return `/marketplace/listings${qs ? `?${qs}` : ''}`
  }
  const cardLabels = { showcase: t('showcaseBadge'), mine: t('myListing'), view: t('viewListing'), remote: t('listingRemoteShort') }
  const euro = (value: number | string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value))

  const online = await isToolOnline('listings')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" />
            {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">{t('listings')}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {!online && <SuspendedBanner className="mb-6" />}
        {/* Intestazione: punti, nuovo annuncio, come funziona */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h1 className="text-3xl font-bold sm:text-4xl">{t('listings')}</h1>
              <p className="mt-2 text-white/70">{t('listingsDescription')}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-white/50">{t('myPoints').replace(':', '')}</p>
                  <p className="flex items-center gap-1.5 text-2xl font-bold text-[var(--gold-bright)]">
                    <Coins className="h-5 w-5" /> {profile?.daily_points || 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-white/50">{t('myNetworkPoints').replace(':', '')}</p>
                  <p className="flex items-center gap-1.5 text-2xl font-bold text-[var(--gold-bright)]">
                    <Sparkles className="h-5 w-5" /> {profile?.network_points || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 self-start lg:self-center">
              <Link
                href="/marketplace/listings?showForm=true"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
              >
                <Plus className="h-5 w-5" />
                {t('newListing')}
              </Link>
              {/* Messaggi ricevuti e inviati per gli annunci */}
              <Link
                href="/marketplace/chat"
                className="relative inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-6 py-3.5 font-bold text-white transition-all hover:bg-white/10"
              >
                <MessageCircle className="h-5 w-5 text-[var(--gold-bright)]" />
                {t('listingsMyMessages')}
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white ring-2 ring-[var(--ink)]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
          <details className="group relative mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-white">
              <Info className="h-4 w-4 text-[var(--gold-bright)]" />
              {t('listingsHowItWorks')}
              <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="mt-3 space-y-2">
              <li className="flex gap-2">
                <Coins className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" /> {t('listingCostDesc')}
              </li>
              <li className="flex gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" /> {t('listingValidityNotice')}
              </li>
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" /> {t('networkPointsForShowcaseHint')}
              </li>
            </ul>
          </details>
        </div>

        {/* Form Creazione (se richiesto) */}
        {showForm === 'true' && (
          <ListingForm
            userId={user.id}
            currentPoints={profile?.daily_points || 0}
            onCloseUrl="/marketplace/listings"
            networkPoints={profile?.network_points || 0}
            featureCost7d={featureCost7d}
            featureCost15d={featureCost15d}
            defaultCountry={defaultCountry}
            citiesByCountry={citiesByCountry}
          />
        )}

        {/* Ricerca: cosa, categoria e dove (nazione + città) */}
        <ListingsFilters
          categories={ALL_LISTING_CATEGORIES.map((cat) => ({
            value: cat,
            label: getCategoryLabel(cat),
            icon: CATEGORY_ICONS[cat],
            count: categoryCounts[cat] ?? 0,
          }))}
          countries={countryOptions}
          citiesByCountry={citiesByCountry}
          allCategoriesLabel={t('allCategories', { count: Object.values(categoryCounts).reduce((sum, n) => sum + n, 0) })}
          allCountriesLabel={t('allCountries')}
          category={category ?? ''}
          query={query}
          country={country || 'all'}
          city={city}
          hasFilters={Boolean(category || query || city || country)}
          labels={{
            what: t('searchWhat'),
            searchPlaceholder: t('searchListingsPlaceholder'),
            category: t('filterCategory'),
            where: t('filterWhere'),
            cityPlaceholder: t('filterCityPlaceholder'),
            search: t('searchListings'),
            clear: t('clearFilters'),
          }}
        />

        {/* I Miei Annunci */}
        {myListings.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
              <Eye className="h-5 w-5 text-[var(--gold)]" />
              {t('myListings', { count: myListings.length })}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myListings.map((listing: Listing) => {
                const isExpired = new Date(listing.expires_at).getTime() < now
                const featuredUntil = listing.featured_until ? new Date(listing.featured_until) : null
                const isFeatured = featuredUntil !== null && featuredUntil.getTime() > now
                const style = CATEGORY_STYLE[listing.category as ListingCategory] ?? CATEGORY_STYLE.servizi
                return (
                  <div
                    key={listing.id}
                    className={`flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ${
                      isExpired ? 'border border-gray-200 opacity-80' : isFeatured ? 'border-2 border-[var(--gold)]' : 'border border-[var(--gold)]/30'
                    }`}
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${style.band}`} />
                    <div className="flex flex-1 flex-col p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style.chip}`}>
                          {CATEGORY_ICONS[listing.category as ListingCategory]} {getCategoryLabel(listing.category as ListingCategory)}
                        </span>
                        {isExpired ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">{t('listingUnpublished')}</span>
                        ) : isFeatured ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--gold-bright)]">
                            <Sparkles className="h-2.5 w-2.5" /> {t('showcaseBadge')}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{t('listingActive')}</span>
                        )}
                      </div>
                      <h3 className="mb-1 font-bold text-[var(--ink)]">{listing.title}</h3>
                      <p className="mb-3 line-clamp-2 text-sm text-gray-600">{listing.description}</p>
                      {listing.price && (
                        <p className="mb-2 w-fit rounded-lg bg-[var(--ink)] px-3 py-1 text-base font-bold text-[var(--gold-bright)] shadow-sm">{euro(listing.price)}</p>
                      )}
                      {isFeatured && (
                        <p className="mb-2 text-xs font-semibold text-[var(--gold)]">
                          {t('showcaseUntil', { date: featuredUntil!.toLocaleDateString(locale) })}
                        </p>
                      )}
                      <ListingDetailButton
                        listing={listing}
                        isOwn={true}
                        authorName={profile?.first_name ?? ''}
                        className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--ink)] py-2 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:bg-[var(--ink-soft)]"
                      >
                        <Eye className="h-4 w-4" /> {t('viewListing')}
                      </ListingDetailButton>
                      <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
                        <span className="text-xs text-gray-500">
                          {isExpired ? t('expiredOn') : t('expires')}: {new Date(listing.expires_at).toLocaleDateString(locale)}
                        </span>
                        <div className="flex items-center gap-3">
                          {isExpired && (
                            <form action={async () => {
                              'use server'
                              await republishListingAction(listing.id)
                            }}>
                              <button type="submit" className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800">
                                <RefreshCw className="h-3 w-3" /> {t('publish')}
                              </button>
                            </form>
                          )}
                          <EditListingButton listing={listing} />
                          <form action={async () => {
                            'use server'
                            await deleteListingAction(listing.id, user.id)
                          }}>
                            <button type="submit" className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                              <Trash2 className="h-3 w-3" /> {commonT('delete')}
                            </button>
                          </form>
                        </div>
                      </div>
                      {!isExpired && !isFeatured && (
                        <FeatureListingButton listingId={listing.id} cost7d={featureCost7d} cost15d={featureCost15d} kuCosts={kuCosts} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* In Vetrina */}
        {featuredListings.length > 0 && (
          <section className="mb-10 rounded-3xl border border-[var(--gold)]/30 bg-gradient-to-br from-[var(--gold-pale)]/70 via-white to-white p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
              <Sparkles className="h-5 w-5 text-[var(--gold)]" />
              {t('showcaseSection', { count: featuredListings.length })}
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {featuredListings.map((listing: Listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  currentUserId={user.id}
                  categoryLabel={getCategoryLabel(listing.category as ListingCategory)}
                  featured
                  labels={cardLabels}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        )}

        {/* Annunci della Community */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t('allListings', { count: totalActiveListings })}</h2>

          {allListings.length === 0 && featuredListings.length === 0 && (category || query || country || city) ? (
            <div className="rounded-3xl border-2 border-dashed border-[var(--gold)]/40 bg-white/70 p-10 text-center">
              <h3 className="mb-2 text-lg font-bold text-[var(--ink)]">{t('noListingsFound')}</h3>
              <p className="mb-5 text-gray-500">{t('noListingsFoundHint')}</p>
              <Link href="/marketplace/listings?country=all" className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-[var(--gold-bright)]">
                {t('clearFilters')}
              </Link>
            </div>
          ) : allListings.length === 0 && featuredListings.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[var(--gold)]/40 bg-white/70 p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ink)]">
                <Tag className="h-8 w-8 text-[var(--gold-bright)]" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[var(--ink)]">{t('noListingsYet')}</h3>
              <p className="mb-5 text-gray-500">{t('beFirstListing')}</p>
              <Link
                href="/marketplace/listings?showForm=true"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)]"
              >
                <Plus className="h-5 w-5" /> {t('newListing')}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {allListings.map((listing: Listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  currentUserId={user.id}
                  categoryLabel={getCategoryLabel(listing.category as ListingCategory)}
                  labels={cardLabels}
                  locale={locale}
                />
              ))}
            </div>
          )}

          {(page > 1 || hasNextPage) && (
            <nav className="mt-8 flex items-center justify-between gap-3">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="rounded-xl border border-[var(--gold)]/40 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--gold-pale)]">
                  {t('listingsPrevPage')}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-[var(--muted)]">{t('listingsPageN', { page })}</span>
              {hasNextPage ? (
                <Link href={pageHref(page + 1)} className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--gold-bright)] transition hover:bg-[var(--ink-soft)]">
                  {t('listingsNextPage')}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </main>

      <ChatModalWrapper userId={user.id} />
      <ListingDetailModalWrapper
        initial={
          sharedListing
            ? { listing: sharedListing, authorName: sharedListing.profiles?.first_name ?? '', isOwn: sharedListing.user_id === user.id }
            : undefined
        }
      />
      <EditListingModalWrapper citiesByCountry={citiesByCountry} />
    </div>
  )
}

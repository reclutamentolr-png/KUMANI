import { Sparkles, Tag } from 'lucide-react'
import ContactListingButton from '@/components/ContactListingButton'
import ListingDetailButton from '@/components/ListingDetailButton'
import ListingImageThumbnail from '@/components/ListingImageThumbnail'
import ReportListingButton from '@/components/ReportListingButton'
import { CATEGORY_ICONS, type ListingCategory } from '@/lib/listings'

// Colore di ogni categoria (fascia della scheda senza foto e filtri).
export const CATEGORY_STYLE: Record<ListingCategory, { band: string; chip: string }> = {
  veicoli: { band: 'from-sky-500 to-sky-700', chip: 'bg-sky-50 text-sky-800 border-sky-200' },
  immobili: { band: 'from-emerald-500 to-emerald-700', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  elettronica: { band: 'from-indigo-500 to-indigo-700', chip: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  moda: { band: 'from-pink-500 to-rose-600', chip: 'bg-pink-50 text-pink-800 border-pink-200' },
  casa_persona: { band: 'from-amber-500 to-orange-600', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  tempo_libero: { band: 'from-lime-500 to-green-600', chip: 'bg-lime-50 text-lime-800 border-lime-200' },
  colf_badanti: { band: 'from-teal-500 to-teal-700', chip: 'bg-teal-50 text-teal-800 border-teal-200' },
  agricoltura: { band: 'from-green-600 to-green-800', chip: 'bg-green-50 text-green-800 border-green-200' },
  animali: { band: 'from-orange-500 to-orange-700', chip: 'bg-orange-50 text-orange-800 border-orange-200' },
  lavoro: { band: 'from-slate-600 to-slate-800', chip: 'bg-slate-100 text-slate-800 border-slate-200' },
  impresa: { band: 'from-violet-500 to-violet-700', chip: 'bg-violet-50 text-violet-800 border-violet-200' },
  servizi: { band: 'from-[#c79a3b] to-[#a67c26]', chip: 'bg-[var(--gold-pale)] text-[var(--ink)] border-[var(--gold)]/40' },
}

type Listing = {
  id: string
  user_id: string
  category: ListingCategory
  title: string
  description: string
  price: number | string | null
  image_url: string | null
  created_at: string
  profiles?: { first_name?: string | null } | null
}

// Scheda di un annuncio della Bacheca: foto (o fascia colorata con l'icona
// della categoria), prezzo, titolo, autore e contatto.
export default function ListingCard({
  listing,
  currentUserId,
  categoryLabel,
  featured = false,
  labels,
  locale,
}: {
  listing: Listing
  currentUserId: string
  categoryLabel: string
  featured?: boolean
  labels: { showcase: string; mine: string }
  locale: string
}) {
  const style = CATEGORY_STYLE[listing.category] ?? CATEGORY_STYLE.servizi
  const author = listing.profiles?.first_name ?? ''
  const isOwn = listing.user_id === currentUserId

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1 ${
        featured
          ? 'border-2 border-[var(--gold)] shadow-[0_10px_30px_rgba(199,154,59,0.25)] hover:shadow-[0_16px_40px_rgba(199,154,59,0.35)]'
          : 'border border-gray-200 shadow-sm hover:border-[var(--gold)]/50 hover:shadow-lg'
      }`}
    >
      {/* Foto o fascia colorata */}
      <div className="relative">
        {listing.image_url ? (
          <div className="[&>div]:mb-0 [&>div]:h-44 [&>div]:rounded-none">
            <ListingImageThumbnail src={listing.image_url} alt={listing.title} />
          </div>
        ) : (
          <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${style.band}`}>
            <span className="text-5xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110">{CATEGORY_ICONS[listing.category]}</span>
          </div>
        )}
        {featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--gold-bright)] shadow">
            <Sparkles className="h-3 w-3" /> {labels.showcase}
          </span>
        )}
        {listing.price !== null && listing.price !== '' && (
          <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1 text-sm font-bold text-emerald-700 shadow">
            {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(listing.price))}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className={`mb-2 inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style.chip}`}>
          {CATEGORY_ICONS[listing.category]} {categoryLabel}
        </span>
        <ListingDetailButton listing={listing} isOwn={isOwn} authorName={author} className="text-left">
          <h3 className="mb-1 line-clamp-2 font-bold leading-snug text-[var(--ink)] transition-colors hover:text-[var(--gold)]">{listing.title}</h3>
        </ListingDetailButton>
        <p className="mb-4 line-clamp-3 flex-1 text-sm leading-6 text-gray-600">{listing.description}</p>

        <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink)] text-[10px] font-bold text-[var(--gold-bright)]">
            {author.charAt(0).toUpperCase() || '?'}
          </span>
          <span className="font-medium text-gray-700">{author}</span>
          <span>·</span>
          <span>{new Date(listing.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
        </div>

        {isOwn ? (
          <div className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-semibold text-emerald-700">
            <Tag className="h-4 w-4" /> {labels.mine}
          </div>
        ) : (
          <>
            <ContactListingButton
              listingId={listing.id}
              listingTitle={listing.title}
              listingCategory={listing.category}
              listingPrice={listing.price === null || listing.price === '' ? undefined : Number(listing.price)}
              listingDescription={listing.description}
              receiverId={listing.user_id}
              authorName={author}
            />
            <ReportListingButton listingId={listing.id} />
          </>
        )}
      </div>
    </article>
  )
}

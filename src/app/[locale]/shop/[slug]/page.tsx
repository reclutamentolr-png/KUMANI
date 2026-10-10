import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Mail, MapPin, Phone } from 'lucide-react'
import ShopFront from '@/components/shop/ShopFront'
import { loadPublicShop, releaseShopReservation } from '@/lib/shopServer'

// Negozio pubblico del professionista (KUMANI Shop): si compra anche senza
// essere iscritti. Il venditore è chi gestisce il negozio; KUMANI fornisce
// la piattaforma.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPublicShop(slug)
  if (!shop) return { title: 'KUMANI Shop', robots: { index: false, follow: false } }
  const description = shop.settings.description || shop.seller.name
  return {
    title: { absolute: `${shop.settings.name} · KUMANI Shop` },
    description,
    openGraph: { title: shop.settings.name, description, type: 'website', siteName: 'KUMANI', ...(shop.coverUrl ? { images: [shop.coverUrl] } : {}) },
  }
}

export default async function PublicShopPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const [{ locale, slug }, { cancelled }] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const t = await getTranslations('shopPublic')
  // Ritorno dal pagamento senza pagare: i pezzi prenotati tornano liberi
  if (cancelled && cancelled !== '1') await releaseShopReservation(cancelled)
  const shop = await loadPublicShop(slug)
  if (!shop) notFound()
  const { settings, seller } = shop

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <header className="relative overflow-hidden bg-[var(--ink)] text-white">
        {shop.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        )}
        <div className="relative mx-auto flex max-w-4xl items-center gap-4 px-4 py-8">
          {seller.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-white object-contain p-1.5" />
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">{settings.name}</h1>
            {settings.description && <p className="mt-1 max-w-2xl whitespace-pre-wrap text-white/85">{settings.description}</p>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        {cancelled && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{t('cancelled')}</p>}
        <ShopFront settings={settings} products={shop.products} sellerName={seller.name} />
        <footer className="mt-10 space-y-1 border-t border-[var(--gold)]/20 pt-5 text-sm text-gray-600">
          <p className="font-semibold text-[var(--ink)]">
            {t('soldBy', { seller: seller.name })}
            {seller.vat ? ` · ${t('vat', { vat: seller.vat })}` : ''}
          </p>
          {seller.address && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" /> {seller.address}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {seller.email && (
              <a href={`mailto:${seller.email}`} className="inline-flex items-center gap-2 underline">
                <Mail className="h-4 w-4" /> {seller.email}
              </a>
            )}
            {seller.phone && (
              <a href={`tel:${seller.phone}`} className="inline-flex items-center gap-2 underline">
                <Phone className="h-4 w-4" /> {seller.phone}
              </a>
            )}
          </p>
          <p className="pt-2 text-xs text-gray-500">{t('platformNote')}</p>
        </footer>
      </main>
    </div>
  )
}

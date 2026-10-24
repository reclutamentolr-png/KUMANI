import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { CalendarCheck, MapPin, Phone } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import TempusBooking from '@/components/tempus/TempusBooking'
import { createClient } from '@/lib/supabase/server'
import { loadTempusForViewer } from '@/lib/tempus-server'
import { CANONICAL_ORIGIN } from '@/lib/seo'
import { phoneDigits } from '@/lib/tempus'

// Orari liberi che cambiano di continuo: sempre calcolata a ogni richiesta
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

async function viewerId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

// Pagina di prenotazione di un'attività: kumani.io/prenota/<indirizzo>.
// Fuori dai motori di ricerca (si arriva dal link o dal QR dell'attività).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { user } = await viewerId()
  const found = await loadTempusForViewer(slug, user?.id ?? null)
  const t = await getTranslations('tempus')
  if (!found) return { title: { absolute: 'KUMANI TEMPUS' }, robots: { index: false, follow: false } }
  const name = found.page.displayName
  const description = found.page.settings.intro.slice(0, 160) || t('publicMetaDescription', { business: name })
  const url = `${CANONICAL_ORIGIN}/prenota/${found.page.settings.slug}`
  return {
    title: { absolute: t('publicMetaTitle', { business: name }) },
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: false, nocache: true },
    openGraph: { type: 'website', url, title: t('publicMetaTitle', { business: name }), description, siteName: name },
  }
}

export default async function TempusPublicPage({ params }: Props) {
  const { slug } = await params
  const { supabase, user } = await viewerId()
  const found = await loadTempusForViewer(slug, user?.id ?? null)
  if (!found) notFound()
  const { page, preview } = found
  const [t, locale] = await Promise.all([getTranslations('tempus'), getLocale()])
  const { business, settings } = page

  // Chi ha un account KUMANI trova già nome ed email
  let prefill = { name: '', email: '' }
  if (user && !preview) {
    const { data: me } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle()
    prefill = { name: [me?.first_name, me?.last_name].filter(Boolean).join(' '), email: user.email ?? '' }
  }
  const phone = business.phone || business.whatsapp

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {preview && (
        <div className="bg-amber-100 px-4 py-3 text-center text-sm font-semibold text-amber-900">
          {settings.suspended ? t('previewSuspended') : t('previewBanner')}
        </div>
      )}
      <header className="bg-[var(--ink)] text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-6 sm:px-6">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-white object-contain p-1" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--gold)]/15">
              <CalendarCheck className="h-8 w-8 text-[var(--gold-bright)]" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold-bright)]">{t('publicKicker')}</p>
            <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{page.displayName}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/75">
              {business.address && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                  <MapPin className="h-4 w-4" /> {business.address}
                </a>
              )}
              {phone && (
                <a href={`tel:${phoneDigits(phone)}`} className="inline-flex items-center gap-1 hover:text-white">
                  <Phone className="h-4 w-4" /> {phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {settings.intro && <p className="mb-6 whitespace-pre-line rounded-3xl border border-[var(--gold)]/25 bg-white p-5 text-[var(--ink)]">{settings.intro}</p>}
        <TempusBooking
          slug={settings.slug}
          businessName={page.displayName}
          address={business.address}
          timezone={settings.timezone}
          showPrices={settings.show_prices}
          cancelLimitHours={settings.cancel_limit_hours}
          services={page.services}
          preview={preview}
          prefill={prefill}
          locale={locale}
        />
        <p className="mt-10 text-center text-xs text-[var(--muted)]">
          {t('poweredBy')}{' '}
          <Link href="/" className="font-semibold text-[var(--ink)] hover:underline">
            KUMANI TEMPUS
          </Link>
        </p>
      </main>
    </div>
  )
}

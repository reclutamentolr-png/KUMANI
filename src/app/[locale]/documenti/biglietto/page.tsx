import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, IdCard } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/siteUrl'
import { defaultLocale } from '../../../../../i18n'
import BusinessCardEditor from '@/components/businessCard/BusinessCardEditor'
import BusinessCardChooser from '@/components/businessCard/BusinessCardChooser'
import ClassicCardEditor from '@/components/businessCard/ClassicCardEditor'
import NfcTagSection from '@/components/NfcTagSection'
import type { BusinessCardSettings } from '@/app/actions/businessCard'
import { cleanClassic, type ClassicSource } from '@/lib/businessCardClassic'
import { getMyBusinessProfile } from '@/lib/businessProfile-server'
import { businessFullAddress, businessWebsiteUrl } from '@/lib/businessProfile'
import { getBrandFor } from '@/lib/brand-server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('businessCard')
  return { title: t('title') }
}

// Il mio biglietto da visita (Documenti → Doc Personali)
export default async function BusinessCardPage() {
  const locale = await getLocale()
  const t = await getTranslations('businessCard')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  type MyProfile = { referral_code: string | null; phone: string | null; email: string | null; first_name: string | null; last_name: string | null; occupation: string | null }
  type Card = BusinessCardSettings & { kind: 'kumani' | 'classic' | null; classic: unknown }
  const [{ data: profile }, { data: card }, business, brand, { data: bio }] = await Promise.all([
    supabase.rpc('get_my_profile').maybeSingle<MyProfile>(),
    supabase.from('business_cards').select('design, show_phone, show_whatsapp, show_email, kind, classic').eq('user_id', user.id).maybeSingle<Card>(),
    getMyBusinessProfile(supabase, user.id),
    getBrandFor(supabase, user.id),
    supabase.from('link_in_bio').select('slug').eq('user_id', user.id).eq('mode', 'personal').maybeSingle<{ slug: string | null }>(),
  ])
  const code = profile?.referral_code
  // La pagina del QR esiste solo per chi ha il biglietto: alla prima apertura
  // si crea con le impostazioni di partenza (contatti nascosti)
  if (code && !card) await supabase.from('business_cards').insert({ user_id: user.id }).then(() => {})
  // Il QR porta sempre al dominio pubblico (mai a localhost)
  const site = /localhost|127\.0\.0\.1/.test(SITE_URL) ? 'https://kumani.io' : SITE_URL
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const cardPath = code ? `/c/${encodeURIComponent(code)}` : null

  // Biglietto classico: dati di partenza da profilo e Scheda attività
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const website = text(business.website)
  const source: ClassicSource = {
    name: [text(profile?.first_name), text(profile?.last_name)].filter(Boolean).join(' '),
    role: text(profile?.occupation),
    company: text(business.companyName),
    phone: text(business.phone) || text(profile?.phone),
    mobile: text(business.whatsapp),
    email: text(business.email) || text(profile?.email) || user.email || '',
    website: website.replace(/^https?:\/\//i, '').replace(/\/$/, ''),
    address: businessFullAddress(business),
    vat: text(business.vatNumber),
    social: Object.values(business.socials).map(text).find(Boolean) ?? '',
  }
  const bioUrl = bio?.slug ? `${site}/bio/${bio.slug}` : code ? `${site}${prefix}/ref/${encodeURIComponent(code)}/bio` : ''

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/documenti?tab=personali" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)] shrink-0">
            <ArrowLeft className="h-5 w-5" /> {t('back')}
          </Link>
          <span className="flex items-center gap-2 font-semibold tracking-wide min-w-0 text-right leading-tight">
            <IdCard className="h-5 w-5 text-[var(--gold-bright)] shrink-0" /> {t('title')}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="mb-6 text-[var(--muted)]">{t('intro')}</p>
        {cardPath ? (
          <>
            <BusinessCardChooser
              initial={card?.kind === 'classic' ? 'classic' : 'kumani'}
              kumani={
                <BusinessCardEditor
                  cardUrl={`${site}${prefix}${cardPath}`}
                  cardPath={cardPath}
                  initial={{ design: card?.design ?? 'A', show_phone: card?.show_phone ?? false, show_whatsapp: card?.show_whatsapp ?? false, show_email: card?.show_email ?? false }}
                  hasPhone={Boolean(profile?.phone?.trim())}
                  hasEmail={Boolean(profile?.email?.trim())}
                />
              }
              classic={
                <ClassicCardEditor
                  initial={cleanClassic(card?.classic)}
                  source={source}
                  brand={brand.colors}
                  businessLogo={business.logoUrl}
                  urls={{ card: `${site}${prefix}${cardPath}`, bio: bioUrl, website: website ? businessWebsiteUrl(website) : null }}
                />
              }
            />
            {/* Biglietto NFC: stesso link del QR, per tutti e due i biglietti */}
            <NfcTagSection kind="card" url={`${site}${prefix}${cardPath}`} />
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-6 text-[var(--muted)]">{t('noCode')}</p>
        )}
      </main>
    </div>
  )
}

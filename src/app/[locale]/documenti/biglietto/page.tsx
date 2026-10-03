import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, IdCard } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/siteUrl'
import { defaultLocale } from '../../../../../i18n'
import BusinessCardEditor from '@/components/businessCard/BusinessCardEditor'
import type { BusinessCardSettings } from '@/app/actions/businessCard'

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

  const [{ data: profile }, { data: card }] = await Promise.all([
    supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null; phone: string | null; email: string | null }>(),
    supabase.from('business_cards').select('design, show_phone, show_whatsapp, show_email').eq('user_id', user.id).maybeSingle<BusinessCardSettings>(),
  ])
  const code = profile?.referral_code
  // La pagina del QR esiste solo per chi ha il biglietto: alla prima apertura
  // si crea con le impostazioni di partenza (contatti nascosti)
  if (code && !card) await supabase.from('business_cards').insert({ user_id: user.id }).then(() => {})
  // Il QR porta sempre al dominio pubblico (mai a localhost)
  const site = /localhost|127\.0\.0\.1/.test(SITE_URL) ? 'https://kumani.io' : SITE_URL
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const cardPath = code ? `/c/${encodeURIComponent(code)}` : null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/documenti?tab=personali" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('back')}
          </Link>
          <span className="flex items-center gap-2 font-semibold tracking-wide">
            <IdCard className="h-5 w-5 text-[var(--gold-bright)]" /> {t('title')}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <p className="mb-6 text-[var(--muted)]">{t('intro')}</p>
        {cardPath ? (
          <BusinessCardEditor
            cardUrl={`${site}${prefix}${cardPath}`}
            cardPath={cardPath}
            initial={{ design: card?.design ?? 'A', show_phone: card?.show_phone ?? false, show_whatsapp: card?.show_whatsapp ?? false, show_email: card?.show_email ?? false }}
            hasPhone={Boolean(profile?.phone?.trim())}
            hasEmail={Boolean(profile?.email?.trim())}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-6 text-[var(--muted)]">{t('noCode')}</p>
        )}
      </main>
    </div>
  )
}

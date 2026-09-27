import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, Building2 } from 'lucide-react'
import { hasActivePreventiviAccess } from '@/lib/quotes-server'
import QuoteBusinessProfileForm from '@/components/QuoteBusinessProfileForm'

export default async function QuoteBusinessProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const t = await getTranslations('preventivi')
  const { from } = await searchParams
  const backSuffix = from === 'dashboard' ? '?from=dashboard' : ''

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActivePreventiviAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/marketplace')
  }

  const { data: profile } = await supabase
    .from('quote_issuer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const logoUrl = profile?.logo_path
    ? supabase.storage.from('quote-logos-v2').getPublicUrl(profile.logo_path).data.publicUrl
    : null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href={`/marketplace/preventivi${backSuffix}`}
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <Building2 className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('businessProfileTitle')}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <p className="text-[var(--muted)] mb-6">{t('businessProfileDescription')}</p>
        <QuoteBusinessProfileForm
          initialProfile={{
            companyName: profile?.company_name || '',
            vatNumber: profile?.vat_number || '',
            address: profile?.address || '',
            city: profile?.city || '',
            postalCode: profile?.postal_code || '',
            province: profile?.province || '',
            pec: profile?.pec || '',
            email: profile?.email || '',
            phone: profile?.phone || '',
          }}
          initialLogoUrl={logoUrl}
        />
      </main>
    </div>
  )
}

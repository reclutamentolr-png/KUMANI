import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Palette } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AppHeader from '@/components/nav/AppHeader'
import BrandWizard from '@/components/businessProfile/BrandWizard'
import { getBrand } from '@/app/actions/brand'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'brand' })
  return { title: t('title') }
}

// «I colori del tuo brand» (Scheda attività, piani Plus e Pro)
export default async function BrandColorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login?next=/scheda-attivita/colori`)

  const [t, tb, supabase] = await Promise.all([getTranslations('brand'), getTranslations('businessProfile'), createClient()])
  const [{ data: proAccess }, { data: baseAccess }, brand] = await Promise.all([
    supabase.rpc('can_use_tool', { p_tool: 'preventivi' }).maybeSingle<{ allowed: boolean }>(),
    supabase.rpc('can_use_tool', { p_tool: 'link-in-bio' }).maybeSingle<{ allowed: boolean }>(),
    getBrand(),
  ])
  const allowed = !!proAccess?.allowed || !!baseAccess?.allowed

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('title')} subtitle={t('subtitle')} icon={<Palette className="h-6 w-6" />} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
        <Link href="/scheda-attivita" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-4 w-4" /> {tb('title')}
        </Link>
        <p className="text-[var(--muted)]">{t('intro')}</p>
        {allowed && brand ? (
          <BrandWizard initial={brand} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] p-5 text-[var(--ink)]">
            <span>{tb('planRequired')}</span>
            <Link href="/pro" className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">
              {tb('planCta')}
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

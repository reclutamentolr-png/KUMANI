import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { defaultLocale } from '../../../../../../i18n'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { loadHome } from '@/lib/casa-server'
import { CASA_TABS, type CasaTab } from '@/lib/casa'
import { todayKey } from '@/lib/agenda'
import HomeDetail from '@/components/casa/HomeDetail'

export const dynamic = 'force-dynamic'

export default async function HomePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams])
  const t = await getTranslations('casa')
  const [supabase, locale] = await Promise.all([createClient(), getLocale()])
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [data, spendlyAvailable, findoAvailable] = await Promise.all([
    loadHome(supabase, user!.id, id),
    hasActiveToolAccess(supabase, user!.id, 'spendly'),
    hasActiveToolAccess(supabase, user!.id, 'findo'),
  ])
  // Eliminato (anche da un'altra finestra): si torna all'elenco, non alla 404
  if (!data) redirect(`${locale === defaultLocale ? '' : `/${locale}`}/marketplace/casa`)
  const initialTab = (CASA_TABS as readonly string[]).includes(tab ?? '') ? (tab as CasaTab) : 'deadlines'

  return (
    <div className="space-y-5">
      <Link href="/marketplace/casa" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> {t('backToCasa')}
      </Link>
      <HomeDetail {...data} today={todayKey()} spendlyAvailable={spendlyAvailable} findoAvailable={findoAvailable} initialTab={initialTab} />
    </div>
  )
}

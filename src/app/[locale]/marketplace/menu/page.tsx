import { SITE_URL } from '@/lib/siteUrl'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, UtensilsCrossed } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import MenuBuilder from '@/components/menu/MenuBuilder'
import { createClient } from '@/lib/supabase/server'
import { loadMenuData } from '@/lib/menu-server'
import { getMyBusinessProfile } from '@/lib/businessProfile-server'

// KUMANI Menu — builder del ristoratore (strumento Pro: l'accesso lo
// controlla il middleware con can_use_tool, e ogni azione lo ricontrolla).
export default async function MenuBuilderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('menuBuilder')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [data, businessProfile, { data: inventoryAccess }] = await Promise.all([
    loadMenuData(supabase, user.id),
    getMyBusinessProfile(supabase, user.id),
    supabase.rpc('can_use_tool', { p_tool: 'magazzino' }).maybeSingle<{ allowed: boolean }>(),
  ])
  // Prodotti del Magazzino da collegare ai piatti (solo se il Magazzino è nel piano)
  const { data: inventoryRows } = inventoryAccess?.allowed
    ? await supabase
        .from('inventory_products')
        .select('id, name, stock, unit')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('name')
        .limit(500)
    : { data: null }
  const inventoryProducts = (inventoryRows ?? []).map((p) => ({ id: p.id as string, name: p.name as string, stock: Number(p.stock), unit: (p.unit as string | null) ?? '' }))

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">KUMANI Menu</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-center text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold)]/15 text-[var(--gold-bright)]">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">KUMANI Menu</h1>
            <p className="mt-2 text-white/70">{t('subtitle')}</p>
          </div>
        </div>
        <MenuBuilder initial={data} siteUrl={SITE_URL} locale={locale} businessProfile={businessProfile} inventoryProducts={inventoryProducts} />
      </main>
    </div>
  )
}

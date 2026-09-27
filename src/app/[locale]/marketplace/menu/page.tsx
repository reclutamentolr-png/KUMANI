import { SITE_URL } from '@/lib/siteUrl'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, UtensilsCrossed } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import MenuBuilder from '@/components/menu/MenuBuilder'
import { createClient } from '@/lib/supabase/server'
import { loadMenuData } from '@/lib/menu-server'

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

  const data = await loadMenuData(supabase, user.id)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
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
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--ink)] sm:text-4xl">KUMANI Menu</h1>
          <p className="mt-2 text-[var(--muted)]">{t('subtitle')}</p>
        </div>
        <MenuBuilder initial={data} siteUrl={SITE_URL} locale={locale} />
      </main>
    </div>
  )
}

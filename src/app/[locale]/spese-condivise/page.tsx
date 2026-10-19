import { redirect } from 'next/navigation'
import ToolBackLink from '@/components/ToolBackLink'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Users } from 'lucide-react'
import SharedHome from '@/components/spendlyShared/SharedHome'
import { createClient } from '@/lib/supabase/server'
import type { SharedGroupSummary } from '@/lib/spendlyShared'
import HubBar from '@/components/hubs/HubBar'

// Spendly · Spese condivise: i miei gruppi (casa, coppia, coinquilini).
// Fuori da /marketplace di proposito, come Travel: chi viene invitato entra
// anche senza abbonamento; solo creare un gruppo richiede Spendly.
export const dynamic = 'force-dynamic'

export default async function SharedExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ codice?: string }>
}) {
  const { locale } = await params
  const { codice } = await searchParams
  const code = (codice ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase()
  const t = await getTranslations('spendlyShared')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/spese-condivise${code ? `?codice=${code}` : ''}`)}`)

  const [{ data: groups }, { data: access }, { data: preview }] = await Promise.all([
    supabase.rpc('spendly_group_list'),
    supabase.rpc('can_use_tool', { p_tool: 'spendly' }).maybeSingle<{ allowed: boolean }>(),
    code ? supabase.rpc('spendly_group_preview', { p_code: code }) : Promise.resolve({ data: null }),
  ])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 gap-3">
          <ToolBackLink className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)] shrink-0" label={<><ArrowLeft className="h-5 w-5" /> {commonT('backToServices')}</>} />
          <span className="flex items-center gap-2 font-semibold min-w-0 text-right leading-tight">
            <Users className="h-5 w-5 text-[var(--gold-bright)] shrink-0" /> {t('title')}
          </span>
        </div>
      </header>
      <HubBar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">{t('title')}</h1>
          <p className="mt-2 text-lg font-semibold text-[var(--gold)]">{t('tagline')}</p>
          <p className="mt-2 text-[var(--muted)]">{t('intro')}</p>
        </div>
        <SharedHome
          groups={(groups ?? []) as SharedGroupSummary[]}
          canCreate={!!access?.allowed}
          code={code}
          preview={preview as { name: string; emoji: string; creator_name: string; members: number; is_member: boolean } | null}
        />
      </main>
    </div>
  )
}

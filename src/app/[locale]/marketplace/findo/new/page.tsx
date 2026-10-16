import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, PackageSearch } from 'lucide-react'
import { hasActiveFindoAccess } from '@/lib/findo-server'
import type { FindoLocation } from '@/lib/findo'
import FindoItemForm from '@/components/FindoItemForm'
import HubBar from '@/components/hubs/HubBar'

export default async function NewFindoItemPage() {
  const t = await getTranslations('findo')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const hasAccess = await hasActiveFindoAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${await getLocale()}/dashboard`)
  }

  const { data: locations } = await supabase
    .from('findo_locations')
    .select('id, parent_id, name, icon')
    .eq('user_id', user.id)
    .returns<FindoLocation[]>()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-3">
          <Link
            href="/marketplace/findo"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)] shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide min-w-0 text-right leading-tight">
            <PackageSearch className="h-5 w-5 text-[var(--gold-bright)] shrink-0" />
            {t('newItem')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <FindoItemForm mode="create" locations={locations || []} />
      </main>
    </div>
  )
}

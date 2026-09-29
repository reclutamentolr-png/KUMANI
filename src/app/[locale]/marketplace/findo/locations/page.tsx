import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, MapPin } from 'lucide-react'
import { hasActiveFindoAccess } from '@/lib/findo-server'
import type { FindoLocation } from '@/lib/findo'
import FindoLocationTree from '@/components/FindoLocationTree'

export default async function FindoLocationsPage() {
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/marketplace/findo"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <MapPin className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('manageLocations')}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <p className="text-[var(--muted)] text-sm mb-6">{t('locationsHelp')}</p>
        <FindoLocationTree locations={locations || []} />
      </main>
    </div>
  )
}

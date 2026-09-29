import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import ToolBackLink from '@/components/ToolBackLink'
import { ArrowLeft, PackageSearch, Sparkles, PlusCircle } from 'lucide-react'
import { hasActiveFindoAccess } from '@/lib/findo-server'
import { buildBreadcrumb, type FindoLocation } from '@/lib/findo'
import FindoDashboard from '@/components/FindoDashboard'

export default async function FindoPage() {
  const t = await getTranslations('findo')
  const commonT = await getTranslations('common')

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

  const allLocations = locations || []

  interface ItemRow {
    id: string
    name: string
    category: string | null
    tags: string[]
    is_favorite: boolean
    photo_path: string | null
    location_id: string | null
  }

  const { data: itemsRaw } = await supabase
    .from('findo_items')
    .select('id, name, category, tags, is_favorite, photo_path, location_id')
    .eq('user_id', user.id)
    .returns<ItemRow[]>()

  // One batched request for every photo instead of a separate
  // createSignedUrl call per item (which used to fire N Storage API
  // requests per page load).
  const photoPaths = (itemsRaw || [])
    .map((item) => item.photo_path)
    .filter((path): path is string => !!path)

  const signedUrlByPath: Record<string, string> = {}
  if (photoPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from('findo-photos')
      .createSignedUrls(photoPaths, 3600)
    signedUrls?.forEach((s) => {
      if (s.path && s.signedUrl) signedUrlByPath[s.path] = s.signedUrl
    })
  }

  const items = (itemsRaw || []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    tags: item.tags || [],
    is_favorite: item.is_favorite,
    photo_url: item.photo_path ? (signedUrlByPath[item.photo_path] ?? null) : null,
    location_breadcrumb: buildBreadcrumb(item.location_id, allLocations),
  }))

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <PackageSearch className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 bg-[var(--gold)]/15 text-[var(--gold-bright)] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                {t('badge')}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t('heroTitle')}</h2>
              <p className="text-white/70 text-base sm:text-lg">{t('heroDescription')}</p>
            </div>
            <Link
              href="/marketplace/findo/new"
              className="flex shrink-0 items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all"
            >
              <PlusCircle className="w-5 h-5" />
              {t('newItem')}
            </Link>
          </div>
        </div>

        <FindoDashboard items={items} />
      </main>
    </div>
  )
}

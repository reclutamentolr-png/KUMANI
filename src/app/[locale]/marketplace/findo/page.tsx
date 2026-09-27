import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import ToolBackLink from '@/components/ToolBackLink'
import { ArrowLeft, PackageSearch, Sparkles } from 'lucide-react'
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
    redirect(`/${await getLocale()}/marketplace`)
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <ToolBackLink
            className="flex items-center gap-2 text-gray-600 hover:text-amber-600 font-medium transition-colors"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <PackageSearch className="h-5 w-5 text-amber-600" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            {t('badge')}
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-3">{t('heroTitle')}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">{t('heroDescription')}</p>
        </div>

        <FindoDashboard items={items} />
      </main>
    </div>
  )
}

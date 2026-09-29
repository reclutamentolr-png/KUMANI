import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, History } from 'lucide-react'
import { hasActiveFindoAccess } from '@/lib/findo-server'
import type { FindoLocation, FindoItemFormData } from '@/lib/findo'
import FindoItemForm from '@/components/FindoItemForm'
import FindoMovePanel from '@/components/FindoMovePanel'
import FindoDeleteButton from '@/components/FindoDeleteButton'

export default async function FindoItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: item } = await supabase
    .from('findo_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!item) notFound()

  let photoUrl: string | null = null
  if (item.photo_path) {
    const { data: signed } = await supabase.storage.from('findo-photos').createSignedUrl(item.photo_path, 3600)
    photoUrl = signed?.signedUrl ?? null
  }

  const { data: locations } = await supabase
    .from('findo_locations')
    .select('id, parent_id, name, icon')
    .eq('user_id', user.id)
    .returns<FindoLocation[]>()

  const { data: moves } = await supabase
    .from('findo_item_moves')
    .select('id, moved_at, previous_location_path, new_location_path')
    .eq('item_id', id)
    .order('moved_at', { ascending: false })

  const initial: FindoItemFormData = {
    name: item.name,
    locationId: item.location_id,
    category: item.category || '',
    tags: item.tags || [],
  }

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
          <h1 className="font-semibold tracking-wide truncate max-w-[50%] sm:max-w-xs">{item.name}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <FindoItemForm
          mode="edit"
          id={item.id}
          locations={locations || []}
          initial={initial}
          initialPhotoUrl={photoUrl}
        />

        <FindoMovePanel itemId={item.id} currentLocationId={item.location_id} locations={locations || []} />

        {moves && moves.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)] mb-4">
              <History className="w-5 h-5 text-[var(--gold)]" />
              {t('history')}
            </h3>
            <div className="space-y-2">
              {moves.map((move) => (
                <div key={move.id} className="flex flex-col gap-0.5 text-sm border-b border-[var(--gold)]/15 pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-[var(--muted)] shrink-0">{new Date(move.moved_at).toLocaleDateString()}</span>
                  <span className="text-[var(--ink)] sm:text-right">
                    {move.previous_location_path || t('noLocation')} → {move.new_location_path || t('noLocation')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <FindoDeleteButton id={item.id} />
      </main>
    </div>
  )
}

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import HomeFormView from '@/components/casa/HomeFormView'
import type { CasaHome } from '@/lib/casa'

export const dynamic = 'force-dynamic'

export default async function EditHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('casa')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: home } = await supabase.from('casa_homes').select('id, name, kind, address, notes, created_at').eq('id', id).eq('user_id', user!.id).maybeSingle<CasaHome>()
  if (!home) notFound()

  return (
    <div className="space-y-5">
      <Link href={`/marketplace/casa/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> {home.name}
      </Link>
      <h1 className="text-2xl font-bold text-[var(--ink)]">{t('editHomeTitle')}</h1>
      <HomeFormView home={home} />
    </div>
  )
}

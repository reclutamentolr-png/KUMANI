import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import SurpriseExperience from '@/components/surprise/SurpriseExperience'
import { createClient } from '@/lib/supabase/server'
import { buildSurpriseView, STEP_SELECT } from '@/lib/surpriseServer'
import type { SurpriseRow, SurpriseStepRow } from '@/lib/surprise'

// Anteprima per chi crea: tutto aperto, come se il tempo fosse già passato
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function SurprisePreviewPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`${locale === 'it' ? '' : `/${locale}`}/login?next=/sorprese/${id}/anteprima`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { data: gift } = await supabase.from('surprise_gifts').select('*').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!gift) notFound()
  const { data: steps } = await supabase.from('surprise_steps').select(STEP_SELECT).eq('gift_id', id)
  const view = await buildSurpriseView(gift as SurpriseRow, (steps ?? []) as SurpriseStepRow[], true)
  return <SurpriseExperience view={view} preview editorHref={`/sorprese/${id}`} />
}

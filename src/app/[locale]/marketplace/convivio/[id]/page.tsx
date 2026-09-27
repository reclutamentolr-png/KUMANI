import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, HandPlatter } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ConvivioDetailView from '@/components/convivio/ConvivioDetailView'
import { getConvivio } from '@/app/actions/convivio'
import { createClient } from '@/lib/supabase/server'

export default async function ConvivioDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const t = await getTranslations('convivio')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const [detail, { data: me }] = await Promise.all([getConvivio(id), supabase.from('profiles').select('referral_code').eq('id', user.id).maybeSingle()])
  if (!detail) notFound()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/marketplace/convivio" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backToList')}
          </Link>
          <div className="flex items-center gap-2">
            <HandPlatter className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">Kordata</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <ConvivioDetailView initial={detail} siteUrl={process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'} myReferral={me?.referral_code ?? null} />
      </main>
    </div>
  )
}

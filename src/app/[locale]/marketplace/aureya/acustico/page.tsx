import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { hasActiveAureyaAccess } from '@/lib/aureya-server'
import { ArrowLeft, Ear } from 'lucide-react'
import AureyaAcousticTest from '@/components/AureyaAcousticTest'

export default async function AureyaAcousticPage() {
  const t = await getTranslations('aureya')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveAureyaAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/marketplace')
  }

  const { data: previous } = await supabase
    .from('aureya_test_results')
    .select('score, tested_at')
    .eq('user_id', user.id)
    .eq('test_type', 'acoustic')
    .order('tested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/marketplace/aureya"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="h-5 w-5" /> {t('backToAureya')}
          </Link>
          <div className="flex items-center gap-2">
            <Ear className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">Aureya</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <AureyaAcousticTest previousScore={previous?.score ?? null} previousTestedAt={previous?.tested_at ?? null} />
      </main>
    </div>
  )
}

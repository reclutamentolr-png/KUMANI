import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ShieldQuestion } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import HubBar from '@/components/hubs/HubBar'
import ScamTest from '@/components/scamTest/ScamTest'
import { createClient } from '@/lib/supabase/server'
import { pageMetadata } from '@/lib/seo'

// «Mi stanno truffando?»: test pubblico (anche senza iscrizione), nella Rete
// Anti-Truffa. Le risposte restano nel browser.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('scamTest')
  return pageMetadata('/test-truffa', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function ScamTestPage() {
  const [t, commonT, errorT, hubsT] = await Promise.all([getTranslations('scamTest'), getTranslations('common'), getTranslations('errorPages'), getTranslations('serviceHubs')])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link href={user ? '/servizi' : '/'} className="flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {user ? commonT('backToServices') : errorT('backHome')}
          </Link>
          <span className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <ShieldQuestion className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" /> {hubsT('segnala.title')}
          </span>
        </div>
      </header>
      {user && <HubBar />}
      <div className="bg-gradient-to-br from-[var(--ink)] to-[#2b2110] px-4 pb-14 pt-6 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href={user ? '/dashboard' : '/'} aria-label="KUMANI">
            <Logo />
          </Link>
          <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-white/80">{t('intro')}</p>
        </div>
      </div>
      <div className="mx-auto -mt-8 max-w-3xl px-4">
        <ScamTest loggedIn={!!user} />
      </div>
    </div>
  )
}

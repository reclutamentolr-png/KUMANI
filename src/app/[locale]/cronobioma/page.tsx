import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, SunMoon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import CronobiomaPublic from '@/components/cronobioma/CronobiomaPublic'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { getHiddenTools } from '@/lib/freeTools'
import { pageMetadata } from '@/lib/seo'
import { SITE_URL } from '@/lib/siteUrl'

// KUMANI CRONOBIOMA: il test pubblico sul cronotipo (anche senza iscrizione).
// Le risposte restano nel browser. Chi arriva da un'immagine condivisa ha il
// codice d'invito (?invito=…) e si iscrive con chi l'ha condivisa. Spento il
// servizio, la pagina non c'è (lo Staff la vede in anteprima).
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('cronobioma')
  return pageMetadata('/cronobioma', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function CronobiomaTestPage({ searchParams }: { searchParams: Promise<{ invito?: string }> }) {
  if ((await getHiddenTools()).includes('cronobioma')) notFound()
  const [{ invito }, t, tm, tc, te] = await Promise.all([searchParams, getTranslations('cronobioma'), getTranslations('marketplace'), getTranslations('common'), getTranslations('errorPages')])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Codice d'invito: chi condivide usa il suo; chi arriva da un link lo tiene
  const incoming = typeof invito === 'string' && /^[A-Z0-9-]{4,20}$/i.test(invito) ? invito.toUpperCase() : null
  let access: 'guest' | 'member' | 'plus' = 'guest'
  let ownCode: string | null = null
  if (user) {
    const [{ data }, plus] = await Promise.all([supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null }>(), hasActiveToolAccess(supabase, user.id, 'cronobioma')])
    ownCode = data?.referral_code ?? null
    access = plus ? 'plus' : 'member'
  }
  const code = ownCode ?? incoming
  const shareUrl = `${SITE_URL}/cronobioma${code ? `?invito=${encodeURIComponent(code)}` : ''}`
  const registerHref = incoming ? `/register?invito=${encodeURIComponent(incoming)}` : '/register'

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <Link href={user ? '/servizi' : '/'} className="flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {user ? tc('backToServices') : te('backHome')}
          </Link>
          <span className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <SunMoon className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" /> {tm('cronobioma')}
          </span>
        </div>
      </header>
      <div className="bg-gradient-to-br from-[var(--ink)] to-[#1e2a5a] px-4 pb-14 pt-8 text-white">
        <div className="mx-auto max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-semibold text-[var(--gold-bright)]">
            <SunMoon className="h-4 w-4" /> {t('publicBadge')}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">{t('publicTitle')}</h1>
          <p className="mt-3 max-w-2xl text-lg text-white/75">{t('publicText')}</p>
          <p className="mt-3 text-sm font-semibold italic text-[var(--gold-bright)]">{t('motto')}</p>
        </div>
      </div>
      <main className="mx-auto -mt-8 max-w-4xl px-4">
        <CronobiomaPublic access={access} registerHref={registerHref} shareUrl={shareUrl} />
      </main>
    </div>
  )
}

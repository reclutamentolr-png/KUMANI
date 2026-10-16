import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, AtSign, Camera, Globe, Landmark, LogIn, Phone, ScanSearch, UserPlus } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import QuickCheckBox from '@/components/ecosystem/QuickCheckBox'
import HubBar from '@/components/hubs/HubBar'
import { createClient } from '@/lib/supabase/server'
import { pageMetadata } from '@/lib/seo'

// «Controlla prima di fidarti»: la porta d'ingresso unica dell'anti-truffa.
// Pubblica: chi non è iscritto vede cosa si può controllare e, al primo
// controllo, passa da accesso o registrazione (il proxy riporta qui il
// controllo già compilato). Dal menu «Condividi» del telefono (share_target
// del manifest) arrivano ?text=, ?url= e ?title=: si controlla subito.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('quickCheckPage')
  return pageMetadata('/controlla', { title: t('metaTitle'), description: t('metaDescription') })
}

const TOOLS = [
  { key: 'site', icon: Globe },
  { key: 'email', icon: AtSign },
  { key: 'phone', icon: Phone },
  { key: 'iban', icon: Landmark },
  { key: 'photo', icon: Camera },
] as const

export default async function QuickCheckPage({ searchParams }: { searchParams: Promise<{ text?: string; url?: string; title?: string; q?: string }> }) {
  const sp = await searchParams
  const t = await getTranslations('quickCheckPage')
  const [commonT, errorT, hubsT] = await Promise.all([getTranslations('common'), getTranslations('errorPages'), getTranslations('serviceHubs')])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Contenuto condiviso dal telefono (o ?q=): testo e link insieme
  const shared = [sp.q, sp.title, sp.text, sp.url]
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .join('\n')
    .slice(0, 4000)

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20">
      {/* Come negli altri servizi: in cima si torna indietro (ai servizi o, per chi non è iscritto, alla Home) */}
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link href={user ? '/servizi' : '/'} className="flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {user ? commonT('backToServices') : errorT('backHome')}
          </Link>
          <span className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <ScanSearch className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" /> {hubsT('controlla.title')}
          </span>
        </div>
      </header>
      {/* Speculum · Controlla: le schede dei singoli controlli */}
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
        <QuickCheckBox title={t('boxTitle')} initialText={shared} autoRun={!!shared} className="" />

        <h2 className="mt-8 text-lg font-bold text-[var(--ink)]">{t('whatTitle')}</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {TOOLS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" aria-hidden />
              <span>
                <span className="block font-bold text-[var(--ink)]">{t(`what_${key}`)}</span>
                <span className="block text-sm text-[var(--muted)]">{t(`what_${key}_text`)}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-2xl bg-[var(--gold)]/10 px-4 py-3 text-sm text-[var(--ink)]">{t('shareTip')}</p>

        {!user && (
          <div className="mt-8 rounded-2xl border-2 border-[var(--gold)] bg-white p-5 text-center shadow-sm">
            <p className="font-bold text-[var(--ink)]">{t('joinTitle')}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('joinText')}</p>
            <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)]">
                <UserPlus className="h-5 w-5" /> {t('register')}
              </Link>
              <Link href="/login?next=/controlla" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 py-3 font-semibold text-[var(--ink)]">
                <LogIn className="h-4 w-4" /> {t('login')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

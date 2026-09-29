import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { BookOpenCheck, Gift, Lock, ShieldCheck, Timer } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import Vignette from '@/components/antitruffa/Vignette'
import GuideShareButtons from '@/components/antitruffa/GuideShareButtons'
import { getGuideContent } from '@/lib/antitruffa/content'
import { guideShareUrl } from '@/lib/antitruffa/shareUrl'
import { createClient } from '@/lib/supabase/server'

type Props = { searchParams: Promise<{ ref?: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const g = await getGuideContent(locale)
  const t = await getTranslations('antitruffa')
  const url = guideShareUrl(locale)
  return {
    title: `${g.title} · KUMANI`,
    description: t('metaDescription'),
    alternates: { canonical: url },
    openGraph: { title: g.title, description: `“${g.motto}”`, url, siteName: 'KUMANI', type: 'article' },
    twitter: { card: 'summary_large_image', title: g.title, description: `“${g.motto}”` },
  }
}

// Anteprima pubblica del Manuale Anti-Truffa (il link che i Kumani
// condividono sui social). Mostra copertina, test dei 10 secondi e regole
// d'oro; il manuale completo è per gli iscritti. Con ?ref= l'iscrizione
// parte con il codice invito di chi ha condiviso.
export default async function ManualePreviewPage({ searchParams }: Props) {
  const { ref } = await searchParams
  const locale = await getLocale()
  const g = await getGuideContent(locale)
  const t = await getTranslations('antitruffa')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  type Inviter = { first_name: string; referral_code: string }
  let inviter: Inviter | null = null
  const code = typeof ref === 'string' ? ref.trim().toUpperCase() : ''
  if (/^[A-Z0-9-]{3,32}$/.test(code)) {
    const { data } = await supabase.rpc('get_public_profile_by_referral', { p_referral_code: code })
    inviter = ((data as Inviter[] | null) ?? [])[0] ?? null
  }

  // Chi è iscritto ricondivide con il proprio codice; chi no, con quello
  // di chi l'ha invitato (così la catena resta a chi ha condiviso per primo)
  let shareCode = inviter?.referral_code ?? null
  if (user) {
    const { data: me } = await supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null }>()
    shareCode = me?.referral_code ?? shareCode
  }
  const shareUrl = guideShareUrl(locale, shareCode)
  const registerHref = inviter ? `/register?sponsor=${encodeURIComponent(inviter.referral_code)}` : '/register'
  const scamCount = g.chapters.reduce((n, c) => n + c.scams.length, 0)

  const cta = user ? (
    <Link
      href="/marketplace/antitruffa"
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-4 text-base font-extrabold text-[var(--ink)] shadow-lg"
    >
      <BookOpenCheck className="h-5 w-5" />
      {t('ctaOpen')}
    </Link>
  ) : (
    <div>
      <Link
        href={registerHref}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-4 text-base font-extrabold text-[var(--ink)] shadow-lg"
      >
        <Gift className="h-5 w-5" />
        {t('ctaRegister')}
      </Link>
      <Link href="/login" className="mt-3 block text-center text-sm font-medium text-white/70 hover:text-white">
        {t('ctaLogin')}
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="bg-[var(--ink)] px-4 pb-10 pt-8 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2">
            <Logo size={40} className="h-10 w-10" />
            <span className="text-sm font-bold tracking-[0.3em] text-[var(--gold-bright)]">KUMANI</span>
          </Link>

          {inviter ? (
            <p className="mb-4 flex items-center justify-center gap-2 text-center text-sm font-semibold text-[var(--gold-bright)]">
              <Gift className="h-4 w-4" />
              {t('invitedBy', { name: inviter.first_name || 'KUMANI' })}
            </p>
          ) : null}

          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
            <ShieldCheck className="h-4 w-4" />
            {g.eyebrow}
          </div>
          <h1 className="mb-5 text-3xl font-bold leading-tight sm:text-5xl">{g.title}</h1>
          <blockquote className="mb-5 border-l-4 border-[var(--gold)] pl-4 text-lg font-semibold italic leading-snug text-[var(--gold-bright)] sm:text-2xl">
            “{g.motto}”
          </blockquote>
          <p className="mb-6 text-base leading-7 text-white/75">{g.lead}</p>
          <div className="max-w-md">{cta}</div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {g.stats.map(s => (
            <div key={s.label} className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-4 text-center">
              <div className="text-xl font-bold text-[var(--ink)] sm:text-2xl">{s.value}</div>
              <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Il test dei 10 secondi, intero: è il pezzo più utile da far girare */}
        <section className="mb-8 rounded-3xl border-2 border-[var(--gold)] bg-[var(--gold-pale)]/60 p-6 sm:p-7">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <Timer className="h-6 w-6 text-[var(--gold)]" />
            {g.tenSeconds.title}
          </h2>
          <p className="mb-4 text-sm leading-6 text-[var(--ink)]/80">{g.tenSeconds.intro}</p>
          <ol className="space-y-2">
            {g.tenSeconds.items.map((item, i) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-[var(--ink)]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-[var(--gold-bright)]">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <ShieldCheck className="h-6 w-6 text-[var(--gold)]" />
            {g.rules.title}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.rules.items.map(r => (
              <div key={r.title} className="rounded-2xl border border-black/5 bg-[var(--paper)] p-4 shadow-sm">
                <h3 className="mb-1 font-semibold text-[var(--ink)]">{r.title}</h3>
                <p className="text-sm leading-6 text-[var(--muted)]">{r.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cosa c'è nel manuale completo (solo i titoli) */}
        <section className="mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white sm:p-8">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Lock className="h-5 w-5 text-[var(--gold-bright)]" />
              {t('lockedTitle')}
            </h2>
            <span className="rounded-full bg-[var(--gold)]/20 px-3 py-0.5 text-xs font-bold text-[var(--gold-bright)]">
              {t('lockedScams', { count: scamCount })}
            </span>
          </div>
          <p className="mb-5 text-sm leading-6 text-white/70">{t('lockedText')}</p>
          <div className="mb-6 grid grid-cols-3 gap-2">
            {(['call', 'whatsapp', 'invest'] as const).map(v => (
              <Vignette key={v} id={v} className="w-full rounded-xl" />
            ))}
          </div>
          <ol className="mb-6 space-y-4">
            {g.chapters.map((c, i) => (
              <li key={c.id}>
                <h3 className="font-semibold text-[var(--gold-bright)]">
                  {i + 1}. {c.title}
                </h3>
                <ul className="mt-1 space-y-1">
                  {c.scams.map(s => (
                    <li key={s.id} className="flex gap-2 text-sm leading-5 text-white/75">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" />
                      {s.title}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <div className="max-w-md">{cta}</div>
        </section>

        <div className="mb-8">
          <GuideShareButtons url={shareUrl} title={g.title} />
        </div>

        <footer className="space-y-2 text-center text-xs leading-5 text-[var(--muted)]">
          <p>{g.ui.updated}</p>
          <p>{g.ui.disclaimer}</p>
          <p>{g.ui.copyright}</p>
        </footer>
      </main>
    </div>
  )
}

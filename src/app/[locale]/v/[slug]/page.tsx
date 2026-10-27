import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ArrowRight, UserPlus } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import SiteHomeButton from '@/components/nav/SiteHomeButton'
import HomeVideo from '@/components/home/HomeVideo'
import ShareLinkOpened from '@/components/share/ShareLinkOpened'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { getShareableTools } from '@/lib/shareableTools'
import { getServiceVideos } from '@/lib/serviceVideos'
import { homeVideoCover } from '@/lib/homeVideoShared'
import { createClient } from '@/lib/supabase/server'

// Dati legati al link e a chi lo ha mandato: sempre calcolata a ogni richiesta
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string; slug: string }> }

// Link corto mandato da un Kumano (kumani.io/v/CODICE): il video ufficiale del
// servizio (uno Short di YouTube, verticale e grande), chi lo consiglia e
// l'iscrizione con il suo invito. L'indirizzo resta pulito, ma la pagina dice
// chiaramente chi consiglia.
const loadLink = cache(async (slug: string) => {
  if (!/^[A-Za-z2-9]{6}$/.test(slug)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('share_link_info', { p_slug: slug }).maybeSingle<{ tool: string; referral_code: string }>()
  if (!data) return null
  const [{ data: people }, videos] = await Promise.all([
    supabase.rpc('get_public_profile_by_referral', { p_referral_code: data.referral_code }),
    getServiceVideos(),
  ])
  const person = (people as { first_name: string | null }[] | null)?.[0]
  return { tool: data.tool, code: data.referral_code, name: person?.first_name?.trim() || null, videoId: videos[data.tool] ?? null }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const link = await loadLink(slug)
  if (!link) return { robots: { index: false, follow: false } }
  const [t, tm] = await Promise.all([getTranslations('shareVideo'), getTranslations('marketplace')])
  const tool = getShareableTools(tm).find((item) => item.toolName === link.tool)
  const title = link.name ? t('metaTitle', { name: link.name, tool: tool?.title ?? 'KUMANI' }) : `${tool?.title ?? 'KUMANI'} · KUMANI`
  // Anteprima grande in WhatsApp e social: la copertina del video
  const image = link.videoId ? homeVideoCover(link.videoId) : undefined
  return {
    title: { absolute: title },
    description: tool?.description,
    robots: { index: false, follow: false },
    openGraph: { title, description: tool?.description, ...(image ? { images: [{ url: image, width: 480, height: 360 }] } : {}) },
    twitter: { card: 'summary_large_image', title, description: tool?.description, ...(image ? { images: [image] } : {}) },
  }
}

export default async function ShareVideoPage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const link = await loadLink(slug)
  if (!link) notFound()
  const [t, tm] = await Promise.all([getTranslations('shareVideo'), getTranslations('marketplace')])
  const tool = getShareableTools(tm).find((item) => item.toolName === link.tool)
  if (!tool) notFound()
  const Icon = marketplaceIconMap[tool.iconName]
  const registerHref = `/register?invito=${encodeURIComponent(link.code)}`

  return (
    <div className="min-h-screen bg-[var(--ink)] px-3 py-4 text-white sm:px-4 sm:py-8">
      <ShareLinkOpened slug={slug} />
      <div className="mx-auto max-w-2xl">
        {/* In alto poco spazio: sul telefono il video deve stare quasi tutto nello schermo */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Logo size={32} className="h-8 w-8" />
            <span className="hidden text-xs font-bold tracking-[0.3em] text-[var(--gold-bright)] sm:inline">KUMANI</span>
          </Link>
          {link.name && <p className="min-w-0 flex-1 truncate text-right text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold-bright)]">{t('recommendedBy', { name: link.name })}</p>}
          <SiteHomeButton />
        </div>
        <h1 className="mt-3 flex items-center justify-center gap-2.5 text-center text-2xl font-extrabold sm:text-4xl">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] sm:h-11 sm:w-11">
              <Icon className="h-5 w-5 text-[var(--ink)] sm:h-6 sm:w-6" />
            </span>
          )}
          {tool.title}
        </h1>

        {link.videoId && (
          <div className="mt-3">
            <HomeVideo id={link.videoId} title={tool.title} playLabel={t('play')} vertical />
          </div>
        )}

        <p className="mx-auto mt-5 max-w-xl text-center leading-relaxed text-gray-300">{tool.description}</p>

        <div className="mx-auto mt-6 max-w-md space-y-3 pb-4">
          <Link
            href={registerHref}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] shadow-lg hover:brightness-105"
          >
            <UserPlus className="h-5 w-5" /> {link.name ? t('registerWith', { name: link.name }) : t('register')}
          </Link>
          {tool.publicPage && (
            <Link
              href={`/strumenti/${tool.toolName}?ref=${encodeURIComponent(link.code)}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              {t('discover', { tool: tool.title })} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {/* Chiarezza: chi consiglia riceve un riconoscimento se ti iscrivi dal suo invito */}
          {link.name && <p className="pt-1 text-center text-xs leading-5 text-white/50">{t('disclosure', { name: link.name })}</p>}
        </div>
      </div>
    </div>
  )
}

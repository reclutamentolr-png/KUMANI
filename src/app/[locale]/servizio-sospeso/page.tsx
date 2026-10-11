import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PauseCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import { getMarketplaceTools } from '@/lib/marketplaceTools'

// Servizio spento dallo Staff (Admin → servizi): chi ha il piano giusto non
// deve finire su «Passa a Pro», ma sapere che è una pausa e che i dati restano
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })
  return { title: t('toolPausedTitle'), robots: { index: false, follow: false } }
}

export default async function ToolPausedPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tool?: string }> }) {
  const [{ locale }, { tool }] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const t = await getTranslations('common')
  const tm = await getTranslations('marketplace')
  const name = tool ? getMarketplaceTools((key) => tm(key)).find((x) => x.toolName === tool)?.title : undefined
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-[var(--gold)]/25 bg-white p-8 text-center shadow-sm">
        <Logo size={44} className="mx-auto h-11 w-11" />
        <PauseCircle className="mx-auto mt-6 h-10 w-10 text-[var(--gold)]" />
        <h1 className="mt-4 text-xl font-bold text-[var(--ink)]">{name ? t('toolPausedNamed', { name }) : t('toolPausedTitle')}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('toolPausedText')}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 text-sm font-bold text-[var(--ink)]"
        >
          {t('backToDashboard')}
        </Link>
      </div>
    </div>
  )
}

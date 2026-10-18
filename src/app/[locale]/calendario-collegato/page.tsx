import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, CalendarSync } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import CalendarConnect from '@/components/agenda/CalendarConnect'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/siteUrl'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('calendarFeed')
  return { title: t('title'), robots: { index: false, follow: false } }
}

// Collega il calendario KUMANI a Google Calendar, iPhone e Outlook
export default async function CalendarFeedPage() {
  const locale = await getLocale()
  const t = await getTranslations('calendarFeed')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent('/calendario-collegato')}`)

  // Il link si crea alla prima visita (e ricorda la lingua dei testi)
  const { data } = await supabase.rpc('calendar_feed_token', { p_rotate: false, p_locale: locale })
  const feed = data as { token: string; last_fetched_at: string | null } | null
  if (!feed?.token) throw new Error('calendar feed unavailable')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('back')}
          </Link>
          <span className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight">
            <CalendarSync className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" /> {t('title')}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--ink)]">{t('title')}</h1>
          <p className="mt-2 text-[var(--muted)]">{t('intro')}</p>
        </div>
        <CalendarConnect httpsUrl={`${SITE_URL}/api/calendario/${feed.token}.ics`} lastFetchedAt={feed.last_fetched_at} />
      </main>
    </div>
  )
}

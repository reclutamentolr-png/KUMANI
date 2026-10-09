import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Bell } from 'lucide-react'
import AppHeader from '@/components/nav/AppHeader'
import AllNotifications from '@/components/notifications/AllNotifications'
import { getNotifications } from '@/app/actions/notifications'
import { getSessionUser, preloadSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notifications')
  return { title: t('title'), robots: { index: false, follow: false } }
}

// Tutti gli avvisi degli ultimi 90 giorni (la campanella mostra gli ultimi)
export default async function NotificationsPage() {
  preloadSession()
  const [locale, t, user] = await Promise.all([getLocale(), getTranslations('notifications'), getSessionUser()])
  if (!user) redirect(`/${locale}/login?next=/avvisi`)
  const first = await getNotifications({ limit: 30 })
  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <AppHeader title={t('title')} subtitle={t('pageIntro')} icon={<Bell className="h-5 w-5" />} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <AllNotifications initial={first.items} unread={first.unread} />
      </main>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, CalendarClock, Sparkles, PlusCircle } from 'lucide-react'
import { hasActiveLifeCalendarAccess } from '@/lib/lifeCalendar-server'
import LifeCalendarDashboard from '@/components/LifeCalendarDashboard'

export default async function LifeCalendarPage() {
  const t = await getTranslations('lifeCalendar')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const hasAccess = await hasActiveLifeCalendarAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${await getLocale()}/dashboard`)
  }

  interface ItemRow {
    id: string
    title: string
    category: string
    due_date: string
    recurrence: string
    profile_id: string | null
    life_calendar_profiles: { name: string } | null
    casa_home_id: string | null
    casa_homes: { name: string } | null
  }

  const { data: itemsRaw } = await supabase
    .from('life_calendar_items')
    .select('id, title, category, due_date, recurrence, profile_id, life_calendar_profiles(name), casa_home_id, casa_homes(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .returns<ItemRow[]>()

  const items = (itemsRaw || []).map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    due_date: item.due_date,
    recurrence: item.recurrence,
    profile_id: item.profile_id,
    profile_name: item.life_calendar_profiles?.name ?? null,
    // Voce nata in KUMANI Casa: la scheda mostra la casa
    casa_home_id: item.casa_home_id,
    casa_home_name: item.casa_homes?.name ?? null,
  }))

  const { data: profiles } = await supabase
    .from('life_calendar_profiles')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')

  // Scadenze completate (una tantum): consultabili nell'archivio
  const { data: archived } = await supabase
    .from('life_calendar_items')
    .select('id, title, category, due_date')
    .eq('user_id', user.id)
    .eq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(100)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {commonT('backToDashboard')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <CalendarClock className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 bg-[var(--gold)]/15 text-[var(--gold-bright)] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                {t('badge')}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t('heroTitle')}</h2>
              <p className="text-white/70 text-base sm:text-lg">{t('heroDescription')}</p>
            </div>
            <Link
              href="/marketplace/life-calendar/new"
              className="flex shrink-0 items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all"
            >
              <PlusCircle className="w-5 h-5" />
              {t('newItem')}
            </Link>
          </div>
        </div>

        <LifeCalendarDashboard items={items} profiles={profiles || []} archived={archived || []} />
      </main>
    </div>
  )
}

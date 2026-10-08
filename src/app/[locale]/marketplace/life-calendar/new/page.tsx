import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, CalendarClock } from 'lucide-react'
import { hasActiveLifeCalendarAccess } from '@/lib/lifeCalendar-server'
import LifeCalendarItemForm from '@/components/LifeCalendarItemForm'
import { CATEGORIES, type Category } from '@/lib/lifeCalendar'

// Da MemoLife si arriva con titolo, categoria e data già compilati
// (?title=…&category=…&due=AAAA-MM-GG), vedi lib/lifeCalendarHints.
export default async function NewLifeCalendarItemPage({ searchParams }: { searchParams: Promise<{ title?: string; category?: string; due?: string }> }) {
  const sp = await searchParams
  const t = await getTranslations('lifeCalendar')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const hasAccess = await hasActiveLifeCalendarAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${await getLocale()}/dashboard`)
  }

  const { data: profiles } = await supabase
    .from('life_calendar_profiles')
    .select('id, name, icon')
    .eq('user_id', user.id)
    .order('name')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/marketplace/life-calendar"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <CalendarClock className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('newItem')}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <LifeCalendarItemForm
          mode="create"
          profiles={profiles || []}
          prefill={{
            title: sp.title?.slice(0, 200),
            category: (CATEGORIES as readonly string[]).includes(sp.category ?? '') ? (sp.category as Category) : undefined,
            dueDate: /^\d{4}-\d{2}-\d{2}$/.test(sp.due ?? '') ? sp.due : undefined,
          }}
        />
      </main>
    </div>
  )
}

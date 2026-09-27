import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, CalendarClock, Sparkles } from 'lucide-react'
import { hasActiveLifeCalendarAccess } from '@/lib/lifeCalendar-server'
import LifeCalendarDashboard from '@/components/LifeCalendarDashboard'

export default async function LifeCalendarPage() {
  const t = await getTranslations('lifeCalendar')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveLifeCalendarAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/marketplace')
  }

  interface ItemRow {
    id: string
    title: string
    category: string
    due_date: string
    recurrence: string
    profile_id: string | null
    life_calendar_profiles: { name: string } | null
  }

  const { data: itemsRaw } = await supabase
    .from('life_calendar_items')
    .select('id, title, category, due_date, recurrence, profile_id, life_calendar_profiles(name)')
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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-600 hover:text-amber-600 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {commonT('backToDashboard')}
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
            <CalendarClock className="h-5 w-5 text-amber-600" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            {t('badge')}
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-3">{t('heroTitle')}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">{t('heroDescription')}</p>
        </div>

        <LifeCalendarDashboard items={items} profiles={profiles || []} archived={archived || []} />
      </main>
    </div>
  )
}

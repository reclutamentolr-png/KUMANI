import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, History } from 'lucide-react'
import { hasActiveLifeCalendarAccess } from '@/lib/lifeCalendar-server'
import LifeCalendarItemForm from '@/components/LifeCalendarItemForm'
import DeleteItemButton from '@/components/LifeCalendarDeleteButton'
import type { Category, Recurrence } from '@/lib/lifeCalendar'

export default async function LifeCalendarItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('lifeCalendar')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const hasAccess = await hasActiveLifeCalendarAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${await getLocale()}/marketplace`)
  }

  const { data: item } = await supabase
    .from('life_calendar_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!item) notFound()

  const { data: profiles } = await supabase
    .from('life_calendar_profiles')
    .select('id, name, icon')
    .eq('user_id', user.id)
    .order('name')

  const { data: renewals } = await supabase
    .from('life_calendar_renewals')
    .select('id, renewed_at, previous_due_date, new_due_date')
    .eq('item_id', id)
    .order('renewed_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/marketplace/life-calendar"
            className="flex items-center gap-2 text-gray-600 hover:text-amber-600 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="text-lg font-semibold text-gray-800 truncate max-w-xs">{item.title}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <LifeCalendarItemForm
          mode="edit"
          id={item.id}
          profiles={profiles || []}
          initial={{
            title: item.title,
            category: item.category as Category,
            profileId: item.profile_id,
            dueDate: item.due_date,
            notes: item.notes || '',
            reminderOffsets: item.reminder_offsets || [],
            recurrence: item.recurrence as Recurrence,
            recurrenceCustomDays: item.recurrence_custom_days,
          }}
        />

        {renewals && renewals.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
              <History className="w-5 h-5 text-amber-600" />
              {t('history')}
            </h3>
            <div className="space-y-2">
              {renewals.map((renewal) => (
                <div key={renewal.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                  <span className="text-gray-600">{new Date(renewal.renewed_at).toLocaleDateString()}</span>
                  <span className="text-gray-800">
                    {t('renewedFrom', { date: new Date(renewal.previous_due_date).toLocaleDateString() })}
                    {renewal.new_due_date &&
                      ` → ${new Date(renewal.new_due_date).toLocaleDateString()}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <DeleteItemButton id={item.id} />
      </main>
    </div>
  )
}

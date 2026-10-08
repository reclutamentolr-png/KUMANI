import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, CalendarHeart } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import MemoLifeApp, { type MemoContact, type MemoNote, type MemoTask } from '@/components/memolife/MemoLifeApp'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { loadAgenda } from '@/lib/agenda-server'
import { addDays, monthRange, todayKey } from '@/lib/agenda'

// MemoLife — l'agenda personale: "Oggi" con tutto ciò che conta (anche
// bollette di Spendly e scadenze di Life Calendar), calendario unico,
// promemoria, note e rubrica.
export default async function MemoLifePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ add?: string }>
}) {
  const { locale } = await params
  const { add } = await searchParams
  const t = await getTranslations('agenda')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [spendly, lifeCalendar] = await Promise.all([
    hasActiveToolAccess(supabase, user.id, 'spendly'),
    hasActiveToolAccess(supabase, user.id, 'life-calendar'),
  ])
  const sources = { memolife: true, spendly, lifeCalendar }
  const today = todayKey()
  const month = monthRange(Number(today.slice(0, 4)), Number(today.slice(5, 7)))

  const [upcoming, monthEvents, { data: tasks }, { data: notes }, { data: contacts }] = await Promise.all([
    loadAgenda(supabase, user.id, { from: today, to: addDays(today, 6), overdueSince: addDays(today, -60), sources, includeDone: true, useReminders: true }),
    loadAgenda(supabase, user.id, { from: month.from, to: month.to, sources, includeDone: true }),
    supabase.from('tasks').select('id, title, description, due_date, priority, completed, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(300),
    supabase.from('notes').select('id, title, content, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(300),
    supabase.from('contacts').select('id, name, phone, email, company, notes').eq('user_id', user.id).order('name').limit(2000),
  ])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <CalendarHeart className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">MemoLife</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6">
        <p className="mb-5 text-sm text-[var(--muted)]">{t('memolifeIntro')}</p>
        <MemoLifeApp
          today={today}
          sources={sources}
          upcoming={upcoming}
          monthEvents={monthEvents}
          tasks={(tasks ?? []) as MemoTask[]}
          notes={(notes ?? []) as MemoNote[]}
          contacts={(contacts ?? []) as MemoContact[]}
          initialAdd={add === 'appointment' || add === 'task' ? add : null}
        />
      </main>
    </div>
  )
}

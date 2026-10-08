import { getLocale, getTranslations } from 'next-intl/server'
import { AlertTriangle, CalendarClock, ChevronRight, FileText, House, Plug, Plus, ShieldAlert, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { loadHomes } from '@/lib/casa-server'
import { warrantyState } from '@/lib/casa'
import { todayKey } from '@/lib/agenda'

export const dynamic = 'force-dynamic'

// KUMANI Casa: le proprie case con la prossima scadenza, le garanzie che
// stanno per finire e quanti apparecchi e documenti contengono.
export default async function CasaPage() {
  const locale = await getLocale()
  const t = await getTranslations('casa')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { homes, deadlines, appliances, documents } = await loadHomes(supabase, user!.id)
  const today = todayKey()
  const date = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
            <Sparkles className="h-4 w-4" /> {t('eyebrow')}
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h1>
          <p className="mt-3 text-white/75">{t('heroText')}</p>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[var(--ink)]">{t('yourHomes')}</h2>
        <Link
          href="/marketplace/casa/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> {t('addHome')}
        </Link>
      </div>

      {homes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-white px-6 py-10 text-center">
          <House className="mx-auto h-10 w-10 text-[var(--gold)]" />
          <p className="mt-3 font-bold text-[var(--ink)]">{t('emptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t('emptyText')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {homes.map((home) => {
            const own = deadlines.filter((d) => d.casa_home_id === home.id)
            const next = own[0]
            const overdue = own.filter((d) => d.due_date < today).length
            const ownAppliances = appliances.filter((a) => a.home_id === home.id)
            const warrantiesSoon = ownAppliances.filter((a) => warrantyState(a.warranty_until, today) === 'soon').length
            const docs = documents.filter((d) => d.home_id === home.id).length
            return (
              <Link
                key={home.id}
                href={`/marketplace/casa/${home.id}`}
                className="group flex flex-col rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-[0_8px_24px_rgba(23,23,23,0.06)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                    <House className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-[var(--ink)]">{home.name}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{[t(`homeKind_${home.kind}`), home.address].filter(Boolean).join(' · ')}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                </div>

                <div className="mt-4 space-y-1.5 text-sm">
                  {next ? (
                    <p className={`flex items-center gap-1.5 ${next.due_date < today ? 'font-bold text-red-600' : 'text-[var(--ink)]'}`}>
                      {next.due_date < today ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CalendarClock className="h-4 w-4 shrink-0 text-[var(--gold)]" />}
                      <span className="truncate">
                        {next.title} · {date(next.due_date)}
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-[var(--muted)]">
                      <CalendarClock className="h-4 w-4" /> {t('noDeadlines')}
                    </p>
                  )}
                  {overdue > 1 && <p className="text-xs font-semibold text-red-600">{t('overdueCount', { count: overdue })}</p>}
                  {warrantiesSoon > 0 && (
                    <p className="flex items-center gap-1.5 text-amber-700">
                      <ShieldAlert className="h-4 w-4" /> {t('warrantiesSoon', { count: warrantiesSoon })}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-[var(--muted)]">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" /> {t('countDeadlines', { count: own.length })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Plug className="h-3.5 w-3.5" /> {t('countAppliances', { count: ownAppliances.length })}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> {t('countDocuments', { count: docs })}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

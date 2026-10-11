'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, Plus, Search } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { createClientRecord } from '@/app/actions/clienti'
import { CLIENT_FILTERS, EMPTY_CLIENT_FORM, formatEur, isStepDue, type ClientFilter, type ClientOverview } from '@/lib/clienti'
import ClientForm, { inputClass } from './ClientForm'

export default function ClientiList({ clients }: { clients: ClientOverview[] }) {
  const t = useTranslations('clienti')
  const locale = useLocale()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ClientFilter>('all')
  const [adding, setAdding] = useState(false)

  const dueCount = clients.filter((c) => isStepDue(c.next_step_due)).length
  const owedTotal = clients.reduce((sum, c) => sum + c.owed, 0)
  const owedCount = clients.filter((c) => c.owed > 0).length

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients
      .filter((c) => (filter === 'due' ? isStepDue(c.next_step_due) : filter === 'owed' ? c.owed > 0 : true))
      .filter((c) => !q || [c.name, c.contact_name, c.city, c.phone, c.email].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        // «Da sentire»: prima i passi più vecchi; «Devono pagare»: prima chi deve di più
        if (filter === 'due') return (a.next_step_due ?? '').localeCompare(b.next_step_due ?? '')
        if (filter === 'owed') return b.owed - a.owed
        return a.name.localeCompare(b.name, locale)
      })
  }, [clients, filter, query, locale])

  const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const counts: Record<ClientFilter, number> = { all: clients.length, due: dueCount, owed: owedCount }

  const create = async (form: typeof EMPTY_CLIENT_FORM) => {
    const result = await createClientRecord(form)
    if (!result.success) return t(`errors.${result.message === 'duplicateName' || result.message === 'nameRequired' ? result.message : 'saveError'}`)
    router.push(`/marketplace/clienti/${result.data.id}`)
    return null
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
          <p className="text-xs font-semibold text-[var(--muted)]">{t('toCollect')}</p>
          <p className="mt-1 text-xl font-extrabold text-[var(--ink)]">{formatEur(owedTotal, locale)}</p>
        </div>
        <button
          type="button"
          onClick={() => setFilter('due')}
          className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 text-left transition-colors hover:border-[var(--gold)]"
        >
          <p className="text-xs font-semibold text-[var(--muted)]">{t('toContactToday')}</p>
          <p className={`mt-1 text-xl font-extrabold ${dueCount > 0 ? 'text-[#8a6a1f]' : 'text-[var(--ink)]'}`}>{dueCount}</p>
        </button>
      </div>

      {adding ? (
        <section className="rounded-3xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t('newClient')}</h2>
          <ClientForm initial={EMPTY_CLIENT_FORM} submitLabel={t('saveClient')} onSubmit={create} onCancel={() => setAdding(false)} />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-5 text-base font-bold text-[var(--gold-bright)] transition-opacity hover:opacity-90 sm:w-auto"
        >
          <Plus className="h-5 w-5" />
          {t('newClient')}
        </button>
      )}

      <label className="block text-sm font-semibold text-[var(--muted)]">
        {t('search')}
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} className={`${inputClass} pl-9`} />
        </span>
      </label>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('filtersLabel')}>
        {CLIENT_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-10 rounded-full px-4 text-sm font-bold transition-colors ${
              filter === f ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--gold)]/35 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]'
            }`}
          >
            {t(`filters.${f}`)} · {counts[f]}
          </button>
        ))}
      </div>

      {clients.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--gold)]/40 bg-white/60 p-6 text-center">
          <p className="font-semibold text-[var(--ink)]">{t('emptyTitle')}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('emptyText')}</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t('noResults')}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((c) => {
            const due = isStepDue(c.next_step_due)
            const meta = [c.contact_name, c.city, c.quotes_count > 0 ? t('quotesCount', { count: c.quotes_count }) : null].filter(Boolean).join(' · ')
            return (
              <li key={c.id}>
                <Link
                  href={`/marketplace/clienti/${c.id}`}
                  className="flex h-full flex-col gap-1.5 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 transition-colors hover:border-[var(--gold)]"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words text-base font-extrabold text-[var(--ink)]">{c.name}</span>
                    <span className={`shrink-0 text-sm font-extrabold ${c.owed > 0 ? 'text-[#8a6a1f]' : 'text-[#1d6b34]'}`}>
                      {c.owed > 0 ? t('owes', { amount: formatEur(c.owed, locale) }) : c.accepted_total > 0 ? t('settled') : ''}
                    </span>
                  </span>
                  {meta && <span className="text-sm text-[var(--muted)]">{meta}</span>}
                  <span className={`flex items-center gap-1.5 text-sm font-semibold ${due ? 'text-[#8a6a1f]' : 'text-[var(--muted)]'}`}>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {c.next_step
                      ? `${c.next_step_due ? `${due ? t('dueBadge') : formatDay(c.next_step_due)} · ` : ''}${c.next_step}`
                      : t('noStep')}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-[var(--muted)]">{t('fromQuotesHint')}</p>
    </div>
  )
}

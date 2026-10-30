'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BellRing, CalendarClock, CalendarPlus, Check, Download, FileText, LoaderCircle, Mail, Phone, Plus, Search, Send } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { setApplicationStatus, setFollowUp } from '@/app/actions/candidature'
import { downloadCsv, toCsv } from '@/lib/magazzino'
import {
  APPLICATION_STATUSES,
  CLOSED_STATUSES,
  addDays,
  applicationStats,
  formatDay,
  formatEur,
  formatTime,
  romeDay,
  romeToday,
  telHref,
  todayItems,
  type ApplicationStatus,
  type JobApplication,
} from '@/lib/candidature'
import ApplicationCard, { useAddToCalendar } from './ApplicationCard'
import ApplicationFormSheet from './ApplicationFormSheet'
import { STATUS_TONE, card, input, pill } from './styles'

type Filter = 'all' | 'open' | ApplicationStatus
type Sort = 'recent' | 'next' | 'company' | 'changed'
type SheetState = { kind: 'form'; app: JobApplication | null } | { kind: 'card'; id: string } | null

// Prossima cosa da fare per una candidatura (per l'ordine «Prossime scadenze»)
const nextDate = (a: JobApplication) => {
  const dates = [a.follow_up_on, a.interview_at ? romeDay(new Date(a.interview_at)) : null].filter((d): d is string => !!d)
  return dates.length ? dates.sort()[0] : '9999-12-31'
}

export default function CandidatureApp({ initialApplications }: { initialApplications: JobApplication[] }) {
  const t = useTranslations('candidature')
  const locale = useLocale()
  const addToCalendar = useAddToCalendar()
  const [apps, setApps] = useState(initialApplications)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null)

  const today = romeToday()
  const stats = useMemo(() => applicationStats(apps, today), [apps, today])
  const todo = useMemo(() => todayItems(apps, today), [apps, today])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: apps.length, open: 0 }
    for (const a of apps) {
      c[a.status] = (c[a.status] ?? 0) + 1
      if (!CLOSED_STATUSES.includes(a.status)) c.open += 1
    }
    return c
  }, [apps])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = apps.filter(
      (a) =>
        (filter === 'all' || (filter === 'open' ? !CLOSED_STATUSES.includes(a.status) : a.status === filter)) &&
        (!q || [a.company, a.role, a.city, a.contact_name, a.notes].some((v) => v?.toLowerCase().includes(q))),
    )
    const byRecent = (a: JobApplication, b: JobApplication) => (b.sent_on ?? b.created_at).localeCompare(a.sent_on ?? a.created_at) || b.created_at.localeCompare(a.created_at)
    return list.sort((a, b) =>
      sort === 'company'
        ? a.company.localeCompare(b.company, locale)
        : sort === 'changed'
          ? b.status_changed_at.localeCompare(a.status_changed_at)
          : sort === 'next'
            ? nextDate(a).localeCompare(nextDate(b)) || byRecent(a, b)
            : byRecent(a, b),
    )
  }, [apps, filter, query, sort, locale])

  const replace = (app: JobApplication) => setApps((list) => list.map((a) => (a.id === app.id ? app : a)))
  // Avviso in basso: sparisce dopo 4 secondi (uno nuovo riparte da capo)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const show = (text: string, ok = true) => {
    setNotice({ text, ok })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setNotice(null), 4000)
  }
  const errorText = (code: string) => (t.has(`error_${code}`) ? t(`error_${code}`) : t('error_saveError'))

  const quickStatus = async (app: JobApplication, status: ApplicationStatus) => {
    if (status === app.status) return
    setBusy(`${app.id}-status`)
    const result = await setApplicationStatus(app.id, status)
    setBusy(null)
    if (result.success) {
      replace(result.data)
      show(t('statusChanged', { company: app.company, status: t(`status_${status}`) }))
    } else show(errorText(result.message), false)
  }

  const quickFollowUp = async (app: JobApplication, day: string | null, message: string) => {
    setBusy(`${app.id}-follow`)
    const result = await setFollowUp(app.id, day)
    setBusy(null)
    if (result.success) {
      replace(result.data)
      show(message)
    } else show(errorText(result.message), false)
  }

  const exportCsv = () => {
    const rows: (string | number | null)[][] = [
      [
        t('company'), t('role'), t('city'), t('source'), t('adUrl'), t('contactTitle'), t('contactEmail'), t('contactPhone'),
        t('sentOn'), t('status'), t('interviewLabel'), t('followUpOn'), t('salaryShort'), t('salaryPeriod'), t('notes'),
      ],
      ...apps.map((a) => [
        a.company,
        a.role,
        a.city,
        a.source ? t(`source_${a.source}`) : null,
        a.ad_url,
        a.contact_name,
        a.contact_email,
        a.contact_phone,
        a.sent_on,
        t(`status_${a.status}`),
        a.interview_at ? new Date(a.interview_at).toLocaleString(locale, { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' }) : null,
        a.follow_up_on,
        a.salary,
        a.salary !== null ? t(`period_${a.salary_period}`) : null,
        a.notes,
      ]),
    ]
    downloadCsv(`${t('csvFile')}-${today}.csv`, toCsv(rows))
  }

  const open = sheet?.kind === 'card' ? apps.find((a) => a.id === sheet.id) : null
  const stat = (name: string, value: string, hint?: string) => (
    <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-3 sm:p-4">
      <p className="text-xs font-semibold leading-tight text-[var(--muted)]">{name}</p>
      <p className="mt-1 text-2xl font-extrabold text-[var(--ink)]">{value}</p>
      {hint && <p className="text-[11px] leading-tight text-[var(--muted)]">{hint}</p>}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Contatori: solo numeri */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stat(t('statSentMonth'), String(stats.sentThisMonth))}
        {stat(t('statInterviews'), String(stats.interviews))}
        {stat(t('statAnswers'), stats.answeredPercent === null ? '—' : `${stats.answeredPercent}%`)}
      </div>

      <button type="button" onClick={() => setSheet({ kind: 'form', app: null })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-4 text-lg font-bold text-[var(--ink)] shadow-sm">
        <Plus className="h-6 w-6" aria-hidden="true" /> {t('add')}
      </button>

      {/* Da fare oggi */}
      {apps.length > 0 && (
        <section aria-labelledby="ca-today" className={card}>
          <h2 id="ca-today" className="flex items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
            <BellRing className="h-5 w-5 text-[var(--gold)]" aria-hidden="true" /> {t('todayTitle')}
          </h2>
          {todo.length === 0 ? (
            <p className="mt-2 rounded-2xl bg-[#e7f4ea] px-4 py-3 text-sm font-semibold text-[#1d6b34]">{t('todayClear')}</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--gold)]/15">
              {todo.map((item) => {
                const a = item.app
                const isBusy = busy?.startsWith(a.id)
                return (
                  <li key={`${item.kind}-${a.id}`} className="flex flex-wrap items-center gap-2 py-3">
                    <button type="button" onClick={() => setSheet({ kind: 'card', id: a.id })} className="min-w-0 flex-1 basis-48 text-left">
                      <span className="block break-words font-bold text-[var(--ink)]">{a.company}</span>
                      <span className="block break-words text-sm">
                        {item.kind === 'interview' ? (
                          <span className="font-semibold text-[#7a5a12]">
                            {t(item.tomorrow ? 'interviewTomorrow' : 'interviewToday', { time: formatTime(a.interview_at!, locale) })}
                          </span>
                        ) : item.kind === 'followUp' ? (
                          <span className={item.late > 0 ? 'font-semibold text-red-700' : 'font-semibold text-[var(--ink)]'}>
                            {item.late > 0 ? t('followUpLate', { days: item.late }) : t('followUpToday')}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">{t('suggestItem', { days: item.waiting })}</span>
                        )}
                        {a.role ? <span className="text-[var(--muted)]"> · {a.role}</span> : null}
                      </span>
                    </button>
                    <span className="flex flex-wrap gap-2">
                      {item.kind === 'interview' && (
                        <button type="button" onClick={() => addToCalendar(a)} className={`${pill} border border-[var(--ink)] bg-white text-[var(--ink)]`}>
                          <CalendarPlus className="h-4 w-4" aria-hidden="true" /> {t('calendarShort')}
                        </button>
                      )}
                      {item.kind !== 'interview' && a.contact_phone && (
                        <a href={telHref(a.contact_phone)} className={`${pill} bg-[var(--gold-bright)] text-[var(--ink)]`}>
                          <Phone className="h-4 w-4" aria-hidden="true" /> {t('call')}
                        </a>
                      )}
                      {item.kind !== 'interview' && !a.contact_phone && a.contact_email && (
                        <button type="button" onClick={() => setSheet({ kind: 'card', id: a.id })} className={`${pill} bg-[var(--gold-bright)] text-[var(--ink)]`}>
                          <Mail className="h-4 w-4" aria-hidden="true" /> {t('writeEmail')}
                        </button>
                      )}
                      {item.kind === 'followUp' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            const next = addDays(today, 7)
                            quickFollowUp(a, next, t('calledDone', { date: formatDay(next, locale, true) }))
                          }}
                          className={`${pill} border border-[var(--gold)]/50 bg-white text-[var(--ink)]`}
                        >
                          {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                          {t('called')}
                        </button>
                      )}
                      {item.kind === 'suggest' && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => quickFollowUp(a, today, t('followSetToday'))}
                            className={`${pill} border border-[var(--gold)]/50 bg-[var(--gold-pale)] text-[var(--ink)]`}
                          >
                            <CalendarClock className="h-4 w-4" aria-hidden="true" /> {t('followToday')}
                          </button>
                          <button type="button" disabled={isBusy} onClick={() => quickStatus(a, 'no_answer')} className={`${pill} border border-gray-300 bg-white text-gray-700`}>
                            {t('status_no_answer')}
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* CV e lettera */}
      <section className="grid gap-2 sm:grid-cols-2">
        <Link href="/app/kumani-cv" className="flex items-center gap-3 rounded-2xl border border-[var(--gold)]/30 bg-white p-3 hover:border-[var(--gold)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)]">
            <FileText className="h-5 w-5 text-[#7a5a12]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-[var(--ink)]">{t('cvLink')}</span>
            <span className="block text-xs text-[var(--muted)]">{t('cvLinkText')}</span>
          </span>
        </Link>
        <Link href="/app/lettera-presentazione" className="flex items-center gap-3 rounded-2xl border border-[var(--gold)]/30 bg-white p-3 hover:border-[var(--gold)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)]">
            <Mail className="h-5 w-5 text-[#7a5a12]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-[var(--ink)]">{t('letterLink')}</span>
            <span className="block text-xs text-[var(--muted)]">{t('letterLinkText')}</span>
          </span>
        </Link>
      </section>

      {/* Elenco */}
      <section aria-labelledby="ca-list" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="ca-list" className="text-xl font-bold text-[var(--ink)]">
            {t('listTitle')}
          </h2>
          {apps.length > 0 && (
            <button type="button" onClick={exportCsv} className={`${pill} border border-[var(--gold)]/50 bg-white text-[var(--ink)]`}>
              <Download className="h-4 w-4" aria-hidden="true" /> {t('exportCsv')}
            </button>
          )}
        </div>

        {apps.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--gold)]/50 bg-white p-6 text-center">
            <Send className="mx-auto h-10 w-10 text-[var(--gold)]" aria-hidden="true" />
            <p className="mt-3 font-bold text-[var(--ink)]">{t('emptyTitle')}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('emptyText')}</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('search')} className={`${input} pl-9`} />
            </div>

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t('filterLabel')}>
              {(['all', 'open', ...APPLICATION_STATUSES] as Filter[]).map((f) =>
                f === 'all' || f === 'open' || counts[f] ? (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold ${
                      filter === f ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    {f === 'all' ? t('filterAll') : f === 'open' ? t('filterOpen') : t(`status_${f}`)} <span className="opacity-70">{counts[f] ?? 0}</span>
                  </button>
                ) : null,
              )}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="ca-sort" className="shrink-0 text-sm font-semibold text-gray-700">
                {t('sortLabel')}
              </label>
              <select id="ca-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${input} py-2`}>
                <option value="recent">{t('sort_recent')}</option>
                <option value="next">{t('sort_next')}</option>
                <option value="changed">{t('sort_changed')}</option>
                <option value="company">{t('sort_company')}</option>
              </select>
            </div>

            {visible.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-[var(--muted)]">{t('noResults')}</p>
            ) : (
              <ul className="space-y-2">
                {visible.map((a) => {
                  const followDue = a.follow_up_on && a.follow_up_on <= today && !CLOSED_STATUSES.includes(a.status)
                  return (
                    <li key={a.id} className="rounded-2xl border border-[var(--gold)]/20 bg-white p-3 shadow-sm sm:p-4">
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => setSheet({ kind: 'card', id: a.id })} className="min-w-0 flex-1 text-left">
                          <span className="block break-words text-base font-bold text-[var(--ink)]">{a.company}</span>
                          {(a.role || a.city) && <span className="block break-words text-sm text-[var(--muted)]">{[a.role, a.city].filter(Boolean).join(' · ')}</span>}
                          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--muted)]">
                            {a.sent_on && <span>{t('sentShort', { date: formatDay(a.sent_on, locale) })}</span>}
                            {a.interview_at && a.status === 'interview_set' && (
                              <span className="font-semibold text-[#7a5a12]">{t('interviewShort', { date: new Date(a.interview_at).toLocaleString(locale, { timeZone: 'Europe/Rome', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</span>
                            )}
                            {a.follow_up_on && !CLOSED_STATUSES.includes(a.status) && (
                              <span className={followDue ? 'font-semibold text-red-700' : ''}>{t('followShort', { date: formatDay(a.follow_up_on, locale) })}</span>
                            )}
                            {a.salary !== null && <span>{formatEur(a.salary, locale)} {t(`periodShort_${a.salary_period}`)}</span>}
                          </span>
                        </button>
                        {/* Cambio di stato con un tocco */}
                        <div className="relative shrink-0">
                          <select
                            aria-label={t('statusFor', { company: a.company })}
                            value={a.status}
                            disabled={busy === `${a.id}-status`}
                            onChange={(e) => quickStatus(a, e.target.value as ApplicationStatus)}
                            className={`max-w-[9.5rem] cursor-pointer appearance-none truncate rounded-full border py-2 pl-3 pr-7 text-xs font-bold ${STATUS_TONE[a.status]}`}
                          >
                            {APPLICATION_STATUSES.map((s) => (
                              <option key={s} value={s} className="bg-white text-[var(--ink)]">
                                {t(`status_${s}`)}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]" aria-hidden="true">
                            {busy === `${a.id}-status` ? <LoaderCircle className="h-3 w-3 animate-spin" /> : '▾'}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {notice && (
        <div role="status" className={`fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ${notice.ok ? 'bg-[var(--ink)] text-white' : 'bg-amber-50 text-amber-800'}`}>
          {notice.text}
        </div>
      )}

      {sheet?.kind === 'form' && (
        <ApplicationFormSheet
          application={sheet.app}
          onClose={() => setSheet(null)}
          onSaved={(app, isNew) => {
            setApps((list) => (isNew ? [app, ...list] : list.map((a) => (a.id === app.id ? app : a))))
            setSheet({ kind: 'card', id: app.id })
            show(isNew ? t('savedNew') : t('saved'))
          }}
        />
      )}
      {open && (
        <ApplicationCard
          application={open}
          onClose={() => setSheet(null)}
          onEdit={() => setSheet({ kind: 'form', app: open })}
          onChanged={replace}
          onDeleted={(id) => {
            setApps((list) => list.filter((a) => a.id !== id))
            setSheet(null)
            show(t('deleted'))
          }}
        />
      )}
    </div>
  )
}

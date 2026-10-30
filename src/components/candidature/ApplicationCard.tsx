'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarPlus, Check, ExternalLink, FileText, LoaderCircle, Mail, Pencil, Phone, Trash2, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { deleteApplication, listApplicationEvents, setApplicationStatus, setFollowUp } from '@/app/actions/candidature'
import { askConfirm } from '@/lib/confirm'
import {
  APPLICATION_STATUSES,
  FOLLOW_UP_AFTER_DAYS,
  downloadFile,
  formatDateTime,
  formatDay,
  formatEur,
  interviewIcs,
  romeToday,
  safeAdUrl,
  safeFileName,
  suggestFollowUp,
  telHref,
  type ApplicationEvent,
  type ApplicationStatus,
  type JobApplication,
} from '@/lib/candidature'
import { STATUS_TONE, input, pill } from './styles'

// Indirizzo per «Scrivi email» con oggetto e saluto già scritti
export function useMailHref() {
  const t = useTranslations('candidature')
  return (app: JobApplication) => {
    if (!app.contact_email) return null
    const subject = app.role ? t('mailSubject', { role: app.role }) : t('mailSubjectNoRole', { company: app.company })
    const body = app.contact_name ? t('mailGreeting', { name: app.contact_name }) : t('mailGreetingNoName')
    return `mailto:${app.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\n`)}`
  }
}

// File .ics del colloquio scaricato dal browser
export function useAddToCalendar() {
  const t = useTranslations('candidature')
  return (app: JobApplication) => {
    const description = [
      app.role ? `${t('role')}: ${app.role}` : '',
      app.contact_name ? `${t('contactTitle')}: ${app.contact_name}` : '',
      app.contact_phone ? `${t('contactPhone')}: ${app.contact_phone}` : '',
      app.contact_email ? `${t('contactEmail')}: ${app.contact_email}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    const ics = interviewIcs(app, { summary: t('icsSummary', { company: app.company }), description, alarm: t('icsAlarm', { company: app.company }) })
    if (ics) downloadFile(`${t('icsFile')}-${safeFileName(app.company)}.ics`, ics, 'text/calendar;charset=utf-8')
  }
}

export default function ApplicationCard({
  application,
  onClose,
  onEdit,
  onChanged,
  onDeleted,
}: {
  application: JobApplication
  onClose: () => void
  onEdit: () => void
  onChanged: (app: JobApplication) => void
  onDeleted: (id: string) => void
}) {
  const t = useTranslations('candidature')
  const locale = useLocale()
  const mailHref = useMailHref()
  const addToCalendar = useAddToCalendar()
  const [events, setEvents] = useState<ApplicationEvent[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Data scritta nel campo; torna quella salvata quando cambia da fuori
  const [draft, setDraft] = useState({ saved: application.follow_up_on, value: application.follow_up_on ?? '' })
  const app = application
  const today = romeToday()
  const suggested = suggestFollowUp(app, today)

  // Storico ricaricato a ogni cambio di stato
  useEffect(() => {
    let alive = true
    listApplicationEvents(app.id).then((list) => alive && setEvents(list))
    return () => {
      alive = false
    }
  }, [app.id, app.status])

  const followDraft = draft.saved === app.follow_up_on ? draft.value : app.follow_up_on ?? ''
  const setFollowDraft = (value: string) => setDraft({ saved: app.follow_up_on, value })

  const run = async (key: string, action: () => Promise<{ success: true; data: JobApplication } | { success: false; message: string }>) => {
    setBusy(key)
    setError(null)
    const result = await action()
    setBusy(null)
    if (result.success) onChanged(result.data)
    else setError(t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError'))
  }

  const changeStatus = (status: ApplicationStatus) => {
    if (status === app.status || busy) return
    run(`status-${status}`, () => setApplicationStatus(app.id, status))
  }

  const remove = async () => {
    if (!(await askConfirm(t('deleteConfirm', { company: app.company })))) return
    setBusy('delete')
    const result = await deleteApplication(app.id)
    setBusy(null)
    if (result.success) onDeleted(app.id)
    else setError(t('error_deleteError'))
  }

  const mail = mailHref(app)
  const adUrl = safeAdUrl(app.ad_url)
  const row = (name: string, value: React.ReactNode) =>
    value ? (
      <div className="flex gap-3 py-2">
        <dt className="w-32 shrink-0 text-sm text-[var(--muted)]">{name}</dt>
        <dd className="min-w-0 flex-1 break-words text-sm font-semibold text-[var(--ink)]">{value}</dd>
      </div>
    ) : null

  return (
    <Sheet title={app.company} onClose={onClose}>
      <div className="space-y-5">
        {(app.role || app.city) && <p className="-mt-3 text-sm text-[var(--muted)]">{[app.role, app.city].filter(Boolean).join(' · ')}</p>}

        {/* Stato: un tocco per cambiarlo */}
        <section>
          <h4 className="mb-2 text-sm font-bold text-[var(--ink)]">{t('statusTap')}</h4>
          <div className="grid grid-cols-2 gap-2">
            {APPLICATION_STATUSES.map((s) => {
              const active = s === app.status
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  disabled={!!busy}
                  onClick={() => changeStatus(s)}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-bold transition ${
                    active ? `${STATUS_TONE[s]} ring-2 ring-[var(--gold)]` : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]/60'
                  } disabled:opacity-70`}
                >
                  {busy === `status-${s}` ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                  {t(`status_${s}`)}
                </button>
              )
            })}
          </div>
        </section>

        {/* Azioni rapide */}
        <section className="flex flex-wrap gap-2">
          {app.contact_phone && (
            <a href={telHref(app.contact_phone)} className={`${pill} bg-[var(--gold-bright)] text-[var(--ink)]`}>
              <Phone className="h-4 w-4" aria-hidden="true" /> {t('call')}
            </a>
          )}
          {mail && (
            <a href={mail} className={`${pill} border border-[var(--ink)] bg-white text-[var(--ink)]`}>
              <Mail className="h-4 w-4" aria-hidden="true" /> {t('writeEmail')}
            </a>
          )}
          {adUrl && (
            <a href={adUrl} target="_blank" rel="noopener noreferrer" className={`${pill} border border-[var(--ink)] bg-white text-[var(--ink)]`}>
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> {t('openAd')}
            </a>
          )}
          {app.interview_at && (
            <button type="button" onClick={() => addToCalendar(app)} className={`${pill} border border-[var(--ink)] bg-white text-[var(--ink)]`}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" /> {t('addToCalendar')}
            </button>
          )}
        </section>

        {/* Quando richiamare */}
        <section className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-3">
          <label htmlFor="ca-card-follow" className="mb-1 block text-sm font-bold text-[var(--ink)]">
            {t('followUpOn')}
          </label>
          {suggested && <p className="mb-2 text-sm text-[var(--ink)]">{t('suggestText', { days: FOLLOW_UP_AFTER_DAYS })}</p>}
          <div className="flex flex-wrap gap-2">
            <input id="ca-card-follow" type="date" className={`${input} max-w-[12rem]`} value={followDraft} onChange={(e) => setFollowDraft(e.target.value)} />
            <button
              type="button"
              disabled={!!busy || !followDraft || followDraft === app.follow_up_on}
              onClick={() => run('follow', () => setFollowUp(app.id, followDraft))}
              className={`${pill} bg-[var(--ink)] text-white`}
            >
              {busy === 'follow' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              {t('setFollowUp')}
            </button>
            {suggested && !followDraft && (
              <button type="button" disabled={!!busy} onClick={() => run('follow', () => setFollowUp(app.id, today))} className={`${pill} bg-[var(--gold-bright)] text-[var(--ink)]`}>
                {t('followToday')}
              </button>
            )}
            {app.follow_up_on && (
              <button type="button" disabled={!!busy} onClick={() => run('follow', () => setFollowUp(app.id, null))} className={`${pill} border border-gray-300 bg-white text-gray-700`}>
                <X className="h-4 w-4" aria-hidden="true" /> {t('removeFollowUp')}
              </button>
            )}
          </div>
        </section>

        {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p>}

        {/* Dettagli */}
        <dl className="divide-y divide-[var(--gold)]/15">
          {row(t('interviewLabel'), app.interview_at ? formatDateTime(app.interview_at, locale) : null)}
          {row(t('sentOn'), app.sent_on ? formatDay(app.sent_on, locale) : null)}
          {row(t('source'), app.source ? t(`source_${app.source}`) : null)}
          {row(t('contactTitle'), app.contact_name)}
          {row(t('contactPhone'), app.contact_phone)}
          {row(t('contactEmail'), app.contact_email)}
          {row(t('salaryShort'), app.salary !== null ? `${formatEur(app.salary, locale)} ${t(`periodShort_${app.salary_period}`)}` : null)}
          {row(t('notes'), app.notes ? <span className="whitespace-pre-line font-normal">{app.notes}</span> : null)}
        </dl>

        {/* CV e lettera */}
        <section className="flex flex-wrap gap-2">
          <Link href="/app/kumani-cv" className={`${pill} border border-[var(--gold)]/50 bg-white text-[var(--ink)]`}>
            <FileText className="h-4 w-4" aria-hidden="true" /> {t('openCv')}
          </Link>
          <Link href="/app/lettera-presentazione" className={`${pill} border border-[var(--gold)]/50 bg-white text-[var(--ink)]`}>
            <Mail className="h-4 w-4" aria-hidden="true" /> {t('openLetter')}
          </Link>
        </section>

        {/* Storico dei cambi di stato */}
        <section>
          <h4 className="mb-2 text-sm font-bold text-[var(--ink)]">{t('historyTitle')}</h4>
          {events === null ? (
            <LoaderCircle className="h-5 w-5 animate-spin text-[var(--muted)]" aria-label={t('loading')} />
          ) : events.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t('historyEmpty')}</p>
          ) : (
            <ol className="space-y-2 border-l-2 border-[var(--gold)]/40 pl-4">
              {events.map((ev) => (
                <li key={ev.id} className="relative text-sm">
                  <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--gold)]" aria-hidden="true" />
                  <span className="font-semibold text-[var(--ink)]">{ev.from_status ? t(`status_${ev.to_status}`) : t('historyCreated', { status: t(`status_${ev.to_status}`) })}</span>
                  <span className="block text-xs text-[var(--muted)]">{formatDateTime(ev.created_at, locale)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-4">
          <button type="button" onClick={remove} disabled={!!busy} className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('delete')}
          </button>
          <button type="button" onClick={onEdit} className={`${pill} bg-[var(--ink)] px-5 text-white`}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> {t('edit')}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

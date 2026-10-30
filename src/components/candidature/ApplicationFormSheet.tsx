'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarClock, LoaderCircle, Save } from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'
import { saveApplication } from '@/app/actions/candidature'
import { limitTextOf } from '@/lib/limitText'
import {
  APPLICATION_LIMITS,
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  FOLLOW_UP_AFTER_DAYS,
  SALARY_PERIODS,
  addDays,
  dateToRomeLocal,
  formatDay,
  romeToday,
  type ApplicationForm,
  type JobApplication,
} from '@/lib/candidature'
import { input, label, primary } from './styles'

function toForm(app: JobApplication | null): ApplicationForm {
  return {
    company: app?.company ?? '',
    role: app?.role ?? '',
    city: app?.city ?? '',
    source: app?.source ?? '',
    adUrl: app?.ad_url ?? '',
    contactName: app?.contact_name ?? '',
    contactEmail: app?.contact_email ?? '',
    contactPhone: app?.contact_phone ?? '',
    sentOn: app?.sent_on ?? (app ? '' : romeToday()),
    status: app?.status ?? 'sent',
    interviewAt: dateToRomeLocal(app?.interview_at ?? null),
    followUpOn: app?.follow_up_on ?? '',
    notes: app?.notes ?? '',
    salary: app?.salary !== null && app?.salary !== undefined ? String(app.salary).replace('.', ',') : '',
    salaryPeriod: app?.salary_period ?? 'month',
  }
}

// Nuova candidatura o modifica: una finestra dal basso su telefono
export default function ApplicationFormSheet({
  application,
  onClose,
  onSaved,
}: {
  application: JobApplication | null
  onClose: () => void
  onSaved: (app: JobApplication, isNew: boolean) => void
}) {
  const t = useTranslations('candidature')
  const locale = useLocale()
  const [form, setForm] = useState<ApplicationForm>(() => toForm(application))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Proposta di richiamo: 10 giorni dopo l'invio (o oggi se sono già passati)
  const today = romeToday()
  const proposed =
    form.status === 'sent' && !form.followUpOn && form.sentOn
      ? (() => {
          const day = addDays(form.sentOn, FOLLOW_UP_AFTER_DAYS)
          return day < today ? today : day
        })()
      : null
  const needsInterview = form.status === 'interview_set' && !form.interviewAt

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await saveApplication(application?.id ?? null, form)
    setBusy(false)
    if (result.success) onSaved(result.data, !application)
    else setError(limitTextOf(result) ?? (t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError')))
  }

  return (
    <Sheet title={application ? t('editTitle') : t('newTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={label} htmlFor="ca-company">
            {t('company')} *
          </label>
          <input
            id="ca-company"
            className={input}
            value={form.company}
            maxLength={APPLICATION_LIMITS.company}
            onChange={(e) => set('company', e.target.value)}
            autoFocus={!application}
            required
            placeholder={t('companyPlaceholder')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="ca-role">
              {t('role')}
            </label>
            <input id="ca-role" className={input} value={form.role} maxLength={APPLICATION_LIMITS.role} onChange={(e) => set('role', e.target.value)} placeholder={t('rolePlaceholder')} />
          </div>
          <div>
            <label className={label} htmlFor="ca-city">
              {t('city')}
            </label>
            <input id="ca-city" className={input} value={form.city} maxLength={APPLICATION_LIMITS.city} onChange={(e) => set('city', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="ca-status">
              {t('status')}
            </label>
            <select id="ca-status" className={input} value={form.status} onChange={(e) => set('status', e.target.value as ApplicationForm['status'])}>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status_${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ca-sent">
              {t('sentOn')}
            </label>
            <input id="ca-sent" type="date" className={input} value={form.sentOn} onChange={(e) => set('sentOn', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="ca-interview">
              {t('interviewAt')}
            </label>
            <input id="ca-interview" type="datetime-local" className={input} value={form.interviewAt} onChange={(e) => set('interviewAt', e.target.value)} />
            {needsInterview && <p className="mt-1 text-xs font-semibold text-[#8a6a1f]">{t('interviewHint')}</p>}
          </div>
          <div>
            <label className={label} htmlFor="ca-follow">
              {t('followUpOn')}
            </label>
            <input id="ca-follow" type="date" className={input} value={form.followUpOn} onChange={(e) => set('followUpOn', e.target.value)} />
            {proposed && (
              <button
                type="button"
                onClick={() => set('followUpOn', proposed)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/50 bg-[var(--gold-pale)] px-3 py-1.5 text-xs font-bold text-[var(--ink)]"
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {t('proposeFollowUp', { date: formatDay(proposed, locale, true) })}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="ca-source">
              {t('source')}
            </label>
            <select id="ca-source" className={input} value={form.source} onChange={(e) => set('source', e.target.value as ApplicationForm['source'])}>
              <option value="">—</option>
              {APPLICATION_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`source_${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ca-url">
              {t('adUrl')}
            </label>
            <input
              id="ca-url"
              type="url"
              inputMode="url"
              className={input}
              value={form.adUrl}
              maxLength={APPLICATION_LIMITS.adUrl}
              onChange={(e) => set('adUrl', e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>

        <fieldset className="rounded-2xl border border-gray-200 p-3">
          <legend className="px-1 text-sm font-bold text-[var(--ink)]">{t('contactTitle')}</legend>
          <div className="space-y-3">
            <div>
              <label className={label} htmlFor="ca-cname">
                {t('contactName')}
              </label>
              <input id="ca-cname" className={input} value={form.contactName} maxLength={APPLICATION_LIMITS.contactName} onChange={(e) => set('contactName', e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="ca-cemail">
                  {t('contactEmail')}
                </label>
                <input
                  id="ca-cemail"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  className={input}
                  value={form.contactEmail}
                  maxLength={APPLICATION_LIMITS.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="ca-cphone">
                  {t('contactPhone')}
                </label>
                <input
                  id="ca-cphone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  className={input}
                  value={form.contactPhone}
                  maxLength={APPLICATION_LIMITS.contactPhone}
                  onChange={(e) => set('contactPhone', e.target.value)}
                />
              </div>
            </div>
          </div>
        </fieldset>

        <div>
          <label className={label} htmlFor="ca-salary">
            {t('salary')}
          </label>
          <div className="flex gap-2">
            <input
              id="ca-salary"
              inputMode="decimal"
              className={input}
              value={form.salary}
              maxLength={20}
              onChange={(e) => set('salary', e.target.value)}
              placeholder={t('salaryPlaceholder')}
            />
            <select aria-label={t('salaryPeriod')} className={`${input} max-w-[45%]`} value={form.salaryPeriod} onChange={(e) => set('salaryPeriod', e.target.value as ApplicationForm['salaryPeriod'])}>
              {SALARY_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`period_${p}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="ca-notes">
            {t('notes')}
          </label>
          <textarea
            id="ca-notes"
            rows={4}
            className={input}
            value={form.notes}
            maxLength={APPLICATION_LIMITS.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={t('notesPlaceholder')}
          />
        </div>

        {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p>}

        <div className="flex gap-2">
          <CancelButton className={cancelButtonLgClass} />
          <button type="submit" disabled={busy} className={primary}>
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Save className="h-5 w-5" aria-hidden="true" />}
            {t('save')}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

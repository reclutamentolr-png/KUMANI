'use client'

import { useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'
import { limitTextOf } from '@/lib/limitText'
import { duplicateReport, saveReport, setReportStatus } from '@/app/actions/noteSpese'
import { EXPENSE_LIMITS, centsToInput, romeToday, type ExpenseReport, type ReportFormData, type ReportStatus } from '@/lib/noteSpese'
import { input, label, primary } from './shared'

type Result = { success: true; data: ExpenseReport } | { success: false; message: string }

function useSave(onDone: (report: ExpenseReport) => void) {
  const t = useTranslations('noteSpese')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Doppio tocco: una sola nota (o una sola copia)
  const running = useRef(false)
  const run = async (action: () => Promise<Result>) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(null)
    // Rete caduta: si dice, la finestra non resta bloccata
    const result: Result = await action().catch(() => ({ success: false as const, message: 'saveError' }))
    running.current = false
    setBusy(false)
    if (result.success) onDone(result.data)
    else setError(limitTextOf(result) ?? (t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError')))
  }
  return { busy, error, run }
}

function Footer({ busy, error, submitLabel }: { busy: boolean; error: string | null; submitLabel: string }) {
  return (
    <>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} />
        <button type="submit" className={primary} disabled={busy}>
          {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </>
  )
}

// Nuova nota spese o modifica dei dati (titolo, periodo, per chi, anticipo)
export function ReportSheet({
  report,
  suggestion,
  onSaved,
  onClose,
}: {
  report: ExpenseReport | null
  suggestion: { employeeName: string; recipient: string }
  onSaved: (report: ExpenseReport) => void
  onClose: () => void
}) {
  const t = useTranslations('noteSpese')
  const locale = useLocale()
  const [form, setForm] = useState<ReportFormData>(() => ({
    title: report?.title ?? '',
    employeeName: report ? (report.employee_name ?? '') : suggestion.employeeName,
    recipient: report ? (report.recipient ?? '') : suggestion.recipient,
    periodFrom: report ? (report.period_from ?? '') : romeToday(),
    periodTo: report?.period_to ?? '',
    advance: report?.advance_cents ? centsToInput(report.advance_cents, locale) : '',
    notes: report?.notes ?? '',
  }))
  const { busy, error, run } = useSave(onSaved)
  const set = (key: keyof ReportFormData, value: string) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <Sheet title={report ? t('reportEditTitle') : t('reportNewTitle')} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => saveReport(report?.id ?? null, form))
        }}
      >
        <div>
          <label className={label} htmlFor="ns-title">
            {t('fieldTitle')}
          </label>
          <input id="ns-title" className={input} value={form.title} maxLength={EXPENSE_LIMITS.title} onChange={(e) => set('title', e.target.value)} placeholder={t('fieldTitlePlaceholder')} required autoFocus={!report} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label} htmlFor="ns-pfrom">
              {t('fieldPeriodFrom')}
            </label>
            <input id="ns-pfrom" type="date" className={input} value={form.periodFrom} onChange={(e) => set('periodFrom', e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="ns-pto">
              {t('fieldPeriodTo')}
            </label>
            <input id="ns-pto" type="date" className={input} value={form.periodTo} min={form.periodFrom || undefined} onChange={(e) => set('periodTo', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="ns-emp">
            {t('fieldEmployee')}
          </label>
          <input id="ns-emp" className={input} value={form.employeeName} maxLength={EXPENSE_LIMITS.employeeName} onChange={(e) => set('employeeName', e.target.value)} placeholder={t('fieldEmployeePlaceholder')} autoComplete="name" />
        </div>
        <div>
          <label className={label} htmlFor="ns-rec">
            {t('fieldRecipient')}
          </label>
          <input id="ns-rec" className={input} value={form.recipient} maxLength={EXPENSE_LIMITS.recipient} onChange={(e) => set('recipient', e.target.value)} placeholder={t('fieldRecipientPlaceholder')} />
        </div>
        <div>
          <label className={label} htmlFor="ns-adv">
            {t('fieldAdvance')}
          </label>
          <input id="ns-adv" className={input} inputMode="decimal" value={form.advance} onChange={(e) => set('advance', e.target.value)} placeholder="0,00" />
          <p className="mt-1 text-xs text-[var(--muted)]">{t('fieldAdvanceHelp')}</p>
        </div>
        <div>
          <label className={label} htmlFor="ns-notes">
            {t('fieldNotes')}
          </label>
          <textarea id="ns-notes" className={`${input} min-h-[70px]`} value={form.notes} maxLength={EXPENSE_LIMITS.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('fieldNotesPlaceholder')} />
        </div>
        <Footer busy={busy} error={error} submitLabel={report ? t('save') : t('reportCreate')} />
      </form>
    </Sheet>
  )
}

// Cambio di stato con la data (consegnata il…, rimborsata il…)
export function StatusSheet({ report, status, onSaved, onClose }: { report: ExpenseReport; status: ReportStatus; onSaved: (report: ExpenseReport) => void; onClose: () => void }) {
  const t = useTranslations('noteSpese')
  const [day, setDay] = useState(romeToday())
  const { busy, error, run } = useSave(onSaved)
  return (
    <Sheet title={t(`statusSheet_${status}`)} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => setReportStatus(report.id, status, day))
        }}
      >
        <p className="text-sm text-[var(--muted)]">{t(`statusSheetText_${status}`)}</p>
        {status !== 'open' && (
          <div>
            <label className={label} htmlFor="ns-sday">
              {t('fieldStatusDate')}
            </label>
            <input id="ns-sday" type="date" className={input} value={day} onChange={(e) => setDay(e.target.value)} required />
          </div>
        )}
        <Footer busy={busy} error={error} submitLabel={t('confirm')} />
      </form>
    </Sheet>
  )
}

// Duplica per una trasferta che si ripete
export function DuplicateSheet({ report, onSaved, onClose }: { report: ExpenseReport; onSaved: (report: ExpenseReport) => void; onClose: () => void }) {
  const t = useTranslations('noteSpese')
  const [title, setTitle] = useState(t('duplicateDefaultTitle', { title: report.title }).slice(0, EXPENSE_LIMITS.title))
  const [start, setStart] = useState(romeToday())
  const { busy, error, run } = useSave(onSaved)
  return (
    <Sheet title={t('duplicateTitle')} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => duplicateReport(report.id, title, start))
        }}
      >
        <p className="text-sm text-[var(--muted)]">{t('duplicateText')}</p>
        <div>
          <label className={label} htmlFor="ns-dtitle">
            {t('fieldTitle')}
          </label>
          <input id="ns-dtitle" className={input} value={title} maxLength={EXPENSE_LIMITS.title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className={label} htmlFor="ns-dstart">
            {t('duplicateStart')}
          </label>
          <input id="ns-dstart" type="date" className={input} value={start} onChange={(e) => setStart(e.target.value)} required />
          <p className="mt-1 text-xs text-[var(--muted)]">{t('duplicateStartHelp')}</p>
        </div>
        <Footer busy={busy} error={error} submitLabel={t('duplicateConfirm')} />
      </form>
    </Sheet>
  )
}

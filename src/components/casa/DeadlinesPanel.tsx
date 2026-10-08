'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CalendarClock, Check, LoaderCircle, Pencil, Plus, RotateCcw, ShieldCheck, Trash2, Wrench } from 'lucide-react'
import { completeDeadline, deleteDeadline, saveDeadline } from '@/app/actions/casa'
import { DEADLINE_RECURRENCES, MAINTENANCE_PRESETS, type CasaDeadline, type DeadlineForm } from '@/lib/casa'
import { addDays, daysBetween } from '@/lib/agenda'
import { askConfirm } from '@/lib/confirm'
import { Sheet, card, ghostBtn, input, label, primaryBtn, useAction, useFormat } from '@/components/casa/shared'

const emptyForm = (today: string): DeadlineForm => ({ title: '', dueDate: addDays(today, 30), recurrence: 'yearly', customDays: null, notes: '', category: 'home' })

export default function DeadlinesPanel({ homeId, deadlines, today }: { homeId: string; deadlines: CasaDeadline[]; today: string }) {
  const t = useTranslations('casa')
  const f = useFormat()
  const { run, isPending, error, setError } = useAction()
  const [editing, setEditing] = useState<{ id?: string; form: DeadlineForm } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const open = (deadline?: CasaDeadline) => {
    setError(null)
    setEditing(
      deadline
        ? {
            id: deadline.id,
            form: {
              title: deadline.title,
              dueDate: deadline.due_date,
              recurrence: deadline.recurrence,
              customDays: deadline.recurrence_custom_days,
              notes: deadline.notes ?? '',
              category: deadline.category === 'contracts' ? 'contracts' : 'home',
            },
          }
        : { form: emptyForm(today) }
    )
  }
  const set = <K extends keyof DeadlineForm>(key: K, value: DeadlineForm[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e))

  const recurrenceText = (d: CasaDeadline) =>
    d.recurrence === 'custom' ? t('recurrenceEveryDays', { days: d.recurrence_custom_days ?? 0 }) : t(`recurrence_${d.recurrence}`)

  const done = async (d: CasaDeadline) => {
    const ok = await askConfirm(d.recurrence === 'none' ? t('completeConfirm', { name: d.title }) : t('renewConfirm', { name: d.title }))
    if (!ok) return
    setBusyId(d.id)
    run(() => completeDeadline(d.id), () => setBusyId(null))
  }
  const remove = async (d: CasaDeadline) => {
    if (!(await askConfirm(t('deleteDeadlineConfirm', { name: d.title })))) return
    setBusyId(d.id)
    run(() => deleteDeadline(d.id), () => setBusyId(null))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">{t('deadlinesIntro')}</p>
        <button type="button" onClick={() => open()} className={primaryBtn}>
          <Plus className="h-4 w-4" /> {t('addDeadline')}
        </button>
      </div>

      {deadlines.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-white px-6 py-8 text-center">
          <Wrench className="mx-auto h-9 w-9 text-[var(--gold)]" />
          <p className="mt-2 font-bold text-[var(--ink)]">{t('deadlinesEmptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t('deadlinesEmptyText')}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {deadlines.map((d) => {
            const days = daysBetween(today, d.due_date)
            const overdue = days < 0
            const soon = !overdue && days <= 30
            return (
              <li key={d.id} className={`${card} flex flex-wrap items-center gap-3 !p-4`}>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    overdue ? 'bg-red-50 text-red-600' : soon ? 'bg-amber-50 text-amber-600' : 'bg-[var(--gold-pale)] text-[var(--gold)]'
                  }`}
                >
                  {overdue ? <AlertTriangle className="h-5 w-5" /> : d.category === 'warranties' ? <ShieldCheck className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
                </span>
                {/* Con poco spazio i pulsanti vanno a capo: il titolo resta intero */}
                <div className="min-w-[11rem] flex-1">
                  <p className="break-words font-bold text-[var(--ink)]">{d.title}</p>
                  <p className={`text-sm ${overdue ? 'font-semibold text-red-600' : 'text-[var(--muted)]'}`}>
                    {f.date(d.due_date)} · {overdue ? t('overdueDays', { days: -days }) : days === 0 ? t('today') : t('inDays', { days })} · {recurrenceText(d)}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => done(d)}
                    disabled={isPending && busyId === d.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {d.recurrence === 'none' ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />} {d.recurrence === 'none' ? t('markDone') : t('markRenewed')}
                  </button>
                  <button type="button" onClick={() => open(d)} aria-label={t('edit')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(d)} aria-label={t('delete')} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && !editing && <p className="text-sm text-red-600">{error}</p>}

      {editing && (
        <Sheet title={editing.id ? t('editDeadline') : t('addDeadline')} onClose={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(() => saveDeadline(homeId, editing.form, editing.id), () => setEditing(null))
            }}
            className="space-y-4"
          >
            {!editing.id && (
              <div>
                <span className={label}>{t('presetsTitle')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {MAINTENANCE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setEditing((e) =>
                          e ? { ...e, form: { ...e.form, title: t(`preset_${p.id}`), recurrence: p.recurrence, customDays: p.customDays ?? null, category: p.category } } : e
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        editing.form.title === t(`preset_${p.id}`) ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'
                      }`}
                    >
                      {t(`preset_${p.id}`)}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-[var(--muted)]">{t('presetsHint')}</p>
              </div>
            )}
            <div>
              <label className={label} htmlFor="dl-title">
                {t('deadlineTitle')}
              </label>
              <input id="dl-title" className={input} value={editing.form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="dl-date">
                  {t('dueDate')}
                </label>
                <input id="dl-date" type="date" className={input} value={editing.form.dueDate} onChange={(e) => set('dueDate', e.target.value)} required />
              </div>
              <div>
                <label className={label} htmlFor="dl-rec">
                  {t('recurrence')}
                </label>
                <select id="dl-rec" className={input} value={editing.form.recurrence} onChange={(e) => set('recurrence', e.target.value as DeadlineForm['recurrence'])}>
                  {DEADLINE_RECURRENCES.map((r) => (
                    <option key={r} value={r}>
                      {t(`recurrence_${r}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {editing.form.recurrence === 'custom' && (
              <div>
                <label className={label} htmlFor="dl-days">
                  {t('customDays')}
                </label>
                <input
                  id="dl-days"
                  type="number"
                  min={1}
                  max={3650}
                  className={input}
                  value={editing.form.customDays ?? ''}
                  onChange={(e) => set('customDays', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            )}
            <div>
              <label className={label} htmlFor="dl-notes">
                {t('notes')}
              </label>
              <textarea id="dl-notes" className={`${input} min-h-[70px]`} value={editing.form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} placeholder={t('deadlineNotesPlaceholder')} />
            </div>
            <p className="rounded-xl bg-[var(--paper)] px-3 py-2 text-xs text-[var(--muted)]">{t('deadlineReminderHint')}</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className={`${ghostBtn} flex-1`}>
                {t('cancel')}
              </button>
              <button type="submit" disabled={isPending} className={`${primaryBtn} flex-1`}>
                {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('save')}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  )
}

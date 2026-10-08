'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, FileBadge, LoaderCircle, Trash2, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { suggestLifeCalendarCategory } from '@/lib/lifeCalendarHints'
import { deleteAppointment, deleteContact, deleteNote, deleteTask, saveAppointment, saveContact, saveNote, saveTask } from '@/app/actions/memolife'
import { askConfirm } from '@/lib/confirm'
import CancelButton, { SheetCloseContext } from '@/components/ui/CancelButton'

// Moduli di MemoLife in una finestra (dal basso su telefono). Salvano con le
// azioni del server; "onDone" ricarica i dati.

type Result = { success: true } | { success: false; message: string }

const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--ink)]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100" aria-label="×">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* «Annulla» dei moduli dentro la finestra la chiude */}
        <SheetCloseContext.Provider value={onClose}>{children}</SheetCloseContext.Provider>
      </div>
    </div>
  )
}

function useSubmit(onDone: () => void) {
  const t = useTranslations('agenda')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<Result>) => {
    setBusy(true)
    setError(null)
    const result = await action()
    setBusy(false)
    if (result.success) onDone()
    else setError(result.message === 'invalid' ? t('errorInvalid') : t('errorSave'))
  }
  return { busy, error, run }
}

function Actions({ busy, error, onDelete, deleteConfirm }: { busy: boolean; error: string | null; onDelete?: () => void; deleteConfirm?: string }) {
  const t = useTranslations('agenda')
  return (
    <>
      {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p>}
      <div className="mt-5 flex items-center justify-between gap-2">
        {onDelete ? (
          <button
            type="button"
            onClick={async () => (!deleteConfirm || (await askConfirm(deleteConfirm))) && onDelete()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> {t('delete')}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <CancelButton />
          <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-2.5 font-bold text-[var(--ink)] shadow-md hover:brightness-110 disabled:opacity-50">
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('save')}
          </button>
        </div>
      </div>
    </>
  )
}

export type AppointmentDraft = { id?: string; title: string; date: string; time: string; description: string }

export function AppointmentForm({ draft, onDone }: { draft: AppointmentDraft; onDone: () => void }) {
  const t = useTranslations('agenda')
  const [form, setForm] = useState(draft)
  const { busy, error, run } = useSubmit(onDone)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveAppointment(form))
      }}
      className="space-y-4"
    >
      <div>
        <label className={label}>{t('fieldTitle')}</label>
        <input className={input} value={form.title} maxLength={200} required autoFocus placeholder={t('appointmentPlaceholder')} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('fieldDate')}</label>
          <input type="date" className={input} value={form.date} required onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <label className={label}>{t('fieldTime')}</label>
          <input type="time" className={input} value={form.time} required onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={label}>{t('fieldNotes')}</label>
        <textarea className={input} rows={2} value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <Actions busy={busy} error={error} deleteConfirm={t('deleteConfirm')} onDelete={form.id ? () => run(() => deleteAppointment(form.id!)) : undefined} />
    </form>
  )
}

export type TaskDraft = { id?: string; title: string; dueDate: string; priority: string; description: string }

export function TaskForm({ draft, onDone, lifeCalendar }: { draft: TaskDraft; onDone: () => void; lifeCalendar?: boolean }) {
  const t = useTranslations('agenda')
  const [form, setForm] = useState(draft)
  // «Patente», «revisione», «assicurazione»…: è una scadenza da rinnovare, va in Life Calendar
  const deadline = lifeCalendar && !form.id ? suggestLifeCalendarCategory(form.title) : null
  const { busy, error, run } = useSubmit(onDone)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveTask(form))
      }}
      className="space-y-4"
    >
      <div>
        <label className={label}>{t('fieldTitle')}</label>
        <input className={input} value={form.title} maxLength={200} required autoFocus placeholder={t('taskPlaceholder')} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        {deadline && (
          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <p className="flex items-start gap-2">
              <FileBadge className="mt-0.5 h-4 w-4 shrink-0" /> {t('lifeCalendarHint')}
            </p>
            <Link
              href={`/marketplace/life-calendar/new?title=${encodeURIComponent(form.title.trim())}&category=${deadline}${form.dueDate ? `&due=${form.dueDate}` : ''}`}
              className="mt-2 inline-flex items-center gap-1 font-semibold text-rose-800 hover:text-rose-950"
            >
              {t('lifeCalendarHintCta')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('fieldDueDateOptional')}</label>
          <input type="date" className={input} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
        <div>
          <label className={label}>{t('fieldPriority')}</label>
          <select className={input} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">{t('priority_low')}</option>
            <option value="medium">{t('priority_medium')}</option>
            <option value="high">{t('priority_high')}</option>
          </select>
        </div>
      </div>
      <div>
        <label className={label}>{t('fieldNotes')}</label>
        <textarea className={input} rows={2} value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <Actions busy={busy} error={error} deleteConfirm={t('deleteConfirm')} onDelete={form.id ? () => run(() => deleteTask(form.id!)) : undefined} />
    </form>
  )
}

export type NoteDraft = { id?: string; title: string; content: string }

export function NoteForm({ draft, onDone }: { draft: NoteDraft; onDone: () => void }) {
  const t = useTranslations('agenda')
  const [form, setForm] = useState(draft)
  const { busy, error, run } = useSubmit(onDone)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveNote(form))
      }}
      className="space-y-4"
    >
      <input className={input} value={form.title} maxLength={200} placeholder={t('noteTitlePlaceholder')} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea className={`${input} min-h-40`} rows={7} value={form.content} maxLength={10000} required autoFocus placeholder={t('noteContentPlaceholder')} onChange={(e) => setForm({ ...form, content: e.target.value })} />
      <Actions busy={busy} error={error} deleteConfirm={t('deleteConfirm')} onDelete={form.id ? () => run(() => deleteNote(form.id!)) : undefined} />
    </form>
  )
}

export type ContactDraft = { id?: string; name: string; phone: string; email: string; company: string; notes: string }

export function ContactForm({ draft, onDone }: { draft: ContactDraft; onDone: () => void }) {
  const t = useTranslations('agenda')
  const [form, setForm] = useState(draft)
  const { busy, error, run } = useSubmit(onDone)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveContact(form))
      }}
      className="space-y-4"
    >
      <div>
        <label className={label}>{t('fieldName')}</label>
        <input className={input} value={form.name} maxLength={120} required autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('fieldPhone')}</label>
          <input type="tel" className={input} value={form.phone} maxLength={40} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className={label}>{t('fieldEmail')}</label>
          <input type="email" className={input} value={form.email} maxLength={200} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={label}>{t('fieldCompany')}</label>
        <input className={input} value={form.company} maxLength={120} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      </div>
      <div>
        <label className={label}>{t('fieldNotes')}</label>
        <textarea className={input} rows={2} value={form.notes} maxLength={2000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <Actions busy={busy} error={error} deleteConfirm={t('deleteConfirm')} onDelete={form.id ? () => run(() => deleteContact(form.id!)) : undefined} />
    </form>
  )
}

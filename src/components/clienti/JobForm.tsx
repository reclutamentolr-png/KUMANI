'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { CLIENT_LIMITS, formatEur, type ClientQuote, type JobFormData } from '@/lib/clienti'
import { inputClass } from './ClientForm'

const labelClass = 'block text-sm font-semibold text-[var(--muted)]'

// Dati del lavoro: nuovo (anche da un preventivo) o da modificare
export default function JobForm({
  initial,
  quotes,
  submitLabel,
  withNotes,
  initialNotes = '',
  onSubmit,
  onCancel,
}: {
  initial: JobFormData
  quotes: ClientQuote[]
  submitLabel: string
  withNotes?: boolean
  initialNotes?: string
  onSubmit: (form: JobFormData, notes: string) => Promise<string | null>
  onCancel: () => void
}) {
  const t = useTranslations('clienti')
  const locale = useLocale()
  const [form, setForm] = useState<JobFormData>(initial)
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<JobFormData>) => setForm((prev) => ({ ...prev, ...patch }))

  // Scegliendo un preventivo: titolo e prezzo proposti se ancora vuoti
  const pickQuote = (quoteId: string) => {
    const quote = quotes.find((q) => q.id === quoteId)
    set({
      quoteId,
      ...(quote && !form.title.trim() ? { title: quote.subject || t('quoteNumber', { number: quote.quote_number }) } : {}),
      ...(quote && !form.amount.trim() ? { amount: String(quote.gross).replace('.', ',') } : {}),
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError(t('errors.titleRequired'))
      return
    }
    setSaving(true)
    setError(null)
    const message = await onSubmit(form, notes)
    setSaving(false)
    if (message) setError(message)
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        {quotes.length > 0 && (
          <label className={`${labelClass} sm:col-span-2`}>
            {t('jobs.fromQuote')}
            <select value={form.quoteId} onChange={(e) => pickQuote(e.target.value)} className={inputClass}>
              <option value="">{t('jobs.noQuote')}</option>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {t('quoteNumber', { number: q.quote_number })}
                  {q.subject ? ` · ${q.subject}` : ''} · {formatEur(q.gross, locale)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={`${labelClass} sm:col-span-2`}>
          {t('jobs.title')}
          <span aria-hidden="true"> *</span>
          <input value={form.title} maxLength={CLIENT_LIMITS.jobTitle} required onChange={(e) => set({ title: e.target.value })} placeholder={t('jobs.titlePlaceholder')} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('jobs.amount')}
          <input inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0,00" className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('jobs.address')}
          <input value={form.address} maxLength={CLIENT_LIMITS.address} onChange={(e) => set({ address: e.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('jobs.startDate')}
          <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t('jobs.dueDate')}
          <input type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} className={inputClass} />
        </label>
        {withNotes && (
          <label className={`${labelClass} sm:col-span-2`}>
            {t('notesTitle')}
            <textarea
              rows={3}
              value={notes}
              maxLength={CLIENT_LIMITS.notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-[var(--gold)]/35 bg-white p-3 text-base text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
            />
          </label>
        )}
      </div>
      <p className="text-xs text-[var(--muted)]">{t('jobs.amountHint')}</p>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-[var(--gold-bright)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-[var(--gold)]/40 bg-white px-5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}

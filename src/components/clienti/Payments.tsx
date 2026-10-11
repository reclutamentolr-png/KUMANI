'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FileCheck2, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { askConfirm } from '@/lib/confirm'
import { addPayment, deletePayment } from '@/app/actions/clienti'
import { CLIENT_LIMITS, PAYMENT_METHODS, formatEur, romeToday, type ClientJob, type ClientPayment, type ClientQuote, type PaymentFormData } from '@/lib/clienti'
import { inputClass } from './ClientForm'

const labelClass = 'block text-sm font-semibold text-[var(--muted)]'

// Pagamenti del cliente (o di un lavoro): quelli registrati a mano più
// quelli online dei Preventivi, con il modulo per registrarne uno nuovo
export default function Payments({
  clientId,
  payments,
  onlineQuotes,
  jobs,
  fixedJobId,
  suggestedAmount,
  canReceipt = false,
  onChange,
}: {
  canReceipt?: boolean
  clientId: string
  payments: ClientPayment[]
  onlineQuotes: ClientQuote[]
  jobs: ClientJob[]
  fixedJobId?: string
  suggestedAmount?: number
  onChange: (payments: ClientPayment[]) => void
}) {
  const t = useTranslations('clienti')
  const locale = useLocale()
  const empty = (): PaymentFormData => ({
    amount: suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount).replace('.', ',') : '',
    paidOn: romeToday(),
    method: 'transfer',
    jobId: fixedJobId ?? '',
    note: '',
  })
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PaymentFormData>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<PaymentFormData>) => setForm((prev) => ({ ...prev, ...patch }))
  const formatDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  const jobTitle = (id: string | null) => (id ? jobs.find((j) => j.id === id)?.title : null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await addPayment(clientId, form)
    setSaving(false)
    if (!result.success) {
      setError(t(`errors.${result.message === 'amountInvalid' ? 'amountInvalid' : 'saveError'}`))
      return
    }
    onChange([result.data, ...payments].sort((a, b) => b.paid_on.localeCompare(a.paid_on)))
    setOpen(false)
  }

  const remove = async (p: ClientPayment) => {
    if (!(await askConfirm(t('pay.deleteConfirm', { amount: formatEur(p.amount, locale) })))) return
    const result = await deletePayment(p.id)
    if (result.success) onChange(payments.filter((x) => x.id !== p.id))
    else setError(t('errors.saveError'))
  }

  const rows = [
    ...payments.map((p) => ({ key: p.id, day: p.paid_on, amount: p.amount, label: [t(`pay.methods.${p.method}`), jobTitle(p.job_id), p.note].filter(Boolean).join(' · '), payment: p })),
    ...onlineQuotes.map((q) => ({ key: `q-${q.id}`, day: (q.paid_at ?? q.issue_date).slice(0, 10), amount: q.paid_amount, label: `${t('pay.online')} · ${t('quoteNumber', { number: q.quote_number })}`, payment: null })),
  ]

  return (
    <div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{t('pay.none')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--gold)]/15">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold text-[var(--ink)]">{r.label}</span>
                <span className="block text-xs text-[var(--muted)]">{formatDay(r.day)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="font-extrabold text-[#1d6b34]">{formatEur(r.amount, locale)}</span>
                {r.payment?.receipt_id ? (
                  <Link
                    href={`/marketplace/digital-receipt/${r.payment.receipt_id}`}
                    aria-label={t('receipt.open')}
                    title={t('receipt.open')}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[#1d6b34] hover:bg-[#e7f4ea]"
                  >
                    <FileCheck2 className="h-4 w-4" />
                  </Link>
                ) : r.payment && canReceipt ? (
                  <Link
                    href={`/marketplace/digital-receipt/new?fromPayment=${r.payment.id}`}
                    aria-label={t('receipt.make')}
                    title={t('receipt.make')}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--gold-pale)] hover:text-[var(--ink)]"
                  >
                    <FileCheck2 className="h-4 w-4" />
                  </Link>
                ) : null}
                {r.payment && (
                  <button
                    type="button"
                    onClick={() => remove(r.payment!)}
                    aria-label={t('pay.delete')}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl bg-[var(--background)] p-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              {t('pay.amount')}
              <input inputMode="decimal" required value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0,00" className={inputClass} />
            </label>
            <label className={labelClass}>
              {t('pay.date')}
              <input type="date" value={form.paidOn} onChange={(e) => set({ paidOn: e.target.value })} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t('pay.method')}
              <select value={form.method} onChange={(e) => set({ method: e.target.value as PaymentFormData['method'] })} className={inputClass}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(`pay.methods.${m}`)}
                  </option>
                ))}
              </select>
            </label>
            {!fixedJobId && jobs.length > 0 && (
              <label className={labelClass}>
                {t('pay.job')}
                <select value={form.jobId} onChange={(e) => set({ jobId: e.target.value })} className={inputClass}>
                  <option value="">{t('pay.noJob')}</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={`${labelClass} sm:col-span-2`}>
              {t('pay.note')}
              <input value={form.note} maxLength={CLIENT_LIMITS.paymentNote} onChange={(e) => set({ note: e.target.value })} placeholder={t('pay.notePlaceholder')} className={inputClass} />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || !form.amount.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-50"
            >
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t('pay.save')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-[var(--gold)]/40 bg-white px-5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setForm(empty())
            setError(null)
            setOpen(true)
          }}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-white px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('pay.add')}
        </button>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { deleteExpense, saveExpense } from '@/app/actions/travel'
import { CURRENCIES, EXPENSE_CATEGORIES, EXPENSE_EMOJI, type TripExpense, type TripMember } from '@/lib/travel'

const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

// Nuova spesa o modifica: chi ha pagato, quanto, in che valuta (con il cambio
// verso la valuta del viaggio) e tra chi dividerla.
export default function TravelExpenseForm({
  tripId,
  baseCurrency,
  members,
  myMemberId,
  expense,
  today,
  canDelete,
  onDone,
}: {
  tripId: string
  baseCurrency: string
  members: TripMember[]
  myMemberId: string
  expense: TripExpense | null
  today: string
  canDelete: boolean
  onDone: () => void
}) {
  const t = useTranslations('travel')
  const [form, setForm] = useState({
    description: expense?.description ?? '',
    amount: expense ? String(expense.amount).replace('.', ',') : '',
    currency: expense?.currency ?? baseCurrency,
    rate: expense && expense.currency !== baseCurrency ? String(expense.rate_to_base).replace('.', ',') : '',
    category: expense?.category ?? 'food',
    spentOn: expense?.spent_on ?? today,
    paidBy: expense?.paid_by ?? myMemberId,
    splitBetween: expense?.split_between ?? members.map((m) => m.id),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))
  const toggle = (id: string) =>
    set('splitBetween', form.splitBetween.includes(id) ? form.splitBetween.filter((x) => x !== id) : [...form.splitBetween, id])

  const foreign = form.currency !== baseCurrency
  const currencies = CURRENCIES.includes(form.currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [form.currency, ...CURRENCIES]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount.trim()) return setError(t('error_invalid'))
    if (form.splitBetween.length === 0) return setError(t('error_noSplit'))
    setBusy(true)
    setError(null)
    try {
      const result = await saveExpense(tripId, { ...form, id: expense?.id })
      if (result.success) onDone()
      else setError(t(`error_${result.error}`))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!expense || !confirm(t('deleteExpenseConfirm', { name: expense.description }))) return
    setBusy(true)
    try {
      const result = await deleteExpense(expense.id)
      if (result.success) onDone()
      else setError(t('error_saveError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label}>{t('expenseDescription')}</label>
        <input className={input} value={form.description} maxLength={120} onChange={(e) => set('description', e.target.value)} placeholder={t('expenseDescriptionPlaceholder')} autoFocus />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label className={label}>{t('expenseAmount')}</label>
          <input className={input} value={form.amount} inputMode="decimal" onChange={(e) => set('amount', e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <label className={label}>{t('expenseCurrency')}</label>
          <select className={input} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      {foreign && (
        <div className="rounded-xl bg-[var(--gold-pale)] p-3">
          <label className={label}>{t('expenseRate', { from: form.currency, to: baseCurrency })}</label>
          <input className={input} value={form.rate} inputMode="decimal" onChange={(e) => set('rate', e.target.value)} placeholder="0,92" />
          <p className="mt-1 text-xs text-[var(--muted)]">{t('expenseRateHint')}</p>
        </div>
      )}
      <div>
        <label className={label}>{t('expenseCategory')}</label>
        <div className="grid grid-cols-3 gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set('category', c)}
              className={`rounded-xl border px-2 py-2 text-xs font-semibold ${form.category === c ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-200 bg-white text-gray-700'}`}
            >
              <span className="block text-lg">{EXPENSE_EMOJI[c]}</span>
              {t(`category_${c}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('expensePaidBy')}</label>
          <select className={input} value={form.paidBy} onChange={(e) => set('paidBy', e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.is_me ? ` (${t('me')})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>{t('expenseDate')}</label>
          <input type="date" className={input} value={form.spentOn} onChange={(e) => set('spentOn', e.target.value)} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700">{t('expenseSplit')}</label>
          <button
            type="button"
            onClick={() => set('splitBetween', form.splitBetween.length === members.length ? [] : members.map((m) => m.id))}
            className="text-xs font-semibold text-[var(--gold)]"
          >
            {form.splitBetween.length === members.length ? t('selectNone') : t('selectAll')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const on = form.splitBetween.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-400 line-through'}`}
              >
                {m.name}
              </button>
            )
          })}
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        {expense && canDelete && (
          <button type="button" onClick={remove} disabled={busy} className="flex items-center gap-1 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> {t('delete')}
          </button>
        )}
        <button type="submit" disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:opacity-60">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {t('save')}
        </button>
      </div>
    </form>
  )
}

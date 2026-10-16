'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle, Repeat, Save, X } from 'lucide-react'
import { addSharedExpense, addSharedRecurring, updateSharedExpense } from '@/app/actions/spendlyShared'
import { parseAmount } from '@/lib/spendly'
import { SHARED_CATEGORIES, SHARED_CATEGORY_EMOJI, type SharedCategory, type SharedExpense, type SharedMember } from '@/lib/spendlyShared'

// Nuova spesa (o modifica): chi ha pagato, tra chi si divide (di default tutti).
// «Ripeti ogni mese» la trasforma in spesa fissa: dal mese della data, ogni
// mese lo stesso giorno (affitto, bollette, abbonamenti di casa).
export default function SharedExpenseEditor({
  groupId,
  members,
  myMemberId,
  today,
  expense = null,
  onDone,
}: {
  groupId: string
  members: SharedMember[]
  myMemberId: string
  today: string
  expense?: SharedExpense | null
  onDone: (saved: boolean) => void
}) {
  const t = useTranslations('spendlyShared')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? String(expense.amount).replace('.', ',') : '')
  const [category, setCategory] = useState<SharedCategory>(expense?.category ?? 'spesa_alimentari')
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? today)
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? myMemberId)
  const [split, setSplit] = useState<string[]>(expense?.split_between ?? members.map((m) => m.id))
  const [repeat, setRepeat] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: string) => setSplit((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = parseAmount(amount)
    if (!(value > 0)) return setError(t('error_amount'))
    if (!split.length) return setError(t('error_split'))
    setBusy(true)
    setError('')
    const form = { description, amount: value, category, spentOn, paidBy, splitBetween: split }
    const res = expense
      ? await updateSharedExpense(expense.id, form)
      : repeat
        ? await addSharedRecurring(groupId, { ...form, dayOfMonth: Number(spentOn.slice(8, 10)), fromMonth: spentOn.slice(0, 7) })
        : await addSharedExpense(groupId, form)
    setBusy(false)
    if (res.success) return onDone(true)
    setError(res.limitText ?? t(`error_${res.message}`))
  }

  const field = 'mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal focus:border-[var(--gold)] focus:outline-none'
  return (
    <form onSubmit={save} className="rounded-2xl border-2 border-[var(--gold)]/60 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[var(--ink)]">{expense ? t('editExpense') : t('newExpense')}</h3>
        <button type="button" onClick={() => onDone(false)} aria-label={t('cancel')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {error}
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-gray-700 sm:col-span-2">
          {t('description')}
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} required placeholder={t('descriptionPlaceholder')} className={field} />
        </label>
        <label className="block text-sm font-semibold text-gray-700">
          {t('amount')}
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required placeholder="0,00" className={field} />
        </label>
        <label className="block text-sm font-semibold text-gray-700">
          {t('date')}
          <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required className={field} />
        </label>
        <label className="block text-sm font-semibold text-gray-700">
          {t('category')}
          <select value={category} onChange={(e) => setCategory(e.target.value as SharedCategory)} className={field}>
            {SHARED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {SHARED_CATEGORY_EMOJI[c]} {t(`cat_${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-gray-700">
          {t('paidBy')}
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={field}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.is_me ? t('me', { name: m.name }) : m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="mt-3">
        <legend className="text-sm font-semibold text-gray-700">{t('splitBetween')}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {members.map((m) => (
            <label key={m.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm ${split.includes(m.id) ? 'border-[var(--gold)] bg-[var(--gold)]/10 font-semibold' : 'border-gray-200'}`}>
              <input type="checkbox" checked={split.includes(m.id)} onChange={() => toggle(m.id)} className="h-4 w-4" />
              {m.is_me ? t('me', { name: m.name }) : m.name}
            </label>
          ))}
        </div>
      </fieldset>
      {!expense && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="flex items-center gap-1 font-semibold">
              <Repeat className="h-4 w-4 text-[var(--gold)]" /> {t('repeatMonthly')}
            </span>
            <span className="text-gray-500">{t('repeatHint', { day: Number(spentOn.slice(8, 10)) || 1 })}</span>
          </span>
        </label>
      )}
      <button type="submit" disabled={busy} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 font-bold text-white disabled:opacity-60">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('save')}
      </button>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Wallet, PieChart, Pencil, Trash2 } from 'lucide-react'
import SpendlyModal from './SpendlyModal'
import KpiCard from './KpiCard'
import YearSelect from './YearSelect'
import CategoryDonutChart from './charts/CategoryDonutChart'
import { createVariableExpense, updateVariableExpense, deleteVariableExpense } from '@/app/actions/spendly'
import { todayKey } from '@/lib/agenda'
import {
  VARIABLE_EXPENSE_CATEGORIES,
  formatCurrency,
  currentYearOnly,
  type SpendlyVariableExpense,
  type VariableExpenseCategory,
  parseAmount,
} from '@/lib/spendly'

const CATEGORY_KEY: Record<VariableExpenseCategory, string> = {
  spesa_alimentari: 'categorySpesaAlimentari',
  svago_ristoranti: 'categorySvagoRistoranti',
  trasporti: 'categoryTrasporti',
  salute: 'categorySalute',
  casa: 'categoryCasa',
  shopping: 'categoryShopping',
  altro: 'categoryAltro',
}

type FormState = {
  description: string
  amount: string
  expenseDate: string
  category: VariableExpenseCategory
  notes: string
}

// Giorno di oggi in Italia (toISOString darebbe il giorno UTC).
function todayISO() {
  return todayKey()
}

function emptyForm(): FormState {
  return { description: '', amount: '', expenseDate: todayISO(), category: 'spesa_alimentari', notes: '' }
}

export default function VariableExpenseManager({ items, year }: { items: SpendlyVariableExpense[]; year: number }) {
  const t = useTranslations('spendly')
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SpendlyVariableExpense | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = items.reduce((sum, i) => sum + i.amount, 0)

  const byCategory = VARIABLE_EXPENSE_CATEGORIES.map((c) => ({
    label: t(CATEGORY_KEY[c]),
    value: items.filter((i) => i.category === c).reduce((sum, i) => sum + i.amount, 0),
  })).filter((c) => c.value > 0)

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setError(null)
    setModalOpen(true)
  }

  const openEdit = (item: SpendlyVariableExpense) => {
    setEditing(item)
    setForm({
      description: item.description,
      amount: String(item.amount).replace('.', ','),
      expenseDate: item.expense_date,
      category: item.category,
      notes: item.notes || '',
    })
    setError(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const amount = parseAmount(form.amount)
    if (!form.description.trim() || Number.isNaN(amount) || amount < 0 || !form.expenseDate) {
      setError(t('saveError'))
      setSaving(false)
      return
    }

    const payload = {
      description: form.description.trim(),
      amount,
      expenseDate: form.expenseDate,
      category: form.category,
      notes: form.notes,
    }

    const result = editing ? await updateVariableExpense(editing.id, payload) : await createVariableExpense(payload)

    setSaving(false)
    if (!result.success) {
      setError(t(result.message as any))
      return
    }

    setModalOpen(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
    const result = await deleteVariableExpense(id)
    if (result.success) router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--ink)]">{t('variableExpensesPageTitle')}</h2>
          <p className="text-sm text-[var(--muted)]">{t('variableExpensesPageDescription')}</p>
        </div>
        <div className="flex items-center gap-3">
          <YearSelect year={year} years={currentYearOnly()} />
          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold px-4 py-2 rounded-lg text-sm hover:brightness-105 transition-all"
          >
            <Plus className="w-4 h-4" /> {t('new')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <KpiCard label={t('totalVariableExpenses')} value={formatCurrency(total)} icon={Wallet} tone="negative" hint={`${t('year')} ${year}`} />
        <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <PieChart className="h-4 w-4 text-[var(--gold)]" />
            <span className="text-sm font-bold text-[var(--ink)]">{t('byCategory')}</span>
          </div>
          {byCategory.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t('noDataToShow')}</p>
          ) : (
            <CategoryDonutChart data={byCategory} />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] overflow-hidden">
        {items.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted)] py-10">{t('noVariableExpensesForYear', { year })}</p>
        ) : (
          <ul className="divide-y divide-[var(--gold)]/10">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ink)]">
                    <Wallet className="h-4 w-4 text-[var(--gold-bright)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--ink)] truncate">{item.description}</p>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-0.5">
                      <span>{t(CATEGORY_KEY[item.category])}</span>
                      <span>·</span>
                      <span>{new Date(item.expense_date).toLocaleDateString('it-IT')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-red-600">-{formatCurrency(item.amount)}</span>
                  <button type="button" onClick={() => openEdit(item)} className="text-[var(--muted)] hover:text-[var(--ink)]" aria-label={t('edit')}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(item.id)} className="text-[var(--muted)] hover:text-red-600" aria-label={t('delete')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <SpendlyModal title={editing ? t('editVariableExpenseTitle') : t('newVariableExpenseTitle')} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('descriptionField')}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('amountField')}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                  placeholder="0,00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('dateField')}</label>
                <input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('categoryField')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as VariableExpenseCategory })}
                className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              >
                {VARIABLE_EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(CATEGORY_KEY[c])}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('notesField')}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t('notesPlaceholder')}
                rows={2}
                className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 bg-[var(--background)] hover:bg-[var(--gold)]/10 text-[var(--ink)] rounded-lg font-medium transition-colors">
                {t('cancel')}
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-lg font-bold disabled:opacity-50 transition-all">
                {saving ? '…' : t('save')}
              </button>
            </div>
          </form>
        </SpendlyModal>
      )}
    </div>
  )
}

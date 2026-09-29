'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Repeat, Calculator, CalendarDays, Pencil, Trash2, CheckCircle2, AlertCircle, Undo2 } from 'lucide-react'
import SpendlyModal from './SpendlyModal'
import Link from '@/components/LocalizedLink'
import KpiCard from './KpiCard'
import YearSelect from './YearSelect'
import { createFixedExpense, updateFixedExpense, deleteFixedExpense } from '@/app/actions/spendly'
import { markBillPaid, unmarkBillPaid } from '@/app/actions/agenda'
import { todayKey } from '@/lib/agenda'
import {
  FIXED_EXPENSE_CATEGORIES,
  formatCurrency,
  parseAmount,
  currentYearOnly,
  fixedExpenseAppliesToMonth,
  fixedExpenseDueDate,
  paymentKey,
  periodOf,
  type SpendlyFixedExpense,
  type SpendlyFixedPayment,
  type FixedExpenseCategory,
  type FixedExpenseFrequency,
} from '@/lib/spendly'

const CATEGORY_KEY: Record<FixedExpenseCategory, string> = {
  mutuo_affitto: 'categoryMutuoAffitto',
  bollette: 'categoryBollette',
  abbonamenti: 'categoryAbbonamenti',
  assicurazioni: 'categoryAssicurazioni',
  finanziamenti: 'categoryFinanziamenti',
  ricariche: 'categoryRicariche',
  altro: 'categoryAltro',
}

const FREQUENCY_KEY: Record<FixedExpenseFrequency, string> = {
  mensile: 'frequencyMonthly',
  bimestrale: 'frequencyBimonthly',
  trimestrale: 'frequencyQuarterly',
  semestrale: 'frequencySemiannual',
  annuale: 'frequencyAnnual',
  una_tantum: 'frequencyOneOff',
}

type FormState = {
  description: string
  amount: string
  frequency: FixedExpenseFrequency
  category: FixedExpenseCategory
  startDate: string
  endDate: string
  billingDay: string
  notes: string
}

// Giorno di oggi in Italia (toISOString darebbe il giorno UTC).
function todayISO() {
  return todayKey()
}

const formatDay = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('it-IT')

function emptyForm(): FormState {
  return { description: '', amount: '', frequency: 'mensile', category: 'mutuo_affitto', startDate: todayISO(), endDate: '', billingDay: '', notes: '' }
}

export default function FixedExpenseManager({
  items,
  payments = [],
  year,
  autoOpen = false,
}: {
  items: SpendlyFixedExpense[]
  payments?: SpendlyFixedPayment[]
  year: number
  // Arrivando da "+ Aggiungi → Bolletta" il modulo si apre subito
  autoOpen?: boolean
}) {
  const t = useTranslations('spendly')
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(autoOpen)
  const [editing, setEditing] = useState<SpendlyFixedExpense | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)

  // Scadenze del mese: questo mese per l'anno corrente (più le non pagate
  // dei mesi precedenti), altrimenti nessuna.
  const today = todayISO()
  const paid = new Map(payments.map((p) => [paymentKey(p.expense_id, p.period), p]))
  const isCurrentYear = Number(today.slice(0, 4)) === year
  const thisMonth = Number(today.slice(5, 7))
  const dueRows = isCurrentYear
    ? Array.from({ length: thisMonth }, (_, i) => i + 1).flatMap((month) =>
        items.flatMap((item) => {
          const date = fixedExpenseDueDate(item, year, month)
          if (!date) return []
          const period = periodOf(year, month)
          const payment = paid.get(paymentKey(item.id, period))
          // Mesi passati: solo quelle ancora da pagare.
          if (month < thisMonth && payment) return []
          return [{ item, date, period, payment }]
        })
      ).sort((a, b) => a.date.localeCompare(b.date))
    : []

  // Pagata / annulla: lo stato "paying" si azzera sempre, anche se l'azione
  // fallisce, e in quel caso si avvisa l'utente.
  const runPayment = async (row: (typeof dueRows)[number], action: () => Promise<boolean>) => {
    setPaying(row.period + row.item.id)
    let ok = false
    try {
      ok = await action()
    } catch (err) {
      console.error('[Spendly] payment action failed:', err)
    } finally {
      setPaying(null)
    }
    if (!ok) alert(t('saveError'))
    router.refresh()
  }

  const pay = async (row: (typeof dueRows)[number]) => {
    const answer = prompt(t('paidAmountPrompt', { name: row.item.description }), String(row.item.amount).replace('.', ','))
    if (answer === null) return
    const amount = parseAmount(answer)
    if (Number.isNaN(amount) || amount < 0) return
    await runPayment(row, () => markBillPaid(row.item.id, row.period, amount))
  }

  const unpay = async (row: (typeof dueRows)[number]) => {
    await runPayment(row, () => unmarkBillPaid(row.item.id, row.period))
  }

  // Somma solo le scadenze che ricorrono davvero nell'anno selezionato,
  // mese per mese a partire da start_date (e fino a end_date) — non basta
  // moltiplicare l'importo per il numero di occorrenze "teoriche" della
  // frequenza, altrimenti una spesa iniziata a metà anno verrebbe contata
  // come se fosse attiva fin da gennaio.
  const totalYearly = Array.from({ length: 12 }, (_, i) => i + 1).reduce(
    (sum, month) =>
      sum + items.filter((i) => fixedExpenseAppliesToMonth(i, year, month)).reduce((s, i) => s + i.amount, 0),
    0
  )
  // Media Spesa Fissa Mensile = media semplice degli importi delle spese
  // fisse in scadenza nel mese corrente (non il totale annuo diviso 12):
  // es. due spese da 573 e 300 dovute questo mese danno una media di 436,5.
  const currentMonth = thisMonth
  const currentMonthItems = items.filter((i) => fixedExpenseAppliesToMonth(i, year, currentMonth))
  const monthlyQuota =
    currentMonthItems.length > 0 ? currentMonthItems.reduce((sum, i) => sum + i.amount, 0) / currentMonthItems.length : 0

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setError(null)
    setModalOpen(true)
  }

  const openEdit = (item: SpendlyFixedExpense) => {
    setEditing(item)
    setForm({
      description: item.description,
      amount: String(item.amount).replace('.', ','),
      frequency: item.frequency,
      category: item.category,
      startDate: item.start_date,
      // Una tantum: end_date coincide con la data, non è una vera data di fine
      endDate: item.frequency === 'una_tantum' ? '' : item.end_date || '',
      billingDay: item.billing_day ? String(item.billing_day) : '',
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
    if (!form.description.trim() || Number.isNaN(amount) || amount < 0 || !form.startDate) {
      setError(t('saveError'))
      setSaving(false)
      return
    }
    if (form.endDate && form.endDate < form.startDate) {
      setError(t('saveError'))
      setSaving(false)
      return
    }

    // Una tantum: una sola scadenza, alla data indicata.
    const oneOff = form.frequency === 'una_tantum'
    const payload = {
      description: form.description.trim(),
      amount,
      frequency: form.frequency,
      category: form.category,
      startDate: form.startDate,
      endDate: oneOff ? form.startDate : form.endDate || null,
      billingDay: oneOff ? Number(form.startDate.slice(8, 10)) : form.billingDay ? parseInt(form.billingDay, 10) : Number(form.startDate.slice(8, 10)),
      notes: form.notes,
    }

    const result = editing ? await updateFixedExpense(editing.id, payload) : await createFixedExpense(payload)

    setSaving(false)
    if (!result.success) {
      setError(t(result.message as Parameters<typeof t>[0]))
      return
    }

    setModalOpen(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
    const result = await deleteFixedExpense(id).catch(() => ({ success: false as const }))
    if (!result.success) {
      alert(t('deleteError'))
      return
    }
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--ink)]">{t('fixedExpensesPageTitle')}</h2>
          <p className="text-sm text-[var(--muted)]">{t('fixedExpensesPageDescription')}</p>
          <Link href="/marketplace/spendly/bollette" className="mt-1 inline-block text-xs font-semibold text-[var(--gold)] hover:underline">
            {t('billsMovedHint')}
          </Link>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label={t('totalYearly')} value={formatCurrency(totalYearly)} icon={Repeat} />
        <KpiCard label={t('monthlyQuota')} value={formatCurrency(monthlyQuota)} icon={Calculator} />
        <KpiCard label={t('entryCount')} value={String(items.length)} icon={CalendarDays} />
      </div>

      {isCurrentYear && (
        <div className="mb-6 rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] p-5">
          <h3 className="mb-1 flex items-center gap-2 font-bold text-[var(--ink)]">
            <CalendarDays className="h-5 w-5 text-[var(--gold)]" /> {t('dueThisMonth')}
          </h3>
          <p className="mb-4 text-xs text-[var(--muted)]">{t('dueThisMonthHint')}</p>
          {dueRows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t('noDueThisMonth')}</p>
          ) : (
            <ul className="space-y-2">
              {dueRows.map((row) => {
                const overdue = !row.payment && row.date < today
                return (
                  <li
                    key={row.item.id + row.period}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                      row.payment ? 'border-emerald-200 bg-emerald-50/60' : overdue ? 'border-red-200 bg-red-50/60' : 'border-[var(--gold)]/20 bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-[var(--ink)]">
                        {row.payment ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : overdue ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : null}
                        {row.item.description}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {row.payment
                          ? t('paidOn', { amount: formatCurrency(row.payment.amount) })
                          : overdue
                            ? t('overdueSince', { date: formatDay(row.date) })
                            : t('dueOn', { date: formatDay(row.date) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!row.payment && <span className="text-sm font-semibold text-[var(--ink)]">{formatCurrency(row.item.amount)}</span>}
                      {row.payment ? (
                        <button
                          type="button"
                          disabled={paying === row.period + row.item.id}
                          onClick={() => unpay(row)}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--background)] disabled:opacity-50"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> {t('undoPaid')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={paying === row.period + row.item.id}
                          onClick={() => pay(row)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t('markPaid')}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] overflow-hidden">
        {items.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted)] py-10">{t('noFixedExpensesForYear', { year })}</p>
        ) : (
          <ul className="divide-y divide-[var(--gold)]/10">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--ink)]">
                    <Repeat className="h-4 w-4 text-[var(--gold-bright)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--ink)] truncate">{item.description}</p>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-0.5 flex-wrap">
                      <span>{t(CATEGORY_KEY[item.category])}</span>
                      <span className="rounded-md border border-[var(--gold)]/30 bg-[var(--background)] px-1.5 py-0 text-[10px] font-semibold text-[var(--ink)]">
                        {t(FREQUENCY_KEY[item.frequency])}
                      </span>
                      <span>
                        {item.frequency === 'una_tantum'
                          ? t('dueOn', { date: formatDay(item.start_date) })
                          : `${t('dueEveryDay', { day: item.billing_day ?? Number(item.start_date.slice(8, 10)) })} · ${formatDay(item.start_date)}${
                              item.end_date ? ` → ${formatDay(item.end_date)}` : ''
                            }`}
                      </span>
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
        <SpendlyModal title={editing ? t('editFixedExpenseTitle') : t('newFixedExpenseTitle')} onClose={() => setModalOpen(false)}>
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
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('frequencyField')}</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as FixedExpenseFrequency })}
                  className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                >
                  {(Object.keys(FREQUENCY_KEY) as FixedExpenseFrequency[]).map((f) => (
                    <option key={f} value={f}>
                      {t(FREQUENCY_KEY[f])}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('categoryField')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as FixedExpenseCategory })}
                className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              >
                {FIXED_EXPENSE_CATEGORIES.filter((c) => c !== 'bollette').map((c) => (
                  <option key={c} value={c}>
                    {t(CATEGORY_KEY[c])}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className={form.frequency === 'una_tantum' ? 'col-span-2' : ''}>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">
                  {form.frequency === 'una_tantum' ? t('dueDateField') : t('startDateField')}
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                  required
                />
              </div>
              <div className={form.frequency === 'una_tantum' ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('endDateField')}</label>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                  placeholder={t('noEndDate')}
                />
              </div>
            </div>
            {form.frequency !== 'una_tantum' && (
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('dueDayField')}</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={form.billingDay}
                  placeholder={form.startDate ? String(Number(form.startDate.slice(8, 10))) : ''}
                  onChange={(e) => setForm({ ...form, billingDay: e.target.value })}
                  className="w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
                <p className="mt-1 text-xs text-[var(--muted)]">{t('dueDayHint')}</p>
              </div>
            )}
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2, Pause, Pencil, Play, Plus, Receipt, Trash2, TrendingDown, TrendingUp, Undo2 } from 'lucide-react'
import SpendlyModal from './SpendlyModal'
import { createFixedExpense, deleteFixedExpense, setBillActive, updateFixedExpense } from '@/app/actions/spendly'
import { markBillPaid, unmarkBillPaid } from '@/app/actions/agenda'
import { addDays } from '@/lib/agenda'
import {
  fixedExpenseDueDate,
  formatCurrency,
  parseAmount,
  paymentKey,
  periodOf,
  type FixedExpenseFrequency,
  type SpendlyFixedExpense,
  type SpendlyFixedPayment,
} from '@/lib/spendly'

const FREQUENCIES: FixedExpenseFrequency[] = ['mensile', 'bimestrale', 'trimestrale', 'semestrale', 'annuale', 'una_tantum']
const FREQUENCY_KEY: Record<FixedExpenseFrequency, string> = {
  mensile: 'frequencyMonthly',
  bimestrale: 'frequencyBimonthly',
  trimestrale: 'frequencyQuarterly',
  semestrale: 'frequencySemiannual',
  annuale: 'frequencyAnnual',
  una_tantum: 'frequencyOneOff',
}

type Form = { id?: string; description: string; amount: string; frequency: FixedExpenseFrequency; date: string; notes: string }
type Occurrence = { bill: SpendlyFixedExpense; date: string; period: string; payment?: SpendlyFixedPayment }

const input = 'w-full p-2.5 border border-[var(--gold)]/30 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none'

// Scadenze di una bolletta tra due giorni (inclusi), mese per mese.
function occurrences(bill: SpendlyFixedExpense, from: string, to: string, paid: Map<string, SpendlyFixedPayment>): Occurrence[] {
  const out: Occurrence[] = []
  let y = Number(from.slice(0, 4))
  let m = Number(from.slice(5, 7))
  const endIdx = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7))
  while (y * 12 + m <= endIdx) {
    const date = fixedExpenseDueDate(bill, y, m)
    if (date && date >= from && date <= to) {
      const period = periodOf(y, m)
      out.push({ bill, date, period, payment: paid.get(paymentKey(bill.id, period)) })
    }
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

export default function BillsManager({
  bills,
  payments,
  today,
  autoOpen = false,
}: {
  bills: SpendlyFixedExpense[]
  payments: SpendlyFixedPayment[]
  today: string
  autoOpen?: boolean
}) {
  const t = useTranslations('spendly')
  const locale = useLocale()
  const router = useRouter()
  const emptyForm: Form = { description: '', amount: '', frequency: 'mensile', date: today, notes: '' }
  const [form, setForm] = useState<Form | null>(autoOpen ? emptyForm : null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const paid = new Map(payments.map((p) => [paymentKey(p.expense_id, p.period), p]))
  const isActive = (b: SpendlyFixedExpense) => !b.end_date || b.end_date >= today
  const active = bills.filter(isActive)
  const inactive = bills.filter((b) => !isActive(b))
  const day = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

  // Da pagare: scadute negli ultimi 90 giorni e in arrivo nei prossimi 30, non pagate.
  const toPay = bills
    .flatMap((bill) => occurrences(bill, addDays(today, -90), addDays(today, 30), paid))
    .filter((o) => !o.payment)
    .sort((a, b) => a.date.localeCompare(b.date))
  // Pagate di recente (ultimi 60 giorni), per poter annullare
  const recentlyPaid = bills
    .flatMap((bill) => occurrences(bill, addDays(today, -60), today, paid))
    .filter((o) => o.payment)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  const nextDue = (bill: SpendlyFixedExpense) =>
    occurrences(bill, today, addDays(today, 400), paid).find((o) => !o.payment)?.date ?? null

  const history = (bill: SpendlyFixedExpense) => payments.filter((p) => p.expense_id === bill.id).slice(0, 6)

  // Azione rapida: lo stato "busy" si azzera sempre, anche se l'azione
  // fallisce (false o { success: false }), e in quel caso si avvisa l'utente.
  const quick = async (
    busyKey: string | null,
    action: () => Promise<boolean | { success: boolean }>,
    errorKey: 'saveError' | 'deleteError' = 'saveError'
  ) => {
    if (busyKey) setBusy(busyKey)
    let ok = false
    try {
      const result = await action()
      ok = typeof result === 'boolean' ? result : result.success
    } catch (err) {
      console.error('[Spendly] bill action failed:', err)
    } finally {
      if (busyKey) setBusy(null)
    }
    if (!ok) alert(t(errorKey))
    router.refresh()
  }

  const pay = async (o: Occurrence) => {
    const answer = prompt(t('paidAmountPrompt', { name: o.bill.description }), String(o.bill.amount).replace('.', ','))
    if (answer === null) return
    const amount = parseAmount(answer)
    if (Number.isNaN(amount) || amount < 0) return
    await quick(o.bill.id + o.period, () => markBillPaid(o.bill.id, o.period, amount))
  }

  const unpay = async (o: Occurrence) => {
    await quick(o.bill.id + o.period, () => unmarkBillPaid(o.bill.id, o.period))
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const amount = parseAmount(form.amount)
    if (!form.description.trim() || Number.isNaN(amount) || amount < 0 || !form.date) {
      setError(t('saveError'))
      return
    }
    setSaving(true)
    setError(null)
    const original = bills.find((b) => b.id === form.id)
    const oneOff = form.frequency === 'una_tantum'
    const payload = {
      description: form.description.trim(),
      amount,
      frequency: form.frequency,
      category: 'bollette' as const,
      startDate: form.date,
      // Da una tantum a ricorrente: la vecchia end_date (= data della spesa)
      // va tolta, altrimenti la bolletta finirebbe dopo un solo mese.
      endDate: oneOff ? form.date : original?.frequency === 'una_tantum' ? null : (original?.end_date ?? null),
      billingDay: Number(form.date.slice(8, 10)),
      notes: form.notes,
    }
    let result: { success: boolean } = { success: false }
    try {
      result = form.id ? await updateFixedExpense(form.id, payload) : await createFixedExpense(payload)
    } catch (err) {
      console.error('[Spendly] bill save failed:', err)
    } finally {
      setSaving(false)
    }
    if (!result.success) {
      setError(t('saveError'))
      return
    }
    setForm(null)
    router.refresh()
  }

  const occurrenceRow = (o: Occurrence) => {
    const overdue = !o.payment && o.date < today
    return (
      <li
        key={o.bill.id + o.period}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
          o.payment ? 'border-emerald-200 bg-emerald-50/60' : overdue ? 'border-red-200 bg-red-50/60' : 'border-[var(--gold)]/20 bg-white'
        }`}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-[var(--ink)]">
            {o.payment ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : overdue ? <AlertCircle className="h-4 w-4 text-red-600" /> : null}
            {o.bill.description}
          </p>
          <p className={`text-xs ${overdue ? 'font-semibold text-red-600' : 'text-[var(--muted)]'}`}>
            {o.payment
              ? t('paidOn', { amount: formatCurrency(o.payment.amount) })
              : overdue
                ? t('overdueSince', { date: day(o.date) })
                : t('dueOn', { date: day(o.date) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!o.payment && <span className="text-sm text-[var(--muted)]">{t('estimated', { amount: formatCurrency(o.bill.amount) })}</span>}
          {o.payment ? (
            <button type="button" disabled={busy === o.bill.id + o.period} onClick={() => unpay(o)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--background)] disabled:opacity-50">
              <Undo2 className="h-3.5 w-3.5" /> {t('undoPaid')}
            </button>
          ) : (
            <button type="button" disabled={busy === o.bill.id + o.period} onClick={() => pay(o)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('markPaid')}
            </button>
          )}
        </div>
      </li>
    )
  }

  const billCard = (bill: SpendlyFixedExpense, inactiveBill = false) => {
    const last = history(bill)
    const avg = last.length ? last.reduce((s, p) => s + p.amount, 0) / last.length : null
    const trend = last.length >= 2 ? last[0].amount - last[1].amount : 0
    const next = inactiveBill ? null : nextDue(bill)
    return (
      <li key={bill.id} className={`rounded-2xl border border-[var(--gold)]/20 bg-white p-4 ${inactiveBill ? 'opacity-70' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-[var(--ink)]">{bill.description}</p>
            <p className="text-xs text-[var(--muted)]">
              {t(FREQUENCY_KEY[bill.frequency])}
              {next ? ` · ${t('nextDue', { date: day(next) })}` : ''}
              {inactiveBill ? ` · ${t('billInactive')}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[var(--muted)]">
            <button
              type="button"
              onClick={() => setForm({ id: bill.id, description: bill.description, amount: String(bill.amount).replace('.', ','), frequency: bill.frequency, date: bill.start_date, notes: bill.notes ?? '' })}
              className="rounded-md p-1.5 hover:bg-gray-100 hover:text-[var(--ink)]"
              aria-label={t('edit')}
            >
              <Pencil className="h-4 w-4" />
            </button>
            {bill.frequency !== 'una_tantum' && (
              <button
                type="button"
                onClick={async () => {
                  if (!inactiveBill && !confirm(t('deactivateConfirm', { name: bill.description }))) return
                  await quick(null, () => setBillActive(bill.id, inactiveBill))
                }}
                className="rounded-md p-1.5 hover:bg-gray-100 hover:text-[var(--ink)]"
                title={inactiveBill ? t('reactivateBill') : t('deactivateBill')}
                aria-label={inactiveBill ? t('reactivateBill') : t('deactivateBill')}
              >
                {inactiveBill ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                if (!confirm(t('deleteBillConfirm', { name: bill.description }))) return
                await quick(null, () => deleteFixedExpense(bill.id), 'deleteError')
              }}
              className="rounded-md p-1.5 hover:bg-red-50 hover:text-red-600"
              aria-label={t('delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{last.length ? t('averagePaid') : t('estimatedAmount')}</p>
            <p className="flex items-center gap-1.5 text-lg font-bold text-[var(--ink)]">
              {formatCurrency(avg ?? bill.amount)}
              {trend !== 0 &&
                (trend > 0 ? (
                  <span className="flex items-center text-xs font-semibold text-red-600">
                    <TrendingUp className="h-3.5 w-3.5" /> +{formatCurrency(trend)}
                  </span>
                ) : (
                  <span className="flex items-center text-xs font-semibold text-emerald-600">
                    <TrendingDown className="h-3.5 w-3.5" /> {formatCurrency(trend)}
                  </span>
                ))}
            </p>
          </div>
          {last.length > 0 && (
            <div className="flex items-end gap-1" title={t('lastPayments')}>
              {[...last].reverse().map((p) => {
                const max = Math.max(...last.map((x) => x.amount), 1)
                return (
                  <div key={p.period} className="flex flex-col items-center gap-0.5">
                    <div className="w-5 rounded-t bg-[var(--gold)]/70" style={{ height: `${Math.max(6, (p.amount / max) * 40)}px` }} />
                    <span className="text-[9px] text-[var(--muted)]">{new Date(`${p.period}T12:00:00Z`).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--ink)]">{t('billsTitle')}</h2>
          <p className="text-sm text-[var(--muted)]">{t('billsDescription')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setForm(emptyForm)
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2 text-sm font-bold text-[var(--ink)] hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> {t('newBill')}
        </button>
      </div>

      <section className="mb-6 rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-[var(--ink)]">
          <Receipt className="h-5 w-5 text-[var(--gold)]" /> {t('toPayTitle')}
        </h3>
        {toPay.length === 0 ? <p className="text-sm text-[var(--muted)]">{t('nothingToPay')}</p> : <ul className="space-y-2">{toPay.map(occurrenceRow)}</ul>}
        {recentlyPaid.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('recentlyPaid')}</p>
            <ul className="space-y-2">{recentlyPaid.map(occurrenceRow)}</ul>
          </>
        )}
      </section>

      <h3 className="mb-3 font-bold text-[var(--ink)]">{t('yourBills')}</h3>
      {active.length === 0 ? (
        <p className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] py-10 text-center text-sm text-[var(--muted)]">{t('noBills')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">{active.map((b) => billCard(b))}</ul>
      )}

      {inactive.length > 0 && (
        <div className="mt-6">
          <button type="button" onClick={() => setShowInactive((v) => !v)} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
            {showInactive ? t('hideInactiveBills') : t('showInactiveBills', { count: inactive.length })}
          </button>
          {showInactive && <ul className="mt-3 grid gap-3 sm:grid-cols-2">{inactive.map((b) => billCard(b, true))}</ul>}
        </div>
      )}

      {form && (
        <SpendlyModal title={form.id ? t('editBill') : t('newBill')} onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('billName')}</label>
              <input className={input} value={form.description} required autoFocus placeholder={t('billNamePlaceholder')} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('billFrequency')}</label>
                <select className={input} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as FixedExpenseFrequency })}>
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {t(FREQUENCY_KEY[f])}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('billAmount')}</label>
                <input className={input} inputMode="decimal" value={form.amount} required placeholder="0,00" onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{form.id ? t('billFirstDate') : t('billNextDate')}</label>
              <input type="date" className={input} value={form.date} required onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <p className="mt-1 text-xs text-[var(--muted)]">{form.frequency === 'una_tantum' ? t('billOneOffHint') : t('billDateHint')}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('notesField')}</label>
              <textarea className={`${input} resize-none`} rows={2} value={form.notes} placeholder={t('billNotesPlaceholder')} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setForm(null)} className="rounded-lg bg-[var(--background)] px-4 py-2 font-medium text-[var(--ink)] hover:bg-[var(--gold)]/10">
                {t('cancel')}
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2 font-bold text-[var(--ink)] disabled:opacity-50">
                {saving ? '…' : t('save')}
              </button>
            </div>
          </form>
        </SpendlyModal>
      )}
    </div>
  )
}

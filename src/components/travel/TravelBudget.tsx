'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, Check, Plus, Undo2 } from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { addSettlement, deleteSettlement } from '@/app/actions/travel'
import { EXPENSE_CATEGORIES, EXPENSE_EMOJI, memberBalances, settleUp, type TripDetail, type TripExpense, type TripSettlement } from '@/lib/travel'
import TravelExpenseForm from './TravelExpenseForm'

// Spese del viaggio: il mio saldo, "chi deve quanto a chi" con i
// trasferimenti minimi, i rimborsi già fatti e l'elenco delle spese.
export default function TravelBudget({
  detail,
  expenses,
  settlements,
  myUserId,
  today,
  onChanged,
}: {
  detail: TripDetail
  expenses: TripExpense[]
  settlements: TripSettlement[]
  myUserId: string
  today: string
  onChanged: () => Promise<void>
}) {
  const t = useTranslations('travel')
  const locale = useLocale()
  const [form, setForm] = useState<{ expense: TripExpense | null } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const base = detail.base_currency
  const money = (value: number, currency = base) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
  const fromCents = (value: number) => money(value / 100)
  const name = (id: string) => detail.members.find((m) => m.id === id)?.name ?? '—'
  const me = detail.my_member_id

  const balances = memberBalances(expenses, settlements)
  const transfers = settleUp(balances)
  const myBalance = balances.get(me) ?? 0
  const total = expenses.reduce((sum, e) => sum + Math.round(e.amount * e.rate_to_base * 100), 0)
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    c,
    value: expenses.filter((e) => e.category === c).reduce((sum, e) => sum + Math.round(e.amount * e.rate_to_base * 100), 0),
  })).filter((x) => x.value > 0)

  // Il rimborso lo conferma chi riceve i soldi (o l'organizzatore): chi deve
  // pagare non può azzerare da solo il proprio debito.
  const canSettle = (to: string) => detail.is_owner || to === me
  const canManage = (createdBy: string) => detail.is_owner || createdBy === myUserId

  const settle = async (from: string, to: string, amount: number) => {
    if (!confirm(t('settleConfirm', { from: name(from), to: name(to), amount: fromCents(amount) }))) return
    setBusy(`${from}-${to}`)
    try {
      const result = await addSettlement(detail.id, from, to, amount)
      if (!result.success) alert(t('error_saveError'))
    } finally {
      setBusy(null)
      await onChanged()
    }
  }

  const undoSettlement = async (id: string) => {
    if (!confirm(t('undoSettlementConfirm'))) return
    setBusy(id)
    try {
      const result = await deleteSettlement(id)
      if (!result.success) alert(t('error_saveError'))
    } finally {
      setBusy(null)
      await onChanged()
    }
  }

  return (
    <div className="space-y-4">
      {/* Riepilogo */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('totalSpent')}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{fromCents(total)}</p>
          {detail.members.length > 0 && total > 0 && (
            <p className="text-xs text-[var(--muted)]">{t('perPerson', { amount: fromCents(Math.round(total / detail.members.length)) })}</p>
          )}
        </div>
        <div
          className={`rounded-2xl border p-4 ${myBalance > 0 ? 'border-emerald-200 bg-emerald-50' : myBalance < 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('myBalance')}</p>
          <p className={`mt-1 text-2xl font-bold ${myBalance > 0 ? 'text-emerald-700' : myBalance < 0 ? 'text-amber-700' : 'text-[var(--ink)]'}`}>
            {myBalance === 0 ? t('allSquare') : fromCents(Math.abs(myBalance))}
          </p>
          {myBalance !== 0 && <p className="text-xs text-[var(--muted)]">{myBalance > 0 ? t('youGetBack') : t('youOwe')}</p>}
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byCategory.map(({ c, value }) => (
            <span key={c} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-[var(--ink)]">
              {EXPENSE_EMOJI[c]} {t(`category_${c}`)} · {fromCents(value)}
            </span>
          ))}
        </div>
      )}

      {/* Chi deve quanto a chi */}
      <section className="rounded-2xl border border-[var(--gold)]/40 bg-white p-4">
        <h3 className="mb-3 font-bold text-[var(--ink)]">{t('whoOwesWhom')}</h3>
        {transfers.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{expenses.length ? t('allSettled') : t('noExpensesYet')}</p>
        ) : (
          <ul className="space-y-2">
            {transfers.map((tr) => (
              <li key={`${tr.from}-${tr.to}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                <span className={`font-semibold ${tr.from === me ? 'text-amber-700' : 'text-[var(--ink)]'}`}>{name(tr.from)}</span>
                <ArrowRight className="h-4 w-4 text-[var(--muted)]" />
                <span className={`font-semibold ${tr.to === me ? 'text-emerald-700' : 'text-[var(--ink)]'}`}>{name(tr.to)}</span>
                <span className="ml-auto font-bold text-[var(--ink)]">{fromCents(tr.amount)}</span>
                {canSettle(tr.to) && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => settle(tr.from, tr.to, tr.amount)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" /> {t('markSettled')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {settlements.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-[var(--muted)]">{t('settlementsDone', { count: settlements.length })}</summary>
            <ul className="mt-2 space-y-1.5">
              {settlements.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[var(--muted)]">
                  <Check className="h-4 w-4 text-emerald-600" />
                  {t('settlementLine', { from: name(s.from_member), to: name(s.to_member), amount: money(s.amount) })}
                  {(canManage(s.created_by) || s.to_member === me) && (
                    <button type="button" onClick={() => undoSettlement(s.id)} disabled={busy !== null} className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-100" aria-label={t('undo')}>
                      <Undo2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Elenco spese */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[var(--ink)]">{t('expensesTitle', { count: expenses.length })}</h3>
        <button type="button" onClick={() => setForm({ expense: null })} className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> {t('addExpense')}
        </button>
      </div>
      {expenses.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-white/70 p-8 text-center text-[var(--muted)]">{t('expensesEmpty')}</div>
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) => {
            const foreign = e.currency !== base
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => canManage(e.created_by) && setForm({ expense: e })}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left disabled:cursor-default"
                  disabled={!canManage(e.created_by)}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-xl">{EXPENSE_EMOJI[e.category]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-[var(--ink)]">{e.description}</span>
                    <span className="block truncate text-xs text-[var(--muted)]">
                      {t('paidByLine', { name: name(e.paid_by), count: e.split_between.length })} ·{' '}
                      {new Date(`${e.spent_on}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold text-[var(--ink)]">{money(e.amount, e.currency)}</span>
                    {foreign && <span className="block text-xs text-[var(--muted)]">≈ {money(e.amount * e.rate_to_base)}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {form && (
        <Sheet title={form.expense ? t('editExpense') : t('addExpense')} onClose={() => setForm(null)}>
          <TravelExpenseForm
            tripId={detail.id}
            baseCurrency={base}
            members={detail.members}
            myMemberId={me}
            expense={form.expense}
            today={today}
            canDelete={form.expense ? canManage(form.expense.created_by) : false}
            onDone={async () => {
              setForm(null)
              await onChanged()
            }}
          />
        </Sheet>
      )}
    </div>
  )
}

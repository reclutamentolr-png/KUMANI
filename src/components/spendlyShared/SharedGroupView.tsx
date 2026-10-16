'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Crown, LoaderCircle, Pencil, PiggyBank, Plus, Repeat, Scale, Trash2, Undo2, UserMinus } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import CopyButton from '@/components/CopyButton'
import NativeShareButton from '@/components/NativeShareButton'
import ForecastCard from '@/components/spendly/ForecastCard'
import SharedExpenseEditor from './SharedExpenseEditor'
import SharedYearPdfButton from './SharedYearPdfButton'
import {
  addSharedSettlement,
  deleteSharedExpense,
  deleteSharedGroup,
  deleteSharedRecurring,
  deleteSharedSettlement,
  removeSharedMember,
  syncSharedToSpendly,
} from '@/app/actions/spendlyShared'
import { monthNames } from '@/lib/spendly'
import type { MonthForecast } from '@/lib/spendlyForecast'
import { SHARED_CATEGORY_EMOJI, shareOf, shiftMonth, summarize, type SharedExpense, type SharedGroup, type SharedRecurring, type SharedSettlement } from '@/lib/spendlyShared'

export default function SharedGroupView({
  group,
  month,
  currentMonth,
  today,
  expenses,
  balances,
  transfers,
  settlements,
  recurring,
  forecast,
  spendlyStatus,
  inviteUrl,
}: {
  group: SharedGroup
  month: string
  currentMonth: string
  today: string
  expenses: SharedExpense[]
  // Saldi in centesimi (positivo = deve ricevere) e rimborsi minimi in centesimi
  balances: Record<string, number>
  transfers: { from: string; to: string; amount: number }[]
  settlements: SharedSettlement[]
  recurring: SharedRecurring[]
  forecast: MonthForecast | null
  spendlyStatus: { status: string; shares?: number; imported?: number }
  inviteUrl: string
}) {
  const t = useTranslations('spendlyShared')
  const locale = useLocale()
  const router = useRouter()
  const [editing, setEditing] = useState<SharedExpense | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const eur = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
  const nameOf = new Map(group.members.map((m) => [m.id, m.is_me ? t('you') : m.name]))
  const months = monthNames(locale)
  const [y, m] = month.split('-').map(Number)
  const monthLabel = `${months[m - 1]} ${y}`
  const summary = summarize(expenses, group.members)
  const myBalance = (balances[group.my_member_id] ?? 0) / 100
  const href = (mm: string) => `/spese-condivise/${group.id}${mm === currentMonth ? '' : `?mese=${mm}`}`
  const years = Array.from({ length: 3 }, (_, i) => Number(currentMonth.slice(0, 4)) - i)

  // Esegue un'azione, mostra l'esito e ricarica i dati della pagina
  const run = async (key: string, action: () => Promise<{ success: boolean; message?: string }>, okText?: string) => {
    setBusy(key)
    setMessage(null)
    const res = await action()
    setBusy(null)
    if (res.success) {
      if (okText) setMessage({ ok: true, text: okText })
      router.refresh()
    } else setMessage({ ok: false, text: t(`error_${res.message ?? 'saveError'}`) })
  }

  return (
    <div className="space-y-6">
      {/* Gruppo, membri e invito */}
      <section className="rounded-2xl bg-[var(--ink)] p-5 text-white shadow-lg">
        <h1 className="text-2xl font-bold sm:text-3xl">
          <span aria-hidden>{group.emoji}</span> {group.name}
        </h1>
        <ul className="mt-3 flex flex-wrap gap-2">
          {group.members.map((mm) => (
            <li key={mm.id} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm">
              {mm.role === 'owner' && <Crown className="h-3.5 w-3.5 text-[var(--gold-bright)]" />}
              {mm.is_me ? t('me', { name: mm.name }) : mm.name}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-3">
          <span className="text-sm text-white/70">{t('inviteCode')}</span>
          <span className="font-mono text-lg font-bold tracking-widest text-[var(--gold-bright)]">{group.invite_code}</span>
          <CopyButton text={inviteUrl} variant="light" />
          <NativeShareButton url={inviteUrl} title={group.name} text={t('inviteShareText', { name: group.name })} variant="glass" copyFallback={false} />
        </div>
      </section>

      {message && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          {message.text}
        </p>
      )}

      {/* Chi deve quanto a chi (su tutte le spese e i rimborsi) */}
      <section className="rounded-2xl border border-[var(--gold)]/40 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          <Scale className="h-5 w-5 text-[var(--gold)]" /> {t('balanceTitle')}
        </h2>
        <p className={`mt-1 text-sm font-semibold ${Math.abs(myBalance) < 0.01 ? 'text-gray-600' : myBalance > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {Math.abs(myBalance) < 0.01 ? t('balanceEven') : myBalance > 0 ? t('balanceReceive', { amount: eur(myBalance) }) : t('balanceGive', { amount: eur(-myBalance) })}
        </p>
        {transfers.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            <Check className="h-4 w-4" /> {t('allSquare')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {transfers.map((tr) => (
              <li key={`${tr.from}-${tr.to}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                <span className="flex-1 text-sm">
                  <strong>{nameOf.get(tr.from)}</strong> <ArrowRight className="inline h-4 w-4 text-[var(--gold)]" /> <strong>{nameOf.get(tr.to)}</strong>{' '}
                  <span className="font-bold text-[var(--ink)]">{eur(tr.amount / 100)}</span>
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run(`settle-${tr.from}-${tr.to}`, () => addSharedSettlement(group.id, tr.from, tr.to, tr.amount / 100), t('settledOk'))}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy === `settle-${tr.from}-${tr.to}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t('markPaid')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {settlements.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold text-gray-600">{t('settlementsTitle', { n: settlements.length })}</summary>
            <ul className="mt-2 space-y-1">
              {settlements.slice(0, 20).map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-gray-700">
                  <span className="flex-1">
                    {new Date(`${s.settled_on}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })} · {nameOf.get(s.from_member)} → {nameOf.get(s.to_member)} · {eur(Number(s.amount))}
                  </span>
                  <button type="button" disabled={busy !== null} onClick={() => run(`undo-${s.id}`, () => deleteSharedSettlement(s.id))} aria-label={t('undo')} className="rounded p-1.5 text-gray-500 hover:bg-gray-100">
                    <Undo2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Mese */}
      <div className="flex items-center justify-between gap-2">
        <Link href={href(shiftMonth(month, -1))} aria-label={t('prevMonth')} className="rounded-xl border border-gray-200 bg-white p-2.5 hover:border-[var(--gold)]">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-center text-xl font-bold capitalize text-[var(--ink)]">{monthLabel}</h2>
        {month < currentMonth ? (
          <Link href={href(shiftMonth(month, 1))} aria-label={t('nextMonth')} className="rounded-xl border border-gray-200 bg-white p-2.5 hover:border-[var(--gold)]">
            <ChevronRight className="h-5 w-5" />
          </Link>
        ) : (
          <span className="w-11" />
        )}
      </div>

      {forecast && <ForecastCard forecast={forecast} monthName={months[m - 1]} />}

      {/* Riepilogo del mese */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">{t('monthTotal')}</p>
        <p className="text-3xl font-extrabold text-[var(--ink)]">{eur(summary.total)}</p>
        {summary.total > 0 && (
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-gray-700">{t('byCategory')}</h3>
              <ul className="mt-2 space-y-2">
                {summary.byCategory.map((c) => (
                  <li key={c.category} className="text-sm">
                    <span className="flex justify-between">
                      <span>
                        {SHARED_CATEGORY_EMOJI[c.category]} {t(`cat_${c.category}`)}
                      </span>
                      <strong>{eur(c.amount)}</strong>
                    </span>
                    <span className="mt-1 block h-1.5 rounded-full bg-gray-100">
                      <span className="block h-1.5 rounded-full bg-[var(--gold)]" style={{ width: `${(c.amount / summary.total) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-700">{t('byMember')}</h3>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pb-1 font-semibold">{t('member')}</th>
                    <th className="pb-1 text-right font-semibold">{t('paid')}</th>
                    <th className="pb-1 text-right font-semibold">{t('share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byMember.map((mm) => (
                    <tr key={mm.id} className="border-t border-gray-100">
                      <td className="py-1.5">{nameOf.get(mm.id)}</td>
                      <td className="py-1.5 text-right">{eur(mm.paid)}</td>
                      <td className="py-1.5 text-right">{eur(mm.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Spese del mese */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('expensesTitle')}</h2>
          {editing === null && (
            <button type="button" onClick={() => setEditing('new')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 font-bold text-[var(--ink)]">
              <Plus className="h-4 w-4" /> {t('addExpense')}
            </button>
          )}
        </div>
        {editing !== null && (
          <div className="mt-3">
            <SharedExpenseEditor
              groupId={group.id}
              members={group.members}
              myMemberId={group.my_member_id}
              today={month === currentMonth ? today : `${month}-01`}
              expense={editing === 'new' ? null : editing}
              onDone={(saved) => {
                setEditing(null)
                if (saved) router.refresh()
              }}
            />
          </div>
        )}
        {expenses.length === 0 ? (
          <p className="mt-3 rounded-xl bg-white px-4 py-6 text-center text-sm text-gray-500">{t('noExpenses')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {expenses.map((e) => {
              const mine = shareOf(e, group.my_member_id)
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl" aria-hidden>
                    {SHARED_CATEGORY_EMOJI[e.category]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 font-semibold text-[var(--ink)]">
                      <span className="truncate">{e.description}</span>
                      {e.recurring_id && <Repeat className="h-3.5 w-3.5 shrink-0 text-[var(--gold)]" aria-label={t('recurringBadge')} />}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {new Date(`${e.spent_on}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })} · {t('paidByName', { name: nameOf.get(e.paid_by) ?? '—' })} ·{' '}
                      {e.split_between.length === group.members.length ? t('splitAll') : t('splitN', { n: e.split_between.length })}
                      {mine > 0 && ` · ${t('myShare', { amount: eur(mine) })}`}
                    </span>
                  </span>
                  <strong className="whitespace-nowrap text-[var(--ink)]">{eur(Number(e.amount))}</strong>
                  <button type="button" onClick={() => setEditing(e)} aria-label={t('edit')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => confirm(t('deleteConfirm')) && run(`del-${e.id}`, () => deleteSharedExpense(e.id))}
                    aria-label={t('delete')}
                    className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                  >
                    {busy === `del-${e.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Spese fisse */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          <Repeat className="h-5 w-5 text-[var(--gold)]" /> {t('recurringTitle')}
        </h2>
        <p className="mt-1 text-sm text-gray-600">{t('recurringText')}</p>
        {recurring.length > 0 && (
          <ul className="mt-3 space-y-2">
            {recurring.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                <span aria-hidden>{SHARED_CATEGORY_EMOJI[r.category]}</span>
                <span className="min-w-0 flex-1">
                  <strong className="text-[var(--ink)]">{r.description}</strong> · {eur(Number(r.amount))}
                  <span className="block text-xs text-gray-500">
                    {r.every_months > 1 ? t('recurringLineEvery', { months: r.every_months, day: r.day_of_month, name: nameOf.get(r.paid_by) ?? '—' }) : t('recurringLine', { day: r.day_of_month, name: nameOf.get(r.paid_by) ?? '—' })}
                    {r.spendly_fixed_id && ` · ${t('fromCasa')}`}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => confirm(t('stopConfirm')) && run(`stop-${r.id}`, () => deleteSharedRecurring(r.id))}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600"
                >
                  {t('stop')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* La mia quota nel mio Spendly */}
      <section className="rounded-2xl border border-[var(--gold)]/40 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          <PiggyBank className="h-5 w-5 text-[var(--gold)]" /> {t('spendlyTitle')}
        </h2>
        {spendlyStatus.status === 'ok' ? (
          <>
            <p className="mt-1 text-sm text-gray-600">{t('spendlyText', { imported: spendlyStatus.imported ?? 0, shares: spendlyStatus.shares ?? 0 })}</p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run('spendly', () => syncSharedToSpendly(group.id), t('spendlyOk'))}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 font-bold text-white disabled:opacity-60"
            >
              {busy === 'spendly' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PiggyBank className="h-4 w-4" />} {t('spendlyButton')}
            </button>
          </>
        ) : (
          <p className="mt-1 text-sm text-gray-600">
            {t('spendlyNoAccess')}{' '}
            <Link href="/billing" className="font-bold text-[var(--gold)] underline-offset-2 hover:underline">
              {t('seePlans')}
            </Link>
          </p>
        )}
      </section>

      {/* Il resoconto dell'anno */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--ink)]">{t('yearTitle')}</h2>
        <p className="mb-3 mt-1 text-sm text-gray-600">{t('yearText')}</p>
        <SharedYearPdfButton groupId={group.id} years={years} />
      </section>

      {/* Membri: uscire, togliere qualcuno, eliminare il gruppo */}
      <details className="rounded-2xl border border-gray-200 bg-white p-5 text-sm shadow-sm">
        <summary className="cursor-pointer font-bold text-[var(--ink)]">{t('manageTitle')}</summary>
        <ul className="mt-3 space-y-2">
          {group.members
            .filter((mm) => mm.role !== 'owner' && (mm.is_me || group.is_owner))
            .map((mm) => (
              <li key={mm.id} className="flex items-center justify-between gap-2">
                <span>{mm.is_me ? t('me', { name: mm.name }) : mm.name}</span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    confirm(mm.is_me ? t('leaveConfirm') : t('removeConfirm', { name: mm.name })) &&
                    run(`rm-${mm.id}`, async () => {
                      const res = await removeSharedMember(mm.id)
                      if (res.success && mm.is_me) router.push(`${locale === 'it' ? '' : `/${locale}`}/spese-condivise`)
                      return res
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600"
                >
                  <UserMinus className="h-4 w-4" /> {mm.is_me ? t('leave') : t('remove')}
                </button>
              </li>
            ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500">{t('removeHint')}</p>
        {group.is_owner && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              if (!confirm(t('deleteGroupConfirm', { name: group.name }))) return
              setBusy('group')
              const res = await deleteSharedGroup(group.id)
              setBusy(null)
              if (res.success) router.push(`${locale === 'it' ? '' : `/${locale}`}/spese-condivise`)
              else setMessage({ ok: false, text: t('error_saveError') })
            }}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-4 font-semibold text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> {t('deleteGroup')}
          </button>
        )}
      </details>
    </div>
  )
}

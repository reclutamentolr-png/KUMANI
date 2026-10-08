'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Droplets, Flame, Lightbulb, LoaderCircle, Pencil, Phone, Plus, Recycle, Thermometer, Trash2, Wifi, Zap, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { deleteUtility, saveUtility } from '@/app/actions/casa'
import { BILL_FREQUENCIES, UTILITY_KINDS, type CasaBill, type CasaUtility, type UtilityForm, type UtilityKind } from '@/lib/casa'
import { askConfirm } from '@/lib/confirm'
import { Sheet, card, ghostBtn, input, label, parseNumber, primaryBtn, useAction, useFormat } from '@/components/casa/shared'

export const UTILITY_ICONS: Record<UtilityKind, LucideIcon> = {
  electricity: Zap,
  gas: Flame,
  water: Droplets,
  internet: Wifi,
  phone: Phone,
  waste: Recycle,
  heating: Thermometer,
  other: Lightbulb,
}

const FREQUENCY_KEY: Record<string, string> = {
  mensile: 'frequencyMonthly',
  bimestrale: 'frequencyBimonthly',
  trimestrale: 'frequencyQuarterly',
  semestrale: 'frequencySemiannual',
  annuale: 'frequencyAnnual',
  una_tantum: 'frequencyOneOff',
}

type Editing = { id?: string; form: UtilityForm; amountText: string }

export default function UtilitiesPanel({
  homeId,
  utilities,
  bills,
  linkedBillIds,
  today,
  spendlyAvailable,
}: {
  homeId: string
  utilities: CasaUtility[]
  bills: CasaBill[]
  linkedBillIds: string[]
  today: string
  spendlyAvailable: boolean
}) {
  const t = useTranslations('casa')
  const ts = useTranslations('spendly')
  const f = useFormat()
  const { run, isPending, error, setError } = useAction()
  const [editing, setEditing] = useState<Editing | null>(null)
  const billById = new Map(bills.map((b) => [b.id, b]))
  // Una bolletta di Spendly si collega a una sola utenza
  const usedBills = new Set(linkedBillIds)

  const open = (utility?: CasaUtility) => {
    setError(null)
    setEditing({
      id: utility?.id,
      amountText: '',
      form: {
        kind: utility?.kind ?? 'electricity',
        provider: utility?.provider ?? '',
        customerCode: utility?.customer_code ?? '',
        supplyCode: utility?.supply_code ?? '',
        supportPhone: utility?.support_phone ?? '',
        offerEndsOn: utility?.offer_ends_on ?? '',
        notes: utility?.notes ?? '',
        billMode: utility?.spendly_fixed_id ? 'existing' : 'none',
        billId: utility?.spendly_fixed_id ?? '',
        billAmount: null,
        billFrequency: 'bimestrale',
        billDay: null,
        billStart: today,
      },
    })
  }
  const set = <K extends keyof UtilityForm>(key: K, value: UtilityForm[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e))

  const remove = async (u: CasaUtility) => {
    if (!(await askConfirm(t('deleteUtilityConfirm', { name: u.provider || t(`utility_${u.kind}`) })))) return
    run(() => deleteUtility(u.id))
  }

  const supplyLabel = (kind: UtilityKind) => (kind === 'electricity' ? t('supplyCodePod') : kind === 'gas' ? t('supplyCodePdr') : t('supplyCode'))
  const freeBills = (current?: string) => bills.filter((b) => b.id === current || !usedBills.has(b.id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">{t('utilitiesIntro')}</p>
        <button type="button" onClick={() => open()} className={primaryBtn}>
          <Plus className="h-4 w-4" /> {t('addUtility')}
        </button>
      </div>

      {utilities.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-white px-6 py-8 text-center">
          <Zap className="mx-auto h-9 w-9 text-[var(--gold)]" />
          <p className="mt-2 font-bold text-[var(--ink)]">{t('utilitiesEmptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t('utilitiesEmptyText')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {utilities.map((u) => {
            const Icon = UTILITY_ICONS[u.kind]
            const bill = u.spendly_fixed_id ? billById.get(u.spendly_fixed_id) : undefined
            return (
              <div key={u.id} className={`${card} !p-4`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-[var(--ink)]">{t(`utility_${u.kind}`)}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{u.provider || t('noProvider')}</p>
                  </div>
                  <button type="button" onClick={() => open(u)} aria-label={t('edit')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(u)} aria-label={t('delete')} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  {u.customer_code && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted)]">{t('customerCode')}</dt>
                      <dd className="truncate font-semibold text-[var(--ink)]">{u.customer_code}</dd>
                    </div>
                  )}
                  {u.supply_code && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted)]">{supplyLabel(u.kind)}</dt>
                      <dd className="truncate font-mono text-xs font-semibold text-[var(--ink)]">{u.supply_code}</dd>
                    </div>
                  )}
                  {u.offer_ends_on && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--muted)]">{t('offerEndsOn')}</dt>
                      <dd className={`font-semibold ${u.offer_ends_on < today ? 'text-red-600' : 'text-[var(--ink)]'}`}>{f.date(u.offer_ends_on)}</dd>
                    </div>
                  )}
                </dl>
                {u.support_phone && (
                  <a href={`tel:${u.support_phone.replace(/[^\d+]/g, '')}`} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100">
                    <Phone className="h-3.5 w-3.5" /> {t('supportPhoneShort')}: {u.support_phone}
                  </a>
                )}
                <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
                  {bill ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[var(--ink)]">
                        <b>{f.eur(bill.amount)}</b> · {ts(FREQUENCY_KEY[bill.frequency] ?? 'frequencyMonthly')}
                        {bill.next_due && <span className="text-[var(--muted)]"> · {t('nextBill', { date: f.date(bill.next_due) })}</span>}
                      </span>
                      <Link href="/marketplace/spendly/bollette" className="text-xs font-bold text-[var(--gold)] hover:text-[var(--ink)]">
                        {t('openInSpendly')}
                      </Link>
                    </div>
                  ) : (
                    <span className="text-[var(--muted)]">{t('noBillLinked')}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {error && !editing && <p className="text-sm text-red-600">{error}</p>}

      {editing && (
        <Sheet title={editing.id ? t('editUtility') : t('addUtility')} onClose={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = { ...editing.form, billAmount: parseNumber(editing.amountText) }
              run(() => saveUtility(homeId, form, editing.id), () => setEditing(null))
            }}
            className="space-y-4"
          >
            <div>
              <span className={label}>{t('utilityKind')}</span>
              <div className="flex flex-wrap gap-1.5">
                {UTILITY_KINDS.map((kind) => {
                  const Icon = UTILITY_ICONS[kind]
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => set('kind', kind)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        editing.form.kind === kind ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {t(`utility_${kind}`)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className={label} htmlFor="ut-provider">
                {t('provider')}
              </label>
              <input id="ut-provider" className={input} value={editing.form.provider} onChange={(e) => set('provider', e.target.value)} maxLength={80} placeholder={t('providerPlaceholder')} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="ut-customer">
                  {t('customerCode')}
                </label>
                <input id="ut-customer" className={input} value={editing.form.customerCode} onChange={(e) => set('customerCode', e.target.value)} maxLength={60} />
              </div>
              <div>
                <label className={label} htmlFor="ut-supply">
                  {supplyLabel(editing.form.kind)}
                </label>
                <input id="ut-supply" className={input} value={editing.form.supplyCode} onChange={(e) => set('supplyCode', e.target.value)} maxLength={60} />
              </div>
              <div>
                <label className={label} htmlFor="ut-phone">
                  {t('supportPhone')}
                </label>
                <input id="ut-phone" type="tel" className={input} value={editing.form.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} maxLength={40} />
              </div>
              <div>
                <label className={label} htmlFor="ut-offer">
                  {t('offerEndsOn')}
                </label>
                <input id="ut-offer" type="date" className={input} value={editing.form.offerEndsOn} onChange={(e) => set('offerEndsOn', e.target.value)} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-[var(--muted)]">{t('offerEndsHint')}</p>

            {/* Bolletta in Spendly: niente doppioni, si collega quella che c'è */}
            <fieldset className="space-y-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] p-4">
              <legend className="px-1 text-sm font-bold text-[var(--ink)]">{t('billSection')}</legend>
              {!spendlyAvailable ? (
                <p className="text-sm text-[var(--muted)]">{t('spendlyUnavailable')}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {(['none', 'existing', 'new'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={mode === 'existing' && freeBills(editing.form.billId).length === 0}
                        onClick={() => set('billMode', mode)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                          editing.form.billMode === mode ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'
                        }`}
                      >
                        {t(`billMode_${mode}`)}
                      </button>
                    ))}
                  </div>
                  {editing.form.billMode === 'existing' && (
                    <select className={input} value={editing.form.billId} onChange={(e) => set('billId', e.target.value)} required>
                      <option value="">{t('chooseBill')}</option>
                      {freeBills(editing.form.billId).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.description} · {f.eur(b.amount)}
                        </option>
                      ))}
                    </select>
                  )}
                  {editing.form.billMode === 'new' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={label} htmlFor="ut-amount">
                          {t('billAmount')}
                        </label>
                        <input
                          id="ut-amount"
                          inputMode="decimal"
                          className={input}
                          value={editing.amountText}
                          onChange={(e) => setEditing((x) => (x ? { ...x, amountText: e.target.value } : x))}
                          placeholder="0,00"
                          required
                        />
                      </div>
                      <div>
                        <label className={label} htmlFor="ut-freq">
                          {ts('billFrequency')}
                        </label>
                        <select id="ut-freq" className={input} value={editing.form.billFrequency} onChange={(e) => set('billFrequency', e.target.value as UtilityForm['billFrequency'])}>
                          {BILL_FREQUENCIES.map((fr) => (
                            <option key={fr} value={fr}>
                              {ts(FREQUENCY_KEY[fr])}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={label} htmlFor="ut-start">
                          {t('billFirstDue')}
                        </label>
                        <input id="ut-start" type="date" className={input} value={editing.form.billStart} onChange={(e) => set('billStart', e.target.value)} required />
                      </div>
                      <p className="self-end text-xs text-[var(--muted)]">{t('billNewHint')}</p>
                    </div>
                  )}
                </>
              )}
            </fieldset>

            <div>
              <label className={label} htmlFor="ut-notes">
                {t('notes')}
              </label>
              <textarea id="ut-notes" className={`${input} min-h-[70px]`} value={editing.form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={500} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className={`${ghostBtn} flex-1`}>
                {t('cancel')}
              </button>
              <button type="submit" disabled={isPending} className={`${primaryBtn} flex-1`}>
                {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('save')}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Building2, LoaderCircle, Save, User } from 'lucide-react'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'
import { createReceipt, saveClient, saveProfile, updateReceipt } from '@/app/actions/ricevutaOccasionale'
import { validateIban } from '@/lib/iban'
import {
  RO_INPS_THRESHOLD_CENTS,
  RO_LIMITS,
  calcReceipt,
  centsToInput,
  checkClientTaxId,
  checkCodiceFiscale,
  cleanClientTaxId,
  formatCents,
  parseEuroToCents,
  romeTodayIso,
  type ClientForm,
  type ClientKind,
  type IssuerProfile,
  type OccasionalReceipt,
  type ReceiptClient,
  type StampCharge,
} from '@/lib/ricevutaOccasionale'

export const inputClass =
  'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
export const labelClass = 'mb-1 block text-sm font-semibold text-gray-700'
export const primaryClass =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-60'
const hintClass = 'mt-1 text-xs text-[var(--muted)]'

/** Testo dell'errore: le chiavi error_<codice>, altrimenti l'errore generico */
export function useErrorText() {
  const t = useTranslations('ricevutaOccasionale')
  return (code?: string) => (code && t.has(`error_${code}`) ? t(`error_${code}`) : t('error_saveError'))
}

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
      {text}
    </p>
  )
}

// ─── I tuoi dati ──────────────────────────────────────────────────────────

export function ProfileForm({ profile, onSaved }: { profile: IssuerProfile | null; onSaved: (p: IssuerProfile) => void }) {
  const t = useTranslations('ricevutaOccasionale')
  const errorText = useErrorText()
  const [form, setForm] = useState({
    fullName: profile?.full_name ?? '',
    taxCode: profile?.tax_code ?? '',
    address: profile?.address ?? '',
    city: profile?.city ?? '',
    iban: profile?.iban ?? '',
    defaultPlace: profile?.default_place ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDone(false)
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    // Gli stessi controlli del server, subito
    const cf = checkCodiceFiscale(form.taxCode)
    if (!form.fullName.trim()) return setError(errorText('nameRequired'))
    if (cf) return setError(errorText(cf === 'format' ? 'taxCodeFormat' : 'taxCodeChecksum'))
    if (form.iban.trim() && !validateIban(form.iban).valid) return setError(errorText('ibanInvalid'))
    setBusy(true)
    const result = await saveProfile(form)
    setBusy(false)
    if (!result.success) return setError(errorText(result.message))
    setDone(true)
    onSaved(result.data)
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div>
        <h3 className="text-lg font-bold text-[var(--ink)]">{t('profileTitle')}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('profileIntro')}</p>
      </div>
      <div>
        <label className={labelClass} htmlFor="ro-name">{t('fieldFullName')}</label>
        <input id="ro-name" className={inputClass} required maxLength={RO_LIMITS.name} autoComplete="name" value={form.fullName} onChange={set('fullName')} />
      </div>
      <div>
        <label className={labelClass} htmlFor="ro-cf">{t('fieldTaxCode')}</label>
        <input
          id="ro-cf"
          className={`${inputClass} uppercase`}
          required
          maxLength={20}
          autoCapitalize="characters"
          spellCheck={false}
          value={form.taxCode}
          onChange={set('taxCode')}
        />
        <p className={hintClass}>{t('fieldTaxCodeHint')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="ro-address">{t('fieldAddress')}</label>
          <input id="ro-address" className={inputClass} maxLength={RO_LIMITS.address} autoComplete="street-address" placeholder={t('fieldAddressPlaceholder')} value={form.address} onChange={set('address')} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ro-city">{t('fieldCity')}</label>
          <input id="ro-city" className={inputClass} maxLength={RO_LIMITS.city} placeholder={t('fieldCityPlaceholder')} value={form.city} onChange={set('city')} />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="ro-iban">{t('fieldIban')}</label>
        <input id="ro-iban" className={`${inputClass} uppercase`} maxLength={42} spellCheck={false} value={form.iban} onChange={set('iban')} />
        <p className={hintClass}>{t('fieldIbanHint')}</p>
      </div>
      <div>
        <label className={labelClass} htmlFor="ro-place">{t('fieldDefaultPlace')}</label>
        <input id="ro-place" className={inputClass} maxLength={RO_LIMITS.place} placeholder={t('fieldPlacePlaceholder')} value={form.defaultPlace} onChange={set('defaultPlace')} />
        <p className={hintClass}>{t('fieldDefaultPlaceHint')}</p>
      </div>
      <ErrorBox text={error} />
      {done && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{t('profileSaved')}</p>}
      <button type="submit" disabled={busy} className={primaryClass}>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('saveProfile')}
      </button>
    </form>
  )
}

// ─── Campi del cliente (finestra Cliente e cliente nuovo nella ricevuta) ──

function KindPicker({ value, onChange }: { value: ClientKind; onChange: (k: ClientKind) => void }) {
  const t = useTranslations('ricevutaOccasionale')
  const option = (kind: ClientKind, Icon: typeof User, title: string, text: string) => (
    <button
      type="button"
      aria-pressed={value === kind}
      onClick={() => onChange(kind)}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
        value === kind ? 'border-[var(--gold)] bg-[var(--gold-pale)]' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${value === kind ? 'text-[var(--ink)]' : 'text-gray-400'}`} />
      <span>
        <span className="block text-sm font-bold text-[var(--ink)]">{title}</span>
        <span className="block text-xs text-gray-600">{text}</span>
      </span>
    </button>
  )
  return (
    <div>
      <p className={labelClass}>{t('fieldKind')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {option('private', User, t('kindPrivate'), t('kindPrivateText'))}
        {option('withholding', Building2, t('kindWithholding'), t('kindWithholdingText'))}
      </div>
    </div>
  )
}

function ClientFields({ value, onChange, idPrefix }: { value: ClientForm; onChange: (v: ClientForm) => void; idPrefix: string }) {
  const t = useTranslations('ricevutaOccasionale')
  const set = (key: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value })
  return (
    <div className="space-y-4">
      <KindPicker value={value.kind} onChange={(kind) => onChange({ ...value, kind })} />
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-name`}>{t('fieldClientName')}</label>
        <input id={`${idPrefix}-name`} className={inputClass} maxLength={RO_LIMITS.name} value={value.name} onChange={set('name')} />
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-tax`}>
          {t('fieldClientTaxId')} {value.kind === 'private' && <span className="font-normal text-[var(--muted)]">{t('optional')}</span>}
        </label>
        <input id={`${idPrefix}-tax`} className={`${inputClass} uppercase`} maxLength={20} spellCheck={false} value={value.taxId} onChange={set('taxId')} />
        <p className={hintClass}>{t('fieldClientTaxIdHint')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-address`}>{t('fieldAddress')}</label>
          <input id={`${idPrefix}-address`} className={inputClass} maxLength={RO_LIMITS.address} placeholder={t('fieldAddressPlaceholder')} value={value.address} onChange={set('address')} />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-city`}>{t('fieldCity')}</label>
          <input id={`${idPrefix}-city`} className={inputClass} maxLength={RO_LIMITS.city} placeholder={t('fieldCityPlaceholder')} value={value.city} onChange={set('city')} />
        </div>
      </div>
    </div>
  )
}

/** Stessi controlli del server sul cliente, prima di inviare */
function clientError(c: ClientForm): string | null {
  if (!c.name.trim()) return 'clientNameRequired'
  const taxId = cleanClientTaxId(c.taxId)
  if (!taxId) return c.kind === 'withholding' ? 'clientTaxIdRequired' : null
  const err = checkClientTaxId(taxId)
  return err ? (err === 'format' ? 'clientTaxIdFormat' : 'clientTaxIdChecksum') : null
}

const emptyClient: ClientForm = { name: '', taxId: '', address: '', city: '', kind: 'private' }

export function ClientSheetForm({ client, onSaved }: { client: ReceiptClient | null; onSaved: (c: ReceiptClient) => void }) {
  const t = useTranslations('ricevutaOccasionale')
  const errorText = useErrorText()
  const [form, setForm] = useState<ClientForm>(
    client ? { name: client.name, taxId: client.tax_id ?? '', address: client.address ?? '', city: client.city ?? '', kind: client.kind } : emptyClient,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = clientError(form)
    if (err) return setError(errorText(err))
    setBusy(true)
    const result = await saveClient(client?.id ?? null, form)
    setBusy(false)
    if (!result.success) return setError(errorText(result.message))
    onSaved(result.data)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ClientFields value={form} onChange={setForm} idPrefix="ro-client" />
      <ErrorBox text={error} />
      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} />
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('saveClient')}
        </button>
      </div>
    </form>
  )
}

// ─── Ricevuta ─────────────────────────────────────────────────────────────

const NEW_CLIENT = '__new__'

export function ReceiptSheetForm({
  receipt,
  profile,
  clients,
  yearGrossCents,
  onSaved,
}: {
  receipt: OccasionalReceipt | null
  profile: IssuerProfile
  clients: ReceiptClient[]
  /** Compensi già segnati nell'anno, senza questa ricevuta (per l'avviso dei 5.000 €) */
  yearGrossCents: (year: number) => number
  onSaved: (r: OccasionalReceipt, newClient: ReceiptClient | null) => void
}) {
  const t = useTranslations('ricevutaOccasionale')
  const locale = useLocale()
  const errorText = useErrorText()
  const money = (c: number) => formatCents(c, locale)
  const today = romeTodayIso()

  const savedClient = receipt?.client_id ? clients.find((c) => c.id === receipt.client_id) : undefined
  const [clientChoice, setClientChoice] = useState<string>(savedClient?.id ?? (receipt || clients.length === 0 ? NEW_CLIENT : ''))
  const [newClient, setNewClient] = useState<ClientForm>(
    receipt && !savedClient
      ? { name: receipt.client_name, taxId: receipt.client_tax_id ?? '', address: receipt.client_address ?? '', city: receipt.client_city ?? '', kind: receipt.client_kind }
      : emptyClient,
  )
  const [rememberClient, setRememberClient] = useState(!receipt)
  const [issueDate, setIssueDate] = useState(receipt?.issue_date ?? today)
  const [place, setPlace] = useState(receipt ? (receipt.place ?? '') : (profile.default_place ?? ''))
  const [description, setDescription] = useState(receipt?.description ?? '')
  const [periodFrom, setPeriodFrom] = useState(receipt?.period_from ?? '')
  const [periodTo, setPeriodTo] = useState(receipt?.period_to ?? '')
  const [gross, setGross] = useState(receipt ? centsToInput(receipt.gross_cents) : '')
  const [expenses, setExpenses] = useState(receipt ? centsToInput(receipt.expenses_cents) : '')
  const [onBehalf, setOnBehalf] = useState(receipt?.expenses_on_behalf ?? false)
  const [stampCharge, setStampCharge] = useState<StampCharge>(receipt?.stamp_charge ?? 'client')
  const [stampId, setStampId] = useState(receipt?.stamp_id ?? '')
  const [paid, setPaid] = useState(!!receipt?.paid_on)
  const [paidOn, setPaidOn] = useState(receipt?.paid_on ?? today)
  const [note, setNote] = useState(receipt?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = clientChoice && clientChoice !== NEW_CLIENT ? clients.find((c) => c.id === clientChoice) : undefined
  const kind: ClientKind | null = chosen ? chosen.kind : clientChoice === NEW_CLIENT ? newClient.kind : null
  const grossCents = parseEuroToCents(gross)
  const expensesCents = expenses.trim() ? parseEuroToCents(expenses) : 0
  const calc = useMemo(
    () =>
      calcReceipt({
        grossCents: grossCents ?? 0,
        expensesCents: expensesCents ?? 0,
        expensesOnBehalf: onBehalf && kind === 'withholding' && (expensesCents ?? 0) > 0,
        withholding: kind === 'withholding',
        stampCharge,
      }),
    [grossCents, expensesCents, onBehalf, kind, stampCharge],
  )
  const year = Number(issueDate.slice(0, 4))
  const yearAfter = (Number.isFinite(year) ? yearGrossCents(year) : 0) + calc.taxableCents

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!clientChoice) return setError(errorText('clientMissing'))
    if (clientChoice === NEW_CLIENT) {
      const err = clientError(newClient)
      if (err) return setError(errorText(err))
    }
    if (!description.trim()) return setError(errorText('descriptionRequired'))
    if (!grossCents) return setError(errorText('grossInvalid'))
    if (expensesCents === null) return setError(errorText('expensesInvalid'))
    if (periodFrom && periodTo && periodTo < periodFrom) return setError(errorText('periodInvalid'))
    if (receipt && Number(issueDate.slice(0, 4)) !== receipt.year) return setError(errorText('yearChange'))
    setBusy(true)
    const form = {
      issueDate,
      place,
      clientId: chosen?.id ?? null,
      client: newClient,
      saveClient: clientChoice === NEW_CLIENT && rememberClient,
      description,
      periodFrom,
      periodTo,
      grossCents,
      expensesCents,
      expensesOnBehalf: onBehalf && kind === 'withholding' && expensesCents > 0,
      stampCharge,
      stampId,
      paidOn: paid ? paidOn : '',
      note,
    }
    const result = receipt ? await updateReceipt(receipt.id, form) : await createReceipt(form)
    setBusy(false)
    if (!result.success) return setError(errorText(result.message))
    onSaved(result.data.receipt, result.data.client)
  }

  const line = (labelText: string, value: string, strong = false) => (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${strong ? 'font-bold text-[var(--ink)]' : 'text-gray-700'}`}>
      <span>{labelText}</span>
      <span className="whitespace-nowrap tabular-nums">{value}</span>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Cliente */}
      <section className="space-y-3">
        <label className={labelClass} htmlFor="ro-client-choice">{t('fieldClient')}</label>
        <select id="ro-client-choice" className={inputClass} value={clientChoice} onChange={(e) => setClientChoice(e.target.value)}>
          {clients.length > 0 && <option value="">{t('chooseClient')}</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CLIENT}>{t('newClientOption')}</option>
        </select>
        {chosen && (
          <p className="rounded-xl bg-[var(--gold-pale)]/60 px-3 py-2 text-sm text-gray-700">
            {chosen.kind === 'withholding' ? t('kindWithholding') : t('kindPrivate')}
            {chosen.tax_id ? ` · ${chosen.tax_id}` : ''}
          </p>
        )}
        {clientChoice === NEW_CLIENT && (
          <div className="space-y-3 rounded-2xl border border-gray-200 p-4">
            <ClientFields value={newClient} onChange={setNewClient} idPrefix="ro-newclient" />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={rememberClient} onChange={(e) => setRememberClient(e.target.checked)} />
              {t('rememberClient')}
            </label>
          </div>
        )}
      </section>

      {/* Prestazione */}
      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ro-date">{t('fieldIssueDate')}</label>
            <input id="ro-date" type="date" required className={inputClass} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            {receipt && <p className={hintClass}>{t('fieldIssueDateLockedHint', { year: receipt.year })}</p>}
          </div>
          <div>
            <label className={labelClass} htmlFor="ro-place-r">{t('fieldPlace')}</label>
            <input id="ro-place-r" className={inputClass} maxLength={RO_LIMITS.place} placeholder={t('fieldPlacePlaceholder')} value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="ro-desc">{t('fieldDescription')}</label>
          <textarea
            id="ro-desc"
            rows={3}
            className={inputClass}
            maxLength={RO_LIMITS.description}
            placeholder={t('fieldDescriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="ro-from">{t('fieldPeriodFrom')}</label>
            <input id="ro-from" type="date" className={inputClass} value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="ro-to">{t('fieldPeriodTo')}</label>
            <input id="ro-to" type="date" className={inputClass} value={periodTo} min={periodFrom || undefined} onChange={(e) => setPeriodTo(e.target.value)} />
          </div>
        </div>
        <p className={`${hintClass} -mt-2`}>{t('fieldPeriodHint')}</p>
      </section>

      {/* Importi */}
      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ro-gross">{t('fieldGross')}</label>
            <input id="ro-gross" inputMode="decimal" className={inputClass} placeholder="0,00" value={gross} onChange={(e) => setGross(e.target.value)} />
            {gross.trim() && grossCents === null && <p className="mt-1 text-xs font-semibold text-red-600">{t('amountInvalid')}</p>}
            <p className={hintClass}>{t('fieldGrossHint')}</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="ro-exp">
              {t('fieldExpenses')} <span className="font-normal text-[var(--muted)]">{t('optional')}</span>
            </label>
            <input id="ro-exp" inputMode="decimal" className={inputClass} placeholder="0,00" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
            {expensesCents === null && <p className="mt-1 text-xs font-semibold text-red-600">{t('amountInvalid')}</p>}
          </div>
        </div>
        {(expensesCents ?? 0) > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p>{t('expensesWarning')}</p>
            {kind === 'withholding' && (
              <label className="mt-2 flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]" checked={onBehalf} onChange={(e) => setOnBehalf(e.target.checked)} />
                <span>{t('expensesOnBehalf')}</span>
              </label>
            )}
          </div>
        )}

        {/* Conti fatti da soli */}
        <div className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/40 p-4 text-[15px]">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{t('calcTitle')}</p>
          {line(t('calcGross'), money(calc.grossCents))}
          {calc.expensesCents > 0 && line(t('calcExpenses'), money(calc.expensesCents))}
          {calc.stampCents > 0 && line(t('calcStampCharged'), money(calc.stampCents))}
          {line(t('calcTotal'), money(calc.totalCents), true)}
          {kind === 'withholding'
            ? line(t('calcWithholding', { base: money(calc.taxableCents) }), `− ${money(calc.withholdingCents)}`)
            : kind === 'private' && <p className="py-1.5 text-sm text-gray-600">{t('calcNoWithholding')}</p>}
          <div className="mt-2 border-t border-[var(--gold)]/30 pt-2">{line(t('calcNet'), money(calc.netCents), true)}</div>
          {!kind && <p className="mt-1 text-xs text-[var(--muted)]">{t('calcChooseClient')}</p>}
        </div>

        {/* Marca da bollo */}
        {calc.stampRequired ? (
          <div className="space-y-3 rounded-2xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">{t('stampRequired')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['client', 'issuer'] as const).map((charge) => (
                <label
                  key={charge}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${stampCharge === charge ? 'border-[var(--gold)] bg-[var(--gold-pale)]' : 'border-gray-200'}`}
                >
                  <input type="radio" name="ro-stamp" className="mt-0.5 accent-[var(--gold)]" checked={stampCharge === charge} onChange={() => setStampCharge(charge)} />
                  <span>{charge === 'client' ? t('stampChargeClient') : t('stampChargeIssuer')}</span>
                </label>
              ))}
            </div>
            <div>
              <label className={labelClass} htmlFor="ro-stamp-id">
                {t('fieldStampId')} <span className="font-normal text-[var(--muted)]">{t('optional')}</span>
              </label>
              <input id="ro-stamp-id" inputMode="numeric" className={inputClass} maxLength={24} value={stampId} onChange={(e) => setStampId(e.target.value)} />
              <p className={hintClass}>{t('fieldStampIdHint')}</p>
            </div>
          </div>
        ) : (
          calc.grossCents > 0 && <p className={hintClass}>{t('stampNotRequired')}</p>
        )}

        {yearAfter > RO_INPS_THRESHOLD_CENTS && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{t('inpsOverInForm', { total: money(yearAfter), year })}</p>
        )}
      </section>

      {/* Pagamento e note */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" className="h-4 w-4 accent-[var(--gold)]" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          {t('fieldPaid')}
        </label>
        {paid && (
          <div>
            <label className={labelClass} htmlFor="ro-paid-on">{t('fieldPaidOn')}</label>
            <input id="ro-paid-on" type="date" className={inputClass} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
        )}
        <div>
          <label className={labelClass} htmlFor="ro-note">
            {t('fieldNote')} <span className="font-normal text-[var(--muted)]">{t('optional')}</span>
          </label>
          <textarea id="ro-note" rows={2} className={inputClass} maxLength={RO_LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} />
          <p className={hintClass}>{t('fieldNoteHint')}</p>
        </div>
      </section>

      <ErrorBox text={error} />
      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-gray-100 bg-white px-5 pb-1 pt-3">
        <CancelButton className={cancelButtonLgClass} />
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {receipt ? t('saveReceipt') : t('createReceipt')}
        </button>
      </div>
    </form>
  )
}

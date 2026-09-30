'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Ban,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  HandCoins,
  Info,
  KeyRound,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Search,
  UserPlus,
  Wand2,
  X,
} from 'lucide-react'
import {
  adminCancelAgentCommission,
  adminCreateAgent,
  adminListAgentCommissions,
  adminListAgents,
  adminPayAgentCommissions,
  adminSetAgentActive,
  adminSetAgentPassword,
  adminUpdateAgent,
  type AdminAgent,
  type AdminCommission,
  type AgentInput,
} from '@/app/actions/agents'
import {
  TAX_REGIMES,
  TAX_REGIME_LABELS,
  formatEuroCents,
  isValidFiscalCode,
  isValidIban,
  isValidSdiCode,
  isValidVatNumber,
  type TaxRegime,
} from '@/lib/agents'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9 ()-]{6,30}$/
const MIN_PASSWORD = 10

const euro = (cents: number) => formatEuroCents(cents, 'it')
const day = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium' }).format(new Date(iso)) : '—'
// Data "YYYY-MM-DD" (senza ora) in formato italiano
const dateOnly = (value: string | null | undefined) => {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : value
}
const todayRome = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
const regimeLabel = (r: string) => ((TAX_REGIMES as readonly string[]).includes(r) ? TAX_REGIME_LABELS[r as TaxRegime] : r)

// Password casuale di 14 caratteri (senza caratteri che si confondono: 0/O, 1/l/I)
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?-_'
function generatePassword(length = 14) {
  const values = new Uint32Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (v) => PASSWORD_ALPHABET[v % PASSWORD_ALPHABET.length]).join('')
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function CopyButton({ text, label = 'Copia', className = '' }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      disabled={!text}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
      className={`flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 ${className}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copiato' : label}
    </button>
  )
}

// Campo password con mostra/nascondi, "Genera" e copia
function PasswordField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          placeholder={`Almeno ${MIN_PASSWORD} caratteri`}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          title={visible ? 'Nascondi' : 'Mostra'}
          aria-label={visible ? 'Nascondi password' : 'Mostra password'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-[var(--ink)]"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          onChange(generatePassword())
          setVisible(true)
        }}
        className="flex items-center gap-1 rounded-lg border border-[var(--gold)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-gray-50"
      >
        <Wand2 className="h-3.5 w-3.5" /> Genera
      </button>
      <CopyButton text={value} />
    </div>
  )
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>
}

const inputClass = (invalid: boolean) =>
  `mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)] ${
    invalid ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
  }`
const smallBtn =
  'flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50'
const primaryBtn =
  'flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50'

// ── Modulo agente (nuovo / modifica) ───────────────────────────────────

type FormValues = {
  firstName: string
  lastName: string
  email: string
  password: string
  phone: string
  dateOfBirth: string
  fiscalCode: string
  address: string
  postalCode: string
  city: string
  province: string
  countryCode: string
  taxRegime: string
  businessName: string
  vatNumber: string
  pec: string
  sdiCode: string
  iban: string
  commissionFirstPct: string
  commissionRenewalPct: string
  notes: string
}
type FieldName = keyof FormValues
type FieldErrors = Partial<Record<FieldName, string>>

const EMPTY_FORM: FormValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  fiscalCode: '',
  address: '',
  postalCode: '',
  city: '',
  province: '',
  countryCode: 'IT',
  taxRegime: 'partita_iva',
  businessName: '',
  vatNumber: '',
  pec: '',
  sdiCode: '',
  iban: '',
  commissionFirstPct: '20',
  commissionRenewalPct: '10',
  notes: '',
}

function valuesFromAgent(a: AdminAgent): FormValues {
  return {
    firstName: a.firstName,
    lastName: a.lastName,
    email: a.email,
    password: '',
    phone: a.phone,
    dateOfBirth: a.dateOfBirth ? a.dateOfBirth.slice(0, 10) : '',
    fiscalCode: a.fiscalCode,
    address: a.address,
    postalCode: a.postalCode,
    city: a.city,
    province: a.province,
    countryCode: a.countryCode || 'IT',
    taxRegime: a.taxRegime,
    businessName: a.businessName ?? '',
    vatNumber: a.vatNumber ?? '',
    pec: a.pec ?? '',
    sdiCode: a.sdiCode ?? '',
    iban: a.iban ?? '',
    commissionFirstPct: String(a.commissionFirstPct),
    commissionRenewalPct: String(a.commissionRenewalPct),
    notes: a.notes ?? '',
  }
}

const parsePct = (v: string) => Number(v.replace(',', '.'))

function validate(v: FormValues, isCreate: boolean): FieldErrors {
  const e: FieldErrors = {}
  if (!v.firstName.trim()) e.firstName = 'Obbligatorio'
  if (!v.lastName.trim()) e.lastName = 'Obbligatorio'
  if (isCreate) {
    if (!EMAIL_RE.test(v.email.trim())) e.email = 'Email non valida'
    if (v.password.length < MIN_PASSWORD) e.password = `Almeno ${MIN_PASSWORD} caratteri`
  }
  if (!PHONE_RE.test(v.phone.trim())) e.phone = 'Telefono non valido'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.dateOfBirth)) e.dateOfBirth = 'Data non valida'
  if (!isValidFiscalCode(v.fiscalCode)) e.fiscalCode = 'Codice fiscale non valido (controlla il carattere finale)'
  if (!v.address.trim()) e.address = 'Obbligatoria'
  if (!v.postalCode.trim()) e.postalCode = 'Obbligatorio'
  if (!v.city.trim()) e.city = 'Obbligatoria'
  if (!/^[A-Za-z]{2}$/.test(v.countryCode.trim())) e.countryCode = 'Codice di 2 lettere (es. IT)'
  if (!(TAX_REGIMES as readonly string[]).includes(v.taxRegime)) e.taxRegime = 'Scegli il regime'
  const vat = v.vatNumber.trim()
  if (v.taxRegime !== 'occasionale' && !vat) e.vatNumber = 'Obbligatoria salvo prestazione occasionale'
  else if (vat && !isValidVatNumber(vat)) e.vatNumber = 'Partita IVA non valida'
  if (v.pec.trim() && !EMAIL_RE.test(v.pec.trim())) e.pec = 'PEC non valida'
  if (v.sdiCode.trim() && !isValidSdiCode(v.sdiCode)) e.sdiCode = 'Codice SDI di 7 caratteri'
  if (v.iban.trim() && !isValidIban(v.iban)) e.iban = 'IBAN non valido'
  const first = parsePct(v.commissionFirstPct)
  if (!v.commissionFirstPct.trim() || !Number.isFinite(first) || first < 0 || first > 100) e.commissionFirstPct = 'Da 0 a 100'
  const renewal = parsePct(v.commissionRenewalPct)
  if (!v.commissionRenewalPct.trim() || !Number.isFinite(renewal) || renewal < 0 || renewal > 100) e.commissionRenewalPct = 'Da 0 a 100'
  return e
}

function toInput(v: FormValues, isCreate: boolean): AgentInput {
  return {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    email: v.email.trim().toLowerCase(),
    password: isCreate ? v.password : undefined,
    phone: v.phone.trim(),
    dateOfBirth: v.dateOfBirth,
    fiscalCode: v.fiscalCode.trim().toUpperCase(),
    address: v.address.trim(),
    postalCode: v.postalCode.trim(),
    city: v.city.trim(),
    province: v.province.trim().toUpperCase(),
    countryCode: v.countryCode.trim().toUpperCase(),
    taxRegime: v.taxRegime,
    businessName: v.businessName.trim(),
    vatNumber: v.vatNumber.trim(),
    pec: v.pec.trim(),
    sdiCode: v.sdiCode.trim().toUpperCase(),
    iban: v.iban.trim(),
    commissionFirstPct: parsePct(v.commissionFirstPct),
    commissionRenewalPct: parsePct(v.commissionRenewalPct),
    notes: v.notes.trim(),
  }
}

function Field({ label, error, children, className = '' }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="text-xs font-semibold uppercase text-gray-500">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-gray-200 p-3">
      <legend className="px-1 text-sm font-bold text-[var(--ink)]">{title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  )
}

function AgentForm({
  initial,
  isCreate,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormValues
  isCreate: boolean
  submitLabel: string
  onSubmit: (input: AgentInput) => Promise<{ success: boolean; error?: string }>
  onCancel?: () => void
}) {
  const [values, setValues] = useState<FormValues>(initial)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (name: FieldName, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
  }
  const text = (name: FieldName, props: { type?: string; placeholder?: string; maxLength?: number; mono?: boolean; upper?: boolean; autoComplete?: string } = {}) => (
    <input
      type={props.type ?? 'text'}
      value={values[name]}
      onChange={(e) => set(name, props.upper ? e.target.value.toUpperCase() : e.target.value)}
      placeholder={props.placeholder}
      maxLength={props.maxLength}
      autoComplete={props.autoComplete ?? 'off'}
      aria-invalid={!!errors[name]}
      className={`${inputClass(!!errors[name])} ${props.mono ? 'font-mono' : ''}`}
    />
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    const found = validate(values, isCreate)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setServerError('Controlla i campi evidenziati.')
      return
    }
    setSaving(true)
    try {
      const result = await onSubmit(toInput(values, isCreate))
      if (!result.success) {
        setServerError(result.error || 'Operazione non riuscita')
        return
      }
      if (isCreate) setValues(EMPTY_FORM)
    } catch (err) {
      setServerError('Errore: ' + errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const vatRequired = values.taxRegime !== 'occasionale'

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Group title="Dati personali">
        <Field label="Nome" error={errors.firstName}>
          {text('firstName', { maxLength: 80 })}
        </Field>
        <Field label="Cognome" error={errors.lastName}>
          {text('lastName', { maxLength: 80 })}
        </Field>
        {isCreate ? (
          <Field label="Email" error={errors.email}>
            {text('email', { type: 'email', placeholder: 'agente@esempio.com', maxLength: 200 })}
          </Field>
        ) : (
          <Field label="Email (non modificabile)">
            <input value={values.email} disabled className={`${inputClass(false)} bg-gray-100 text-gray-500`} />
          </Field>
        )}
        {isCreate && (
          <div className="block text-sm sm:col-span-2 lg:col-span-3">
            <span className="text-xs font-semibold uppercase text-gray-500">Password</span>
            <div className="mt-1">
              <PasswordField value={values.password} onChange={(v) => set('password', v)} />
            </div>
            {errors.password && <span className="mt-1 block text-xs text-red-700">{errors.password}</span>}
          </div>
        )}
        <Field label="Telefono" error={errors.phone}>
          {text('phone', { type: 'tel', placeholder: '+39 333 1234567', maxLength: 30 })}
        </Field>
        <Field label="Data di nascita" error={errors.dateOfBirth}>
          {text('dateOfBirth', { type: 'date' })}
        </Field>
        <Field label="Codice fiscale" error={errors.fiscalCode}>
          {text('fiscalCode', { maxLength: 16, mono: true, upper: true })}
        </Field>
      </Group>

      <Group title="Indirizzo">
        <Field label="Via e numero" error={errors.address} className="sm:col-span-2">
          {text('address', { maxLength: 200 })}
        </Field>
        <Field label="CAP" error={errors.postalCode}>
          {text('postalCode', { maxLength: 10 })}
        </Field>
        <Field label="Città" error={errors.city}>
          {text('city', { maxLength: 80 })}
        </Field>
        <Field label="Provincia" error={errors.province}>
          {text('province', { maxLength: 40, placeholder: 'Es. MI', upper: true })}
        </Field>
        <Field label="Paese" error={errors.countryCode}>
          {text('countryCode', { maxLength: 2, placeholder: 'IT', upper: true })}
        </Field>
      </Group>

      <Group title="Fiscale">
        <Field label="Regime" error={errors.taxRegime}>
          <select value={values.taxRegime} onChange={(e) => set('taxRegime', e.target.value)} className={`${inputClass(!!errors.taxRegime)} bg-white`}>
            {TAX_REGIMES.map((r) => (
              <option key={r} value={r}>
                {TAX_REGIME_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ragione sociale (facoltativa)" error={errors.businessName}>
          {text('businessName', { maxLength: 120 })}
        </Field>
        <Field label={vatRequired ? 'Partita IVA' : 'Partita IVA (facoltativa)'} error={errors.vatNumber}>
          {text('vatNumber', { maxLength: 13, mono: true, placeholder: '11 cifre' })}
        </Field>
        <Field label="PEC (facoltativa)" error={errors.pec}>
          {text('pec', { type: 'email', maxLength: 120 })}
        </Field>
        <Field label="Codice SDI (facoltativo)" error={errors.sdiCode}>
          {text('sdiCode', { maxLength: 7, mono: true, upper: true, placeholder: '7 caratteri' })}
        </Field>
        <Field label="IBAN (per i bonifici)" error={errors.iban}>
          {text('iban', { maxLength: 42, mono: true, upper: true })}
        </Field>
      </Group>

      <Group title="Provvigioni">
        <Field label="Prima vendita %" error={errors.commissionFirstPct}>
          {text('commissionFirstPct', { maxLength: 6 })}
        </Field>
        <Field label="Rinnovi %" error={errors.commissionRenewalPct}>
          {text('commissionRenewalPct', { maxLength: 6 })}
        </Field>
        <p className="self-end text-xs text-gray-500">Calcolate sull&apos;imponibile (importo pagato senza IVA).</p>
      </Group>

      <Field label="Note (visibili solo allo Staff)">
        <textarea
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          maxLength={2000}
          className={inputClass(false)}
        />
      </Field>

      <ErrorBox message={serverError} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isCreate ? <UserPlus className="h-4 w-4" /> : <Check className="h-4 w-4" />} {submitLabel}
        </button>
        {onCancel && (
          <button type="button" disabled={saving} onClick={onCancel} className={smallBtn}>
            Annulla
          </button>
        )}
      </div>
    </form>
  )
}

// ── Credenziali del nuovo agente ────────────────────────────────────────

type Credentials = { url: string; email: string; password: string; name: string; code: string; link: string }

function CredentialsBox({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Indirizzo', credentials.url],
    ['Email', credentials.email],
    ['Password', credentials.password],
    ['Codice agente', credentials.code],
    ['Link agente', credentials.link],
  ]
  const all = rows.map(([k, v]) => `${k}: ${v}`).join('\n')
  return (
    <div className="rounded-xl border border-[var(--gold)] bg-[var(--gold-pale)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-[var(--ink)]">Agente {credentials.name} creato. Comunica all&apos;agente:</p>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="text-gray-500 hover:text-[var(--ink)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <dl className="mt-3 space-y-1 rounded-lg bg-white p-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap gap-2">
            <dt className="w-28 font-semibold text-gray-500">{k}</dt>
            <dd className="min-w-0 flex-1 break-all font-mono text-gray-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <CopyButton text={all} label="Copia tutto" />
        <CopyButton text={credentials.link} label="Copia link" />
        <p className="text-xs font-semibold text-amber-800">La password non verrà più mostrata: copiala ora e inviala all&apos;agente.</p>
      </div>
    </div>
  )
}

// ── Provvigioni di un agente ────────────────────────────────────────────

type Payout = { id: string; paidOn: string; amountCents: number; reference: string | null }

const KIND_LABELS: Record<AdminCommission['kind'], string> = { first: 'Prima vendita', renewal: 'Rinnovo', adjustment: 'Rettifica' }
const PLAN_LABELS: Record<string, string> = { base: 'Base', pro: 'Pro' }

function stateText(c: AdminCommission) {
  if (c.state === 'pending') return `in maturazione fino al ${day(c.maturesAt)}`
  if (c.state === 'matured') return 'maturata'
  if (c.state === 'paid') return c.paidOn ? `pagata il ${dateOnly(c.paidOn)}` : 'pagata'
  return 'annullata'
}
const STATE_CLASS: Record<AdminCommission['state'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  matured: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-600',
}

const csvCell = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

function exportCsv(agent: AdminAgent, commissions: AdminCommission[]) {
  const header = ['Data', 'Cliente', 'Tipo', 'Piano', 'Lordo', 'Imponibile', '%', 'Provvigione', 'Stato', 'Matura il', 'Pagata il', 'Nota']
  const lines = commissions.map((c) =>
    [
      day(c.createdAt),
      c.customer,
      KIND_LABELS[c.kind],
      c.plan ? PLAN_LABELS[c.plan] : '',
      csvMoney(c.grossCents),
      csvMoney(c.netCents),
      String(c.pct).replace('.', ','),
      csvMoney(c.commissionCents),
      { pending: 'In maturazione', matured: 'Maturata', paid: 'Pagata', cancelled: 'Annullata' }[c.state],
      day(c.maturesAt),
      c.paidOn ? dateOnly(c.paidOn) : '',
      c.note ?? '',
    ]
      .map(csvCell)
      .join(';'),
  )
  const csv = '﻿' + [header.join(';'), ...lines].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `provvigioni-${agent.code}-${todayRome()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function CommissionsDetail({ agent, onChanged }: { agent: AdminAgent; onChanged: () => Promise<void> }) {
  const [commissions, setCommissions] = useState<AdminCommission[] | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [paidOn, setPaidOn] = useState(todayRome())
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const result = await adminListAgentCommissions(agent.id)
      if ('error' in result) {
        setError(result.error)
        setCommissions((prev) => prev ?? [])
      } else {
        setCommissions(result.commissions)
        setPayouts(result.payouts)
        setSelected(new Set())
      }
    } catch (err) {
      setError('Errore: ' + errorText(err))
      setCommissions((prev) => prev ?? [])
    }
  }, [agent.id])

  useEffect(() => {
    // Caricamento dal server all'apertura (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const matured = useMemo(() => (commissions ?? []).filter((c) => c.state === 'matured'), [commissions])
  const selectedTotal = useMemo(() => matured.filter((c) => selected.has(c.id)).reduce((n, c) => n + c.commissionCents, 0), [matured, selected])
  const allSelected = matured.length > 0 && matured.every((c) => selected.has(c.id))

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const pay = async () => {
    setError(null)
    setNotice(null)
    const ids = matured.filter((c) => selected.has(c.id)).map((c) => c.id)
    if (ids.length === 0) return setError('Seleziona almeno una provvigione maturata.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return setError('Data del pagamento non valida.')
    const ok = confirm(
      `Registrare il pagamento di ${euro(selectedTotal)} a ${agent.firstName} ${agent.lastName}?\n\n` +
        `${ids.length} ${ids.length === 1 ? 'provvigione' : 'provvigioni'} · bonifico del ${dateOnly(paidOn)}` +
        (reference.trim() ? ` · rif. ${reference.trim()}` : '') +
        `\n\nFallo solo dopo aver eseguito il bonifico.`,
    )
    if (!ok) return
    setBusy(true)
    try {
      const result = await adminPayAgentCommissions(agent.id, ids, paidOn, reference)
      if (!result.success) {
        setError(result.error)
        return
      }
      setNotice(`Pagamento registrato: ${euro(result.amountCents)} (${result.count} ${result.count === 1 ? 'provvigione' : 'provvigioni'}).`)
      setReference('')
      await load()
      await onChanged()
    } catch (err) {
      setError('Errore: ' + errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (c: AdminCommission) => {
    setError(null)
    setNotice(null)
    const note = prompt(`Motivo dell'annullamento della provvigione di ${euro(c.commissionCents)} (${c.customer}):`, '')
    if (note === null) return
    if (!confirm(`Annullare la provvigione di ${euro(c.commissionCents)}? L'operazione non si può annullare.`)) return
    setBusy(true)
    try {
      const result = await adminCancelAgentCommission(c.id, note)
      if (!result.success) {
        setError(result.error)
        return
      }
      setNotice('Provvigione annullata.')
      await load()
      await onChanged()
    } catch (err) {
      setError('Errore: ' + errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 space-y-4 rounded-lg bg-gray-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <HandCoins className="h-4 w-4" /> Provvigioni di {agent.firstName} {agent.lastName}
        </h4>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!commissions || commissions.length === 0} onClick={() => commissions && exportCsv(agent, commissions)} className={smallBtn}>
            <Download className="h-3.5 w-3.5" /> Esporta CSV
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCommissions(null)
              load()
            }}
            className={smallBtn}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
          </button>
        </div>
      </div>

      <ErrorBox message={error} />
      {notice && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      {commissions === null ? (
        <div className="flex justify-center py-6">
          <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : commissions.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-center text-sm text-gray-500">Nessuna provvigione ancora.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Seleziona tutte le maturate"
                      disabled={matured.length === 0 || busy}
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(matured.map((c) => c.id)))}
                      className="accent-[var(--ink)]"
                    />
                  </th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Piano</th>
                  <th className="px-3 py-2 text-right">Lordo</th>
                  <th className="px-3 py-2 text-right">Imponibile</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Provvigione</th>
                  <th className="px-3 py-2">Stato</th>
                  <th className="px-3 py-2">Nota</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {commissions.map((c) => (
                  <tr key={c.id} className={selected.has(c.id) ? 'bg-[var(--gold-pale)]' : ''}>
                    <td className="px-3 py-2">
                      {c.state === 'matured' && (
                        <input
                          type="checkbox"
                          aria-label="Seleziona"
                          disabled={busy}
                          checked={selected.has(c.id)}
                          onChange={() => toggle(c.id)}
                          className="accent-[var(--ink)]"
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{day(c.createdAt)}</td>
                    <td className="px-3 py-2">{c.customer}</td>
                    <td className="whitespace-nowrap px-3 py-2">{KIND_LABELS[c.kind]}</td>
                    <td className="px-3 py-2">{c.plan ? PLAN_LABELS[c.plan] : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{euro(c.grossCents)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{euro(c.netCents)}</td>
                    <td className="px-3 py-2 text-right">{c.pct}%</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${c.state === 'cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {euro(c.commissionCents)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_CLASS[c.state]}`}>{stateText(c)}</span>
                    </td>
                    <td className="max-w-[200px] break-words px-3 py-2 text-xs text-gray-600">{c.note ?? ''}</td>
                    <td className="px-3 py-2">
                      {(c.state === 'pending' || c.state === 'matured') && (
                        <button type="button" disabled={busy} onClick={() => cancel(c)} className={`${smallBtn} text-red-700`}>
                          <Ban className="h-3.5 w-3.5" /> Annulla
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button
                type="button"
                disabled={matured.length === 0 || busy}
                onClick={() => setSelected(new Set(matured.map((c) => c.id)))}
                className={smallBtn}
              >
                <Check className="h-3.5 w-3.5" /> Seleziona tutte le maturate
              </button>
              {selected.size > 0 && (
                <button type="button" disabled={busy} onClick={() => setSelected(new Set())} className={smallBtn}>
                  Deseleziona
                </button>
              )}
              <span className="text-gray-700">
                Selezionate: <strong>{matured.filter((c) => selected.has(c.id)).length}</strong> · Totale{' '}
                <strong className="text-[var(--ink)]">{euro(selectedTotal)}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-sm">
                <span className="text-xs font-semibold uppercase text-gray-500">Data del bonifico</span>
                <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass(false)} />
              </label>
              <label className="block min-w-[220px] flex-1 text-sm">
                <span className="text-xs font-semibold uppercase text-gray-500">Riferimento (es. CRO del bonifico)</span>
                <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} className={inputClass(false)} />
              </label>
              <button type="button" disabled={busy || selectedTotal === 0} onClick={pay} className={primaryBtn}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />} Registra pagamento
              </button>
            </div>
          </div>
        </>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Pagamenti</p>
        {payouts.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun pagamento registrato.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-gray-700">{dateOnly(p.paidOn)}</span>
                <span className="font-semibold text-gray-900">{euro(p.amountCents)}</span>
                <span className="min-w-0 break-all text-xs text-gray-500">{p.reference ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Riga agente ─────────────────────────────────────────────────────────

type RowMode = null | 'edit' | 'password' | 'commissions'

function AgentRow({ agent, onChanged }: { agent: AdminAgent; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<RowMode>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const name = `${agent.firstName} ${agent.lastName}`.trim() || agent.email

  const open = (next: RowMode) => {
    setError(null)
    setNotice(null)
    setPassword('')
    setMode(mode === next ? null : next)
  }

  const run = async (action: () => Promise<{ success: boolean; error?: string }>, done?: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await action()
      if (!result.success) {
        setError(result.error || 'Operazione non riuscita')
        return false
      }
      setMode(null)
      if (done) setNotice(done)
      await onChanged()
      return true
    } catch (err) {
      setError('Errore: ' + errorText(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const savePassword = () => {
    if (password.length < MIN_PASSWORD) return setError(`La password deve avere almeno ${MIN_PASSWORD} caratteri.`)
    return run(() => adminSetAgentPassword(agent.id, password), "Password cambiata. Comunicala all'agente: non verrà più mostrata.")
  }
  const toggleActive = () => {
    const suspend = agent.isActive
    const ok = confirm(
      suspend
        ? `Sospendere ${name}? Non potrà più entrare e perde i servizi finché non lo riattivi. Le provvigioni restano.`
        : `Riattivare ${name}? Potrà di nuovo entrare con la sua password.`,
    )
    if (!ok) return
    return run(() => adminSetAgentActive(agent.id, !suspend), suspend ? 'Agente sospeso.' : 'Agente riattivato.')
  }

  const active = (m: RowMode) => (mode === m ? 'border-[var(--ink)] bg-gray-100' : '')

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900">
            {name} <span className="ml-1 font-mono text-xs font-semibold text-gray-500">{agent.code}</span>
          </p>
          <p className="break-all text-xs text-gray-500">
            {agent.email || '—'} · {agent.phone || '—'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-full bg-[var(--gold-pale)] px-2 py-0.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--gold)]/50">
              {regimeLabel(agent.taxRegime)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${agent.isActive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              {agent.isActive ? 'Attivo' : 'Sospeso'}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
              {agent.customers} {agent.customers === 1 ? 'cliente' : 'clienti'}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
              {agent.commissionFirstPct}% prima vendita · {agent.commissionRenewalPct}% rinnovi
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-right text-xs">
          <div>
            <dt className="text-gray-500">In maturazione</dt>
            <dd className="text-sm font-semibold text-amber-800">{euro(agent.pendingCents)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Da pagare (maturato)</dt>
            <dd className="text-sm font-bold text-[var(--ink)]">{euro(agent.maturedCents)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Pagato</dt>
            <dd className="text-sm font-semibold text-green-800">{euro(agent.paidCents)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => open('edit')} className={`${smallBtn} ${active('edit')}`}>
          <Pencil className="h-3.5 w-3.5" /> Modifica
        </button>
        <button type="button" disabled={busy} onClick={() => open('password')} className={`${smallBtn} ${active('password')}`}>
          <KeyRound className="h-3.5 w-3.5" /> Password
        </button>
        <button type="button" disabled={busy} onClick={toggleActive} className={smallBtn}>
          {agent.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {agent.isActive ? 'Sospendi' : 'Riattiva'}
        </button>
        <button type="button" disabled={busy} onClick={() => open('commissions')} className={`${smallBtn} ${active('commissions')}`}>
          <HandCoins className="h-3.5 w-3.5" /> Provvigioni
        </button>
        {busy && <LoaderCircle className="h-4 w-4 animate-spin self-center text-gray-400" />}
      </div>

      {mode === 'edit' && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <AgentForm
            initial={valuesFromAgent(agent)}
            isCreate={false}
            submitLabel="Salva modifiche"
            onCancel={() => setMode(null)}
            onSubmit={async (input) => {
              const result = await adminUpdateAgent(agent.id, input)
              if (result.success) {
                setMode(null)
                setNotice('Dati dell\'agente aggiornati.')
                await onChanged()
              }
              return result
            }}
          />
        </div>
      )}

      {mode === 'password' && (
        <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
          <PasswordField value={password} onChange={setPassword} />
          <p className="text-xs text-gray-500">Copia la nuova password prima di salvare: dopo non verrà più mostrata.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={savePassword}
              className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Salva
            </button>
            <button type="button" disabled={busy} onClick={() => setMode(null)} className={smallBtn}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {mode === 'commissions' && <CommissionsDetail agent={agent} onChanged={onChanged} />}

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
    </div>
  )
}

// Admin → Agenti: account separati per i venditori che portano clienti con il
// loro link e guadagnano una provvigione sugli abbonamenti.
export default function AgentsPanel() {
  const [agents, setAgents] = useState<AdminAgent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const result = await adminListAgents()
      if ('error' in result) {
        setError(result.error)
        setAgents((prev) => prev ?? [])
      } else setAgents(result.agents)
    } catch (err) {
      setError('Errore: ' + errorText(err))
      setAgents((prev) => prev ?? [])
    }
  }, [])

  useEffect(() => {
    // Caricamento dal server all'apertura (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return agents ?? []
    return (agents ?? []).filter((a) =>
      [`${a.firstName} ${a.lastName}`, `${a.lastName} ${a.firstName}`, a.code, a.email].some((v) => v.toLowerCase().includes(q)),
    )
  }, [agents, query])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <BriefcaseBusiness className="h-6 w-6" /> Agenti
        </h2>
        <p className="mt-1 text-gray-600">Venditori che portano nuovi clienti con il loro link e ricevono una provvigione sugli abbonamenti.</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Gli agenti sono account separati creati dallo Staff: hanno un profilo completo ma non hanno rete, matrice né dashboard. Hanno il piano Pro
            incluso per conoscere i servizi.
          </li>
          <li>
            Guadagnano una percentuale sugli abbonamenti pagati dai clienti che si iscrivono dal loro link (% prima vendita e % rinnovi), calcolata
            sull&apos;imponibile.
          </li>
          <li>Le provvigioni maturano dopo 14 giorni (diritto di recesso); i rimborsi le annullano.</li>
          <li>I pagamenti si fanno con bonifico e si segnano qui.</li>
          <li>L&apos;agente deve avere una posizione fiscale regolare (Partita IVA, prestazione occasionale o contratto di agenzia): verifica con il tuo commercialista.</li>
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          className="flex w-full items-center justify-between gap-2 p-4 text-left"
        >
          <span className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <UserPlus className="h-5 w-5" /> Nuovo agente
          </span>
          {formOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
        </button>
        {formOpen && (
          <div className="border-t border-gray-100 p-4">
            <AgentForm
              initial={EMPTY_FORM}
              isCreate
              submitLabel="Crea agente"
              onSubmit={async (input) => {
                const result = await adminCreateAgent(input)
                if (result.success) {
                  const origin = window.location.origin
                  setCredentials({
                    url: `${origin}/login`,
                    email: input.email,
                    password: input.password ?? '',
                    name: `${input.firstName} ${input.lastName}`,
                    code: result.code,
                    link: `${origin}/register?agente=${result.code}`,
                  })
                  setFormOpen(false)
                  load()
                }
                return result
              }}
            />
          </div>
        )}
      </div>

      {credentials && <CredentialsBox credentials={credentials} onClose={() => setCredentials(null)} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-gray-900">
          Agenti {agents && agents.length > 0 && <span className="text-sm font-normal text-gray-500">({agents.length})</span>}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca nome, codice o email"
              aria-label="Cerca agenti"
              className="w-64 max-w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setAgents(null)
              load()
            }}
            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <RefreshCw className="h-4 w-4" /> Aggiorna
          </button>
        </div>
      </div>

      <ErrorBox message={error} />

      {agents === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : visible.length === 0 ? (
        !error && (
          <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            {agents.length === 0 ? 'Nessun agente ancora.' : 'Nessun agente trovato.'}
          </p>
        )
      ) : (
        <div className="space-y-4">
          {visible.map((a) => (
            <AgentRow key={a.id} agent={a} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}

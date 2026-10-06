'use client'

import TranslatorAuditTab from '@/components/admin/TranslatorAuditTab'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  History,
  Info,
  KeyRound,
  Languages,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserPlus,
  Wand2,
  X,
  Gauge,
} from 'lucide-react'
import {
  adminCreateTranslator,
  adminDeleteTranslator,
  adminListTranslationChanges,
  adminListTranslators,
  adminRevertTranslationChange,
  adminSetTranslatorPassword,
  adminUpdateTranslator,
  type AdminTranslator,
  type TranslationChange,
} from '@/app/actions/translations'
import { LOCALE_LABELS, SECTION_LABELS, TRANSLATOR_LOCALES, isTranslatorLocale } from '@/lib/translationLocales'
import ShareCredentials from '@/components/admin/ShareCredentials'

type Tab = 'translators' | 'audit' | 'changes'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 10

const when = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—'
const day = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium' }).format(new Date(iso)) : '—'
const localeLabel = (code: string) => (isTranslatorLocale(code) ? LOCALE_LABELS[code] : code)
const sectionLabel = (key: string) => {
  const first = key.split('.')[0]
  return SECTION_LABELS[first] ?? first
}
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

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

function LocaleCheckboxes({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TRANSLATOR_LOCALES.map((code) => {
        const checked = value.includes(code)
        return (
          <label
            key={code}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
              checked ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-gray-300 bg-white text-gray-700'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(checked ? value.filter((c) => c !== code) : [...value, code])}
              className="accent-[var(--ink)]"
            />
            {LOCALE_LABELS[code]} <span className="text-xs uppercase text-gray-500">{code}</span>
          </label>
        )
      })}
    </div>
  )
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>
}

// ── Scheda "Traduttori" ─────────────────────────────────────────────────

type Credentials = { url: string; email: string; password: string; name: string }

function CreateTranslatorForm({ onCreated }: { onCreated: (c: Credentials) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [locales, setLocales] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const cleanEmail = email.trim().toLowerCase()
    if (!name.trim()) return setError('Inserisci il nome del traduttore.')
    if (!EMAIL_RE.test(cleanEmail)) return setError('Email non valida.')
    if (password.length < MIN_PASSWORD) return setError(`La password deve avere almeno ${MIN_PASSWORD} caratteri.`)
    if (locales.length === 0) return setError('Scegli almeno una lingua.')
    setSaving(true)
    try {
      const result = await adminCreateTranslator({ name: name.trim(), email: cleanEmail, password, locales })
      if (!result.success) {
        setError(result.error)
        return
      }
      onCreated({ url: `${window.location.origin}/login`, email: cleanEmail, password, name: name.trim() })
      setName('')
      setEmail('')
      setPassword('')
      setLocales([])
    } catch (err) {
      setError('Errore: ' + errorText(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <UserPlus className="h-5 w-5" /> Nuovo traduttore
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase text-gray-500">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Es. Maria Rossi"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold uppercase text-gray-500">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            placeholder="traduttore@esempio.com"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
        </label>
      </div>
      <div>
        <label htmlFor="new-translator-password" className="text-xs font-semibold uppercase text-gray-500">
          Password
        </label>
        <div className="mt-1">
          <PasswordField id="new-translator-password" value={password} onChange={setPassword} />
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Lingue che può modificare</p>
        <LocaleCheckboxes value={locales} onChange={setLocales} />
      </div>
      <ErrorBox message={error} />
      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Crea traduttore
      </button>
    </form>
  )
}

function CredentialsBox({ credentials, onClose }: { credentials: Credentials; onClose: () => void }) {
  const all = `Indirizzo: ${credentials.url}\nEmail: ${credentials.email}\nPassword: ${credentials.password}`
  const message = [
    `Ciao ${credentials.name.split(' ')[0]}, ecco il tuo accesso all'Area Traduttori di KUMANI.`,
    '',
    `Accedi da: ${credentials.url}`,
    `Email: ${credentials.email}`,
    `Password: ${credentials.password}`,
    '',
    'Conserva la password in un posto sicuro e non condividerla con nessuno.',
  ].join('\n')
  return (
    <div className="rounded-xl border border-[var(--gold)] bg-[var(--gold-pale)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-[var(--ink)]">Traduttore {credentials.name} creato. Comunica al traduttore:</p>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="text-gray-500 hover:text-[var(--ink)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <dl className="mt-3 space-y-1 rounded-lg bg-white p-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <dt className="w-20 font-semibold text-gray-500">Indirizzo</dt>
          <dd className="break-all font-mono text-gray-900">{credentials.url}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="w-20 font-semibold text-gray-500">Email</dt>
          <dd className="break-all font-mono text-gray-900">{credentials.email}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="w-20 font-semibold text-gray-500">Password</dt>
          <dd className="break-all font-mono text-gray-900">{credentials.password}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <CopyButton text={all} label="Copia tutto" />
        <ShareCredentials message={message} subject="KUMANI: il tuo accesso all'Area Traduttori" email={credentials.email} />
        <p className="text-xs font-semibold text-amber-800">La password non verrà più mostrata: copiala ora e inviala al traduttore.</p>
      </div>
    </div>
  )
}

type RowMode = null | 'locales' | 'rename' | 'password'

function TranslatorRow({ translator, onChanged }: { translator: AdminTranslator; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<RowMode>(null)
  const [locales, setLocales] = useState<string[]>(translator.locales)
  const [name, setName] = useState(translator.name)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const open = (next: RowMode) => {
    setError(null)
    setNotice(null)
    setLocales(translator.locales)
    setName(translator.name)
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

  const saveLocales = () => {
    if (locales.length === 0) return setError('Scegli almeno una lingua.')
    return run(() => adminUpdateTranslator(translator.id, { locales }), 'Lingue aggiornate.')
  }
  const saveName = () => {
    if (!name.trim()) return setError('Inserisci il nome.')
    return run(() => adminUpdateTranslator(translator.id, { name: name.trim() }), 'Nome aggiornato.')
  }
  const savePassword = () => {
    if (password.length < MIN_PASSWORD) return setError(`La password deve avere almeno ${MIN_PASSWORD} caratteri.`)
    return run(() => adminSetTranslatorPassword(translator.id, password), 'Password cambiata. Comunicala al traduttore: non verrà più mostrata.')
  }
  const toggleActive = () => {
    const suspend = translator.isActive
    const ok = confirm(
      suspend
        ? `Sospendere ${translator.name}? Non potrà più entrare né modificare traduzioni finché non lo riattivi.`
        : `Riattivare ${translator.name}? Potrà di nuovo entrare con la sua password.`,
    )
    if (!ok) return
    return run(() => adminUpdateTranslator(translator.id, { isActive: !suspend }), suspend ? 'Account sospeso.' : 'Account riattivato.')
  }
  const remove = () => {
    const ok = confirm(
      `ATTENZIONE: eliminare definitivamente l'account di ${translator.name} (${translator.email ?? '—'})?\n\n` +
        `L'account viene eliminato, le sue traduzioni restano nel sito.\n` +
        `Non potrà più entrare e l'operazione non si può annullare. Se vuoi solo bloccarlo per un po', usa "Sospendi".`,
    )
    if (!ok) return
    return run(() => adminDeleteTranslator(translator.id))
  }

  const btn =
    'flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50'
  const active = (m: RowMode) => (mode === m ? 'border-[var(--ink)] bg-gray-100' : '')

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900">{translator.name}</p>
          <p className="break-all text-xs text-gray-500">{translator.email ?? '— (email non disponibile)'}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {translator.locales.length === 0 ? (
              <span className="text-xs text-gray-400">Nessuna lingua</span>
            ) : (
              translator.locales.map((code) => (
                <span key={code} className="rounded-full bg-[var(--gold-pale)] px-2 py-0.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--gold)]/50">
                  {LOCALE_LABELS[code]}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <span
            className={`inline-block rounded-full px-2 py-0.5 font-semibold ${translator.isActive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
          >
            {translator.isActive ? 'Attivo' : 'Sospeso'}
          </span>
          <p className="mt-1">
            {translator.changes} {translator.changes === 1 ? 'modifica' : 'modifiche'}
          </p>
          <p>Creato il {day(translator.createdAt)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => open('locales')} className={`${btn} ${active('locales')}`}>
          <Languages className="h-3.5 w-3.5" /> Lingue
        </button>
        <button type="button" disabled={busy} onClick={() => open('rename')} className={`${btn} ${active('rename')}`}>
          <Pencil className="h-3.5 w-3.5" /> Rinomina
        </button>
        <button type="button" disabled={busy} onClick={() => open('password')} className={`${btn} ${active('password')}`}>
          <KeyRound className="h-3.5 w-3.5" /> Cambia password
        </button>
        <button type="button" disabled={busy} onClick={toggleActive} className={btn}>
          {translator.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {translator.isActive ? 'Sospendi' : 'Riattiva'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Elimina
        </button>
        {busy && <LoaderCircle className="h-4 w-4 animate-spin self-center text-gray-400" />}
      </div>

      {mode && (
        <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
          {mode === 'locales' && <LocaleCheckboxes value={locales} onChange={setLocales} disabled={busy} />}
          {mode === 'rename' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          )}
          {mode === 'password' && (
            <>
              <PasswordField value={password} onChange={setPassword} />
              <p className="text-xs text-gray-500">Copia la nuova password prima di salvare: dopo non verrà più mostrata.</p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={mode === 'locales' ? saveLocales : mode === 'rename' ? saveName : savePassword}
              className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Salva
            </button>
            <button type="button" disabled={busy} onClick={() => setMode(null)} className={btn}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
    </div>
  )
}

function TranslatorsTab() {
  const [translators, setTranslators] = useState<AdminTranslator[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const result = await adminListTranslators()
      if ('error' in result) {
        setError(result.error)
        setTranslators((prev) => prev ?? [])
      } else setTranslators(result.translators)
    } catch (err) {
      setError('Errore: ' + errorText(err))
      setTranslators((prev) => prev ?? [])
    }
  }, [])

  useEffect(() => {
    // Caricamento dal server all'apertura (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <CreateTranslatorForm
        onCreated={(c) => {
          setCredentials(c)
          load()
        }}
      />
      {credentials && <CredentialsBox credentials={credentials} onClose={() => setCredentials(null)} />}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-gray-900">
          Traduttori {translators && translators.length > 0 && <span className="text-sm font-normal text-gray-500">({translators.length})</span>}
        </h3>
        <button
          type="button"
          onClick={() => {
            setTranslators(null)
            load()
          }}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <RefreshCw className="h-4 w-4" /> Aggiorna
        </button>
      </div>

      <ErrorBox message={error} />

      {translators === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : translators.length === 0 ? (
        !error && <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nessun traduttore ancora.</p>
      ) : (
        <div className="space-y-4">
          {translators.map((t) => (
            <TranslatorRow key={`${t.id}:${t.name}:${t.locales.join(',')}:${t.isActive}`} translator={t} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Scheda "Ultime modifiche" ───────────────────────────────────────────

function ClampedText({ value }: { value: string | null }) {
  const [expanded, setExpanded] = useState(false)
  if (value === null) return <span className="italic text-gray-400">testo di base</span>
  const long = value.length > 160 || value.split('\n').length > 3
  return (
    <span className="block">
      <span className={`block whitespace-pre-line break-words ${long && !expanded ? 'line-clamp-3' : ''}`}>{value || <span className="italic text-gray-400">(vuoto)</span>}</span>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          {expanded ? 'Mostra meno' : 'Mostra tutto'}
        </button>
      )}
    </span>
  )
}

function ChangesTab() {
  const [changes, setChanges] = useState<TranslationChange[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localeFilter, setLocaleFilter] = useState('')
  const [authorFilter, setAuthorFilter] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const result = await adminListTranslationChanges(100)
      if ('error' in result) {
        setError(result.error)
        setChanges((prev) => prev ?? [])
      } else setChanges(result.changes)
    } catch (err) {
      setError('Errore: ' + errorText(err))
      setChanges((prev) => prev ?? [])
    }
  }, [])

  useEffect(() => {
    // Caricamento dal server all'apertura (setState asincrono)
    load()
  }, [load])

  const authors = useMemo(() => [...new Set((changes ?? []).map((c) => c.changedBy))].sort((a, b) => a.localeCompare(b, 'it')), [changes])
  const visible = useMemo(
    () => (changes ?? []).filter((c) => (!localeFilter || c.locale === localeFilter) && (!authorFilter || c.changedBy === authorFilter)),
    [changes, localeFilter, authorFilter],
  )

  const revert = async (change: TranslationChange) => {
    const ok = confirm(
      `Ripristinare il testo precedente?\n\n${localeLabel(change.locale)} · ${change.key}\n\n` +
        `Tornerà a: ${change.oldValue === null ? 'testo di base' : `"${change.oldValue.slice(0, 200)}${change.oldValue.length > 200 ? '…' : ''}"`}`,
    )
    if (!ok) return
    setWorking(change.id)
    setNotice(null)
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[change.id]
      return next
    })
    try {
      const result = await adminRevertTranslationChange(change.id)
      if (!result.success) {
        setRowErrors((prev) => ({ ...prev, [change.id]: result.error }))
        return
      }
      setNotice('Testo ripristinato. La correzione sarà visibile nel sito entro pochi minuti.')
      await load()
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [change.id]: 'Errore: ' + errorText(err) }))
    } finally {
      setWorking(null)
    }
  }

  const select = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)} className={select} aria-label="Filtra per lingua">
          <option value="">Tutte le lingue</option>
          {TRANSLATOR_LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_LABELS[code]}
            </option>
          ))}
        </select>
        <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)} className={select} aria-label="Filtra per traduttore">
          <option value="">Tutti i traduttori</option>
          {authors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {changes && (
          <span className="text-xs text-gray-500">
            {visible.length} di {changes.length}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setChanges(null)
            load()
          }}
          className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <RefreshCw className="h-4 w-4" /> Aggiorna
        </button>
      </div>

      <ErrorBox message={error} />
      {notice && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      {changes === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : visible.length === 0 ? (
        !error && (
          <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            {changes.length === 0 ? 'Nessuna modifica ancora.' : 'Nessuna modifica con questi filtri.'}
          </p>
        )
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    {sectionLabel(c.key)}{' '}
                    <span className="ml-1 rounded-full bg-[var(--gold-pale)] px-2 py-0.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--gold)]/50">
                      {localeLabel(c.locale)}
                    </span>
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-gray-500">{c.key}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p className="font-semibold text-gray-700">{c.changedBy}</p>
                  <p>{when(c.changedAt)}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-lg bg-gray-50 p-3 text-gray-600">
                  <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Prima</p>
                  <ClampedText value={c.oldValue} />
                </div>
                <span className="hidden self-center text-gray-400 sm:block">→</span>
                <div className="rounded-lg bg-[var(--gold-pale)] p-3 text-gray-900">
                  <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Dopo</p>
                  <ClampedText value={c.newValue} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={working !== null}
                  onClick={() => revert(c)}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {working === c.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Ripristina
                </button>
                {rowErrors[c.id] && <span className="text-sm text-red-700">{rowErrors[c.id]}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Admin → Traduttori: account separati per chi corregge le traduzioni del
// sito (nessun profilo KUMANI) e storico delle modifiche con ripristino.
export default function TranslatorsPanel() {
  const [tab, setTab] = useState<Tab>('translators')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Languages className="h-6 w-6" /> Traduttori
        </h2>
        <p className="mt-1 text-gray-600">Account per chi corregge le traduzioni del sito nelle lingue straniere.</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
        <ul className="list-disc space-y-1 pl-4">
          <li>I traduttori sono account separati: non hanno un profilo KUMANI, non entrano nella matrice e non vedono la dashboard.</li>
          <li>Possono modificare solo le lingue che assegni loro.</li>
          <li>Le correzioni vanno online nel sito entro pochi minuti.</li>
          <li>Ogni modifica si può ripristinare da &quot;Ultime modifiche&quot;.</li>
          <li>In &quot;Controllo lavoro&quot; vedi quanto ha tradotto davvero ogni traduttore, separato dai testi solo confermati o copiati.</li>
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'translators', label: 'Traduttori', Icon: Languages },
            { key: 'audit', label: 'Controllo lavoro', Icon: Gauge },
            { key: 'changes', label: 'Ultime modifiche', Icon: History },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === t.key ? 'bg-[var(--ink)] text-white' : 'border border-gray-200 bg-white text-gray-700'
            }`}
          >
            <t.Icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'translators' ? <TranslatorsTab /> : tab === 'audit' ? <TranslatorAuditTab /> : <ChangesTab />}
    </div>
  )
}

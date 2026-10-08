'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Camera, CheckCircle2, Clock, FileText, IdCard, LoaderCircle, Lock, ScrollText, Upload, XCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { acceptRules, submitIdentityDocument, verifyTaxCode, type IdentityDocType } from '@/app/actions/verification'
import { EVENT_COUNTRIES, countryName } from '@/lib/events'
import { resizeImageFile } from '@/lib/resizeImage'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'

const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'
const primaryButton = 'flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:opacity-50'

// Controlli comuni a Kordata (capocordata) ed Events (organizzatore):
// 'tax_code' = identità verificata (codice fiscale o documento approvato),
// 'terms' = regole del servizio accettate.
export type VerificationStatus = {
  account_age: boolean
  subscription: boolean
  profile: boolean
  tax_code: boolean
  terms: boolean
  blocked: boolean
  days_left: number
  has_tax_code?: boolean
  identity_pending?: boolean
  identity_last_status?: 'pending' | 'approved' | 'rejected' | null
  identity_rejected_note?: string | null
}

type Kind = 'kordata' | 'events' | 'timebank'

const DOC_TYPES: IdentityDocType[] = ['id_card', 'passport', 'residence_permit', 'driving_license']
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
// Limite del server 5 MB, ma il corpo delle server action è max 3 MB:
// le foto si ridimensionano nel browser, i PDF devono stare sotto questa soglia.
const MAX_UPLOAD = 2.8 * 1024 * 1024
// Codici regione che non sono paesi (Unione Europea, ONU, pseudo-regioni…)
const NOT_COUNTRIES = new Set(['EU', 'EZ', 'UN', 'QO', 'ZZ', 'XA', 'XB', 'AC', 'CP', 'CQ', 'DG', 'EA', 'IC', 'TA'])
const SERVER_ERRORS = [
  'notLoggedIn', 'birthdateMissing', 'blocked', 'saveError', 'docType', 'country', 'fileMissing', 'fileTooBig', 'fileType',
  'alreadyVerified', 'alreadyPending', 'uploadError', 'taxCode_format', 'taxCode_checksum', 'taxCode_surname', 'taxCode_name',
  'taxCode_birthdate', 'taxCode_used',
]

// Tutti i paesi riconosciuti dal browser: prima quelli più comuni, poi gli altri.
function useCountries(locale: string) {
  return useMemo(() => {
    const common = EVENT_COUNTRIES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale))
    const others: { code: string; name: string }[] = []
    try {
      const names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' })
      const known = new Set<string>(EVENT_COUNTRIES)
      for (let a = 65; a <= 90; a++) {
        for (let b = 65; b <= 90; b++) {
          const code = String.fromCharCode(a, b)
          if (known.has(code) || NOT_COUNTRIES.has(code)) continue
          const name = names.of(code)
          if (name && name !== code) others.push({ code, name })
        }
      }
    } catch {
      // Browser senza Intl.DisplayNames: restano i paesi comuni
    }
    others.sort((a, b) => a.name.localeCompare(b.name, locale))
    return { common, others }
  }, [locale])
}

// Finestra "Kumano Verificato": requisiti, identità (codice fiscale italiano
// oppure documento controllato dallo Staff) e regole del servizio.
export default function VerificationSetup({
  kind,
  status,
  onClose,
  onDone,
  title,
  intro,
}: {
  kind: Kind
  status: VerificationStatus
  onClose: () => void
  onDone: () => void
  title?: string
  intro?: string
}) {
  const t = useTranslations('verification')
  const tc = useTranslations('convivio')
  const locale = useLocale()
  const router = useRouter()
  const countries = useCountries(locale)

  // I risultati delle azioni si sommano allo stato ricevuto: dopo il refresh
  // della pagina lo stato arriva aggiornato e resta coerente.
  const [overrides, setOverrides] = useState<Partial<VerificationStatus>>({})
  const s = { ...status, ...overrides }

  const rejected = !s.tax_code && !s.identity_pending && s.identity_last_status === 'rejected'
  const [method, setMethod] = useState<'taxCode' | 'document'>(rejected ? 'document' : 'taxCode')
  const [taxCode, setTaxCode] = useState('')
  const [docType, setDocType] = useState<IdentityDocType | ''>('')
  const [country, setCountry] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [rulesChecked, setRulesChecked] = useState(false)
  const [busy, setBusy] = useState<'taxCode' | 'document' | 'rules' | null>(null)
  const [error, setError] = useState<{ step: 'identity' | 'rules'; message: string } | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const errorText = (code?: string) => t(SERVER_ERRORS.includes(code ?? '') ? `error_${code}` : 'error_saveError')

  const basicsOk = s.subscription && s.account_age && s.profile && !s.blocked
  const allOk = basicsOk && s.tax_code && s.terms
  // Identità e regole si possono sistemare già durante i 30 giorni di attesa
  const canProceed = s.subscription && !s.blocked

  const applied = (next: Partial<VerificationStatus>) => {
    setOverrides((prev) => ({ ...prev, ...next }))
    router.refresh()
  }

  const submitTaxCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('taxCode')
    setError(null)
    const result = await verifyTaxCode(taxCode)
    setBusy(null)
    if (!result.success) return setError({ step: 'identity', message: errorText(result.error) })
    applied({ tax_code: true, has_tax_code: true })
  }

  const pickFile = async (picked: File | undefined) => {
    setError(null)
    if (!picked) return
    if (!FILE_TYPES.includes(picked.type)) {
      setFile(null)
      return setError({ step: 'identity', message: t('error_fileType') })
    }
    // Foto: ridimensionata (leggibile ma leggera). PDF: così com'è.
    const ready = picked.type.startsWith('image/') ? ((await resizeImageFile(picked, 2000, 0.85)) ?? picked) : picked
    if (ready.size > MAX_UPLOAD) {
      setFile(null)
      return setError({ step: 'identity', message: t('error_fileTooBig') })
    }
    setFile(ready)
  }

  const submitDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !docType || !country) return
    setBusy('document')
    setError(null)
    const form = new FormData()
    form.set('file', file)
    form.set('docType', docType)
    form.set('countryCode', country)
    const result = await submitIdentityDocument(form).catch(() => ({ success: false, error: 'uploadError' }))
    setBusy(null)
    if (!result.success) {
      if (result.error === 'alreadyPending') applied({ identity_pending: true, identity_last_status: 'pending' })
      return setError({ step: 'identity', message: errorText(result.error) })
    }
    setFile(null)
    applied({ identity_pending: true, identity_last_status: 'pending' })
  }

  const submitRules = async () => {
    setBusy('rules')
    setError(null)
    const result = await acceptRules(kind)
    setBusy(null)
    if (!result.success) return setError({ step: 'rules', message: errorText(result.error) })
    applied({ terms: true })
  }

  // Time Bank: gratis (niente abbonamento), 30 giorni dall'iscrizione, maggiorenni
  const timebank = kind === 'timebank'
  const allChecks: { key: string; ok: boolean; pending?: boolean; text: string; action?: React.ReactNode }[] = [
    {
      key: 'subscription',
      ok: s.subscription,
      text: tc('check_subscription'),
      action: !s.subscription && (
        <Link href={{ pathname: '/billing' }} className="text-xs font-semibold text-[var(--gold)] underline">
          {tc('activate')}
        </Link>
      ),
    },
    {
      key: 'account_age',
      ok: s.account_age,
      text: timebank
        ? !s.account_age
          ? t('timebank_check_account_age_wait', { days: s.days_left })
          : t('timebank_check_account_age')
        : !s.account_age && s.subscription
          ? tc('check_account_age_wait', { days: s.days_left })
          : tc('check_account_age'),
    },
    {
      key: 'profile',
      ok: s.profile,
      text: timebank ? t('timebank_check_profile') : tc('check_profile'),
      action: !s.profile && <span className="text-xs text-[var(--muted)]">{tc('check_profile_hint')}</span>,
    },
    { key: 'identity', ok: s.tax_code, pending: !s.tax_code && s.identity_pending, text: !s.tax_code && s.identity_pending ? t('check_identity_pending') : t('check_identity') },
    { key: 'rules', ok: s.terms, text: t(`check_rules_${kind}`) },
  ]
  const checks = timebank ? allChecks.filter((c) => c.key !== 'subscription') : allChecks

  const rules =
    kind === 'kordata'
      ? [tc('rule1'), tc('rule2'), tc('rule3'), tc('rule4')]
      : timebank
        ? [t('timebank_rule1'), t('timebank_rule2'), t('timebank_rule3'), t('timebank_rule4'), t('timebank_rule5')]
        : [t('events_rule1'), t('events_rule2'), t('events_rule3'), t('events_rule4')]

  return (
    <Sheet title={title ?? (kind === 'kordata' ? tc('setupTitle') : t(`title_${kind}`))} onClose={onClose}>
      <p className="mb-4 text-sm text-gray-600">{intro ?? (kind === 'kordata' ? tc('setupIntro') : t(`intro_${kind}`))}</p>

      <ul className="mb-5 space-y-2">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            {c.ok ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : c.pending ? (
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            )}
            <span className={`flex-1 ${c.ok ? '' : c.pending ? 'font-semibold text-amber-700' : 'font-semibold text-red-700'}`}>
              {c.text} {c.action}
            </span>
          </li>
        ))}
      </ul>

      {s.blocked && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{t('blocked')}</p>}
      {!s.blocked && !basicsOk && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {canProceed ? t('basicsMissingCanProceed') : t('basicsMissing')}
        </p>
      )}

      {/* Identità */}
      {canProceed && !s.tax_code && (
        <section className="mb-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-4">
          <h4 className="mb-1 flex items-center gap-2 font-bold text-[var(--ink)]">
            <IdCard className="h-5 w-5 text-[var(--gold)]" /> {t('identityTitle')}
          </h4>

          {s.identity_pending ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4" /> {t('pendingTitle')}
              </p>
              <p className="mt-1 text-xs leading-5">{t('pendingText')}</p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs leading-5 text-gray-600">{t('identityIntro')}</p>

              {rejected && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-semibold">{t('rejectedTitle')}</p>
                  <p className="mt-1 text-xs leading-5">{s.identity_rejected_note?.trim() || t('rejectedNoNote')}</p>
                  <p className="mt-1 text-xs leading-5">{t('rejectedRetry')}</p>
                </div>
              )}

              <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 text-xs font-semibold">
                {(['taxCode', 'document'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => (setMethod(m), setError(null))}
                    className={`rounded-lg px-2 py-2 leading-4 transition ${method === m ? 'bg-[var(--ink)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    {m === 'taxCode' ? t('methodTaxCode') : t('methodDocument')}
                  </button>
                ))}
              </div>

              {method === 'taxCode' ? (
                <form onSubmit={submitTaxCode} className="space-y-3">
                  <div>
                    <label className={label}>{tc('taxCode')}</label>
                    <input
                      className={`${input} bg-white font-mono uppercase tracking-wider`}
                      value={taxCode}
                      maxLength={16}
                      required
                      placeholder="RSSMRA80A01H501U"
                      onChange={(e) => setTaxCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    />
                    <p className="mt-1 text-xs text-gray-500">{tc('taxCodeHint')}</p>
                  </div>
                  {error?.step === 'identity' && <p className="text-sm font-semibold text-red-600">{error.message}</p>}
                  <div className="flex gap-2">
                    <CancelButton className={cancelButtonLgClass} />
                    <button type="submit" disabled={busy !== null || taxCode.length !== 16} className={primaryButton}>
                      {busy === 'taxCode' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} {t('verifyTaxCode')}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={submitDocument} className="space-y-3">
                  <div>
                    <label className={label}>{t('docType')}</label>
                    <select className={`${input} bg-white`} value={docType} required onChange={(e) => setDocType(e.target.value as IdentityDocType)}>
                      <option value="" disabled>
                        {t('docTypeChoose')}
                      </option>
                      {DOC_TYPES.map((d) => (
                        <option key={d} value={d}>
                          {t(`doc_${d}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>{t('docCountry')}</label>
                    <select className={`${input} bg-white`} value={country} required onChange={(e) => setCountry(e.target.value)}>
                      <option value="" disabled>
                        {t('docCountryChoose')}
                      </option>
                      <optgroup label={t('countriesCommon')}>
                        {countries.common.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                      {countries.others.length > 0 && (
                        <optgroup label={t('countriesOther')}>
                          {countries.others.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={label}>{t('docPhoto')}</label>
                    <p className="mb-2 text-xs leading-5 text-gray-500">{t('docPhotoHint')}</p>
                    <input
                      ref={cameraRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => (pickFile(e.target.files?.[0]), (e.target.value = ''))}
                    />
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => (pickFile(e.target.files?.[0]), (e.target.value = ''))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => cameraRef.current?.click()}
                        className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:border-[var(--gold)]"
                      >
                        <Camera className="h-4 w-4 text-[var(--gold)]" /> {t('takePhoto')}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:border-[var(--gold)]"
                      >
                        <Upload className="h-4 w-4 text-[var(--gold)]" /> {t('chooseFile')}
                      </button>
                    </div>
                    {file && (
                      <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                        <FileText className="h-4 w-4" /> {t('fileReady', { size: (file.size / 1024 / 1024).toFixed(1) })}
                      </p>
                    )}
                  </div>
                  <p className="flex items-start gap-2 rounded-lg bg-white p-3 text-xs leading-5 text-gray-600">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('privacy')}
                  </p>
                  {error?.step === 'identity' && <p className="text-sm font-semibold text-red-600">{error.message}</p>}
                  <div className="flex gap-2">
                    <CancelButton className={cancelButtonLgClass} />
                    <button type="submit" disabled={busy !== null || !file || !docType || !country} className={primaryButton}>
                      {busy === 'document' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {t('sendDocument')}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      )}

      {/* Regole del servizio */}
      {canProceed && !s.terms && (
        <section className="mb-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-4">
          <h4 className="mb-2 flex items-center gap-2 font-bold text-[var(--ink)]">
            <ScrollText className="h-5 w-5 text-[var(--gold)]" /> {kind === 'kordata' ? tc('rulesTitle') : t(`${kind}_rulesTitle`)}
          </h4>
          <ul className="mb-3 list-disc space-y-1 rounded-lg bg-white p-3 pl-7 text-xs leading-5 text-gray-600">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <label className="mb-3 flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={rulesChecked} onChange={(e) => setRulesChecked(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
            {kind === 'kordata' ? tc('acceptRules') : t(`${kind}_acceptRules`)}
          </label>
          {error?.step === 'rules' && <p className="mb-3 text-sm font-semibold text-red-600">{error.message}</p>}
          <button type="button" onClick={submitRules} disabled={busy !== null || !rulesChecked} className={primaryButton}>
            {busy === 'rules' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t('confirmRules')}
          </button>
        </section>
      )}

      {s.tax_code && s.terms && !allOk && !s.blocked && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t('almostThere')}</p>}

      <button
        type="button"
        onClick={onDone}
        disabled={!allOk}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 font-bold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <BadgeCheck className="h-5 w-5" /> {t(`done_${kind}`)}
      </button>
    </Sheet>
  )
}

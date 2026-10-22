'use client'

import { useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Landmark,
  MailSearch,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { completeVerificaIban } from '@/app/actions/verificaIban'
import {
  IBAN_LENGTHS,
  PAYMENT_CONTEXTS,
  contextSignals,
  countryFlag,
  countryName,
  validateIban,
  onlineBankOf,
  type IbanIssue,
  type IbanResult,
  type PaymentContext,
  type SignalLevel,
} from '@/lib/iban'
import CommunityWarning from '@/components/scamNet/CommunityWarning'
import DossierButton, { type Dossier, type DossierStatus } from '@/components/scamNet/DossierButton'
import IbanBankInfo from '@/components/verificaIban/IbanBankInfo'

// VERIFICA IBAN: controllo tutto nel browser (formato, lunghezza per paese,
// checksum mod 97). Nessuna chiamata di rete, niente viene salvato; l'unica
// azione server è il punto KU giornaliero dopo il primo IBAN valido.

const CONTEXT_LABEL: Record<PaymentContext, string> = {
  privateSeller: 'ctxPrivateSeller',
  holidayRental: 'ctxHolidayRental',
  onlineShop: 'ctxOnlineShop',
  investment: 'ctxInvestment',
  bill: 'ctxBill',
  familyFriend: 'ctxFamilyFriend',
  other: 'ctxOther',
}

const LEVEL_STYLE: Record<SignalLevel, string> = {
  strong: 'border-red-300 bg-red-50 text-red-950',
  warning: 'border-amber-300 bg-amber-50 text-amber-950',
  info: 'border-sky-200 bg-sky-50 text-sky-950',
}

function LevelIcon({ level }: { level: SignalLevel }) {
  if (level === 'strong') return <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
  if (level === 'warning') return <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
  return <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
}

const noopSubscribe = () => () => {}

export default function IbanChecker({ initialIban = '' }: { initialIban?: string }) {
  const t = useTranslations('verificaIban')
  const locale = useLocale()
  const inputId = useId()
  const hintId = useId()
  const homeId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const awardedRef = useRef(false)

  const [value, setValue] = useState(initialIban)
  // IBAN arrivato dal link: esito mostrato subito (senza punto KU, serve il click)
  const [result, setResult] = useState<IbanResult | null>(() => (initialIban ? validateIban(initialIban) : null))
  const [context, setContext] = useState<PaymentContext | null>(null)
  const [homeCountry, setHomeCountry] = useState('IT')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  // Nomi dei paesi e ordine alfabetico dipendono dal dizionario del browser:
  // l'elenco completo si compone solo nel browser (prima del caricamento
  // c'è solo il paese scelto), così server e browser non si contraddicono
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const countries = useMemo(
    () =>
      mounted
        ? Object.keys(IBAN_LENGTHS)
            .map((code) => ({ code, name: countryName(code, locale) }))
            .sort((a, b) => a.name.localeCompare(b.name, locale))
        : [{ code: homeCountry, name: homeCountry }],
    [locale, mounted, homeCountry],
  )

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = validateIban(value)
    setResult(next)
    setCopyState('idle')
    if (next.valid && !awardedRef.current) {
      awardedRef.current = true
      completeVerificaIban().catch(() => {})
    }
  }

  function clear() {
    setValue('')
    setResult(null)
    setContext(null)
    setCopyState('idle')
    inputRef.current?.focus()
  }

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.formatted)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    window.setTimeout(() => setCopyState('idle'), 2500)
  }

  function issueText(issue: IbanIssue): string {
    switch (issue.code) {
      case 'empty':
        return t('issueEmpty')
      case 'invalidChars':
        return t('issueInvalidChars', { chars: issue.chars.map((c) => `"${c}"`).join(' ') })
      case 'badCountryFormat':
        return t('issueBadCountryFormat')
      case 'unknownCountry':
        return t('issueUnknownCountry', { country: issue.country })
      case 'badCheckDigits':
        return t('issueBadCheckDigits')
      case 'tooShort':
        return t('issueTooShort', { n: issue.missing, expected: issue.expected })
      case 'tooLong':
        return t('issueTooLong', { n: issue.extra, expected: issue.expected })
      case 'badItalianPart':
        return t(`issueItalian_${issue.part}`)
      case 'checksum':
        return t('issueChecksum')
    }
  }

  const signals = result?.valid && result.country && context ? contextSignals(context, result.country, homeCountry) : []

  return (
    <div className="space-y-5">
      <form onSubmit={check} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
        <label htmlFor={inputId} className="mb-2 block text-base font-semibold text-[var(--ink)]">
          {t('inputLabel')}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setResult(null)
          }}
          placeholder={t('inputPlaceholder')}
          aria-describedby={hintId}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-base tracking-wider text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
        />
        <p id={hintId} className="mt-2 text-xs text-gray-500">
          {t('inputHint')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          >
            <ShieldCheck className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden />
            {t('check')}
          </button>
          {value && (
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <X className="h-4 w-4" aria-hidden />
              {t('clear')}
            </button>
          )}
        </div>
      </form>

      <div aria-live="polite">
        {result && (
          <div className="space-y-5">
            {/* Avviso della Rete Anti-Truffa (solo IBAN segnalati e confermati) */}
            {result.valid && <CommunityWarning items={[{ kind: 'iban', value: result.normalized }]} report={{ kind: 'iban', value: result.normalized }} />}
            {/* Esito */}
            <div
              className={`rounded-2xl border p-5 sm:p-6 ${result.valid ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}
            >
              <div className="flex items-start gap-3">
                {result.valid ? (
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-lg font-bold ${result.valid ? 'text-emerald-900' : 'text-red-900'}`}>
                    {result.valid ? t('resultValid') : t('resultInvalid')}
                  </p>
                  {result.formatted && (
                    <p className="mt-2 break-all font-mono text-base tracking-wider text-[var(--ink)] sm:text-lg">
                      {result.formatted}
                    </p>
                  )}
                  {!result.valid && (
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-red-950">
                      {result.issues.map((issue, index) => (
                        <li key={`${issue.code}-${index}`}>{issueText(issue)}</li>
                      ))}
                    </ul>
                  )}
                  {result.country && (
                    <p className="mt-3 text-sm text-gray-700">
                      <span className="font-semibold">{t('countryLabel')}</span>{' '}
                      <span aria-hidden>{countryFlag(result.country)} </span>
                      {mounted ? countryName(result.country, locale) : result.country} ({result.country})
                      {result.expectedLength !== null && (
                        <span className="text-gray-500"> · {t('lengthLabel', { n: result.expectedLength })}</span>
                      )}
                    </p>
                  )}
                  {result.valid && (
                    <button
                      type="button"
                      onClick={copy}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100"
                    >
                      {copyState === 'copied' ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                      {copyState === 'copied' ? t('copied') : copyState === 'failed' ? t('copyFailed') : t('copy')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Banca online estera: normale per tanti, ma frequente nelle truffe */}
            {result.valid && onlineBankOf(result.normalized) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
                <p className="font-bold">{t('onlineBankTitle', { name: onlineBankOf(result.normalized)!.name })}</p>
                <p className="mt-1 text-sm leading-6">{t('onlineBankText')}</p>
              </div>
            )}

            {/* Parti dell'IBAN italiano o sammarinese */}
            {result.valid && result.italian && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--ink)]">
                  <Landmark className="h-5 w-5 text-[var(--gold)]" aria-hidden />
                  {t('italianTitle')}
                </h3>
                {/* Banca e sportello dal registro della Banca d'Italia (solo IBAN italiani) */}
                {result.country === 'IT' && <IbanBankInfo key={result.italian.abi + result.italian.cab} abi={result.italian.abi} cab={result.italian.cab} />}
                <dl className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['cin', result.italian.cin],
                      ['abi', result.italian.abi],
                      ['cab', result.italian.cab],
                      ['account', result.italian.account],
                    ] as const
                  ).map(([part, text]) => (
                    <div key={part} className="rounded-xl bg-[var(--paper)] p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t(`part_${part}`)}</dt>
                      <dd className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">{text}</dd>
                      <dd className="mt-1 text-xs leading-5 text-gray-600">{t(`part_${part}_help`)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm leading-6 text-gray-700">{t('abiNote')}</p>
              </div>
            )}

            {/* Domanda di contesto */}
            {result.valid && result.country && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <fieldset>
                  <legend className="text-base font-semibold text-[var(--ink)]">{t('contextTitle')}</legend>
                  <p className="mt-1 text-sm text-gray-600">{t('contextHint')}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {PAYMENT_CONTEXTS.map((option) => (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                          context === option ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-context"
                          value={option}
                          checked={context === option}
                          onChange={() => setContext(option)}
                          className="h-4 w-4 accent-[var(--ink)]"
                        />
                        {t(CONTEXT_LABEL[option])}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-4">
                  <label htmlFor={homeId} className="block text-sm font-semibold text-[var(--ink)]">
                    {t('homeCountryLabel')}
                  </label>
                  <select
                    id={homeId}
                    value={homeCountry}
                    onChange={(event) => setHomeCountry(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[var(--ink)] sm:w-auto"
                  >
                    {countries.map(({ code, name }) => (
                      <option key={code} value={code}>
                        {countryFlag(code)} {name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">{t('homeCountryHint')}</p>
                </div>

                {signals.length > 0 && (
                  <ul className="mt-5 space-y-3">
                    {signals.map((signal) => (
                      <li key={signal.key} className={`flex gap-3 rounded-xl border p-4 text-sm leading-6 ${LEVEL_STYLE[signal.level]}`}>
                        <LevelIcon level={signal.level} />
                        <div>
                          <span className="sr-only">{t(`level_${signal.level}`)}: </span>
                          {t(`signal_${signal.key}`, {
                            ibanCountry: countryName(result.country ?? '', locale),
                            homeCountry: countryName(homeCountry, locale),
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Dossier del controllo in PDF */}
            <DossierButton
              community={result.valid ? [{ kind: 'iban', value: result.normalized }] : []}
              build={(): Dossier => {
                const country = result.country ? `${countryName(result.country, locale)} (${result.country})` : null
                return {
                  tool: t('dossierTool'),
                  subject: result.formatted || result.normalized,
                  subjectLines: [
                    ...(country ? [`${t('countryLabel')} ${country}`] : []),
                    ...(result.italian ? [`${t('part_abi')} ${result.italian.abi} · ${t('part_cab')} ${result.italian.cab}`] : []),
                    ...(context ? [`${t('contextTitle')} ${t(CONTEXT_LABEL[context])}`] : []),
                  ],
                  verdict: { status: result.valid ? (signals.some((s) => s.level === 'strong') ? 'risk' : signals.some((s) => s.level === 'warning') ? 'warning' : 'ok') : 'risk', text: result.valid ? t('resultValid') : t('resultInvalid') },
                  rows: [
                    ...result.issues.map((issue) => ({ label: issueText(issue), status: 'risk' as const })),
                    ...signals.map((s) => ({
                      label: t(`signal_${s.key}`, { ibanCountry: countryName(result.country ?? '', locale), homeCountry: countryName(homeCountry, locale) }),
                      status: (s.level === 'strong' ? 'risk' : s.level === 'warning' ? 'warning' : 'info') as DossierStatus,
                    })),
                  ],
                  advice: [t('dossierAdvice')],
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Frase chiave e consigli: sempre visibili */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="flex items-start gap-2 text-base font-semibold leading-7 text-amber-950">
          <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          {t('keySentence')}
        </p>
        <h3 className="mt-4 text-sm font-semibold text-amber-950">{t('tipsTitle')}</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-amber-950">
          <li>{t('tipInstant')}</li>
          <li>{t('tipProtected')}</li>
          <li>{t('tipPayee')}</li>
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/marketplace/antitruffa"
          className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-[var(--gold)]"
        >
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" aria-hidden />
          <span>
            <span className="block text-sm font-semibold text-[var(--ink)]">{t('antitruffaLink')}</span>
            <span className="block text-xs leading-5 text-gray-600">{t('antitruffaLinkText')}</span>
          </span>
        </Link>
        <Link
          href="/marketplace/checkmail"
          className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-[var(--gold)]"
        >
          <MailSearch className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" aria-hidden />
          <span>
            <span className="block text-sm font-semibold text-[var(--ink)]">{t('checkmailLink')}</span>
            <span className="block text-xs leading-5 text-gray-600">{t('checkmailLinkText')}</span>
          </span>
        </Link>
      </div>
    </div>
  )
}

'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Copy } from 'lucide-react'
import { parseDecimal } from '@/lib/calculators'

// Elementi condivisi dalle quattro calcolatrici: campi numerici, pulsanti a
// segmenti, righe di risultato, pulsante "Copia risultato" e segnalazione
// d'uso (per il punto KU giornaliero, gestito da CalcolatriciApp).

interface CalcUsage {
  /** Un risultato valido è stato calcolato (debounce nel provider). */
  reportResult: () => void
  /** L'utente ha copiato un risultato. */
  reportCopy: () => void
}

const CalcUsageContext = createContext<CalcUsage>({ reportResult: () => {}, reportCopy: () => {} })
export const CalcUsageProvider = CalcUsageContext.Provider
export const useCalcUsage = () => useContext(CalcUsageContext)

/** Segnala un risultato valido ogni volta che la sua "firma" cambia. */
export function useReportResult(signature: string | null) {
  const { reportResult } = useCalcUsage()
  useEffect(() => {
    if (signature) reportResult()
  }, [signature, reportResult])
}

/** Formattatori legati alla lingua corrente (sempre in euro). */
export function useFormatters() {
  const locale = useLocale()
  return useMemo(() => {
    const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })
    const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 })
    return {
      locale,
      money: (value: number) => currency.format(value),
      percent: (value: number) => percent.format(value / 100),
    }
  }, [locale])
}

/** Valore numerico non negativo da una stringa, oppure null. */
export function parsePositive(input: string): number | null {
  const value = parseDecimal(input)
  return value !== null && value >= 0 ? value : null
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
              active
                ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]'
                : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  help,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  suffix?: string
  help?: string
  error?: string | null
}) {
  const t = useTranslations('calcolatrici')
  const invalid = value.trim() !== '' && parsePositive(value) === null
  const message = error ?? (invalid ? t('invalidInput') : null)
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">
        {label}
      </label>
      <div
        className={`flex items-center rounded-xl border bg-white focus-within:ring-2 focus-within:ring-[var(--gold)]/40 ${
          message ? 'border-red-300' : 'border-gray-200 focus-within:border-[var(--gold)]'
        }`}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : help ? `${id}-help` : undefined}
          className="w-full min-w-0 rounded-xl bg-transparent px-4 py-3 text-lg font-semibold tabular-nums text-[var(--ink)] outline-none"
        />
        {suffix && <span className="pr-4 text-base font-semibold text-[var(--muted)]">{suffix}</span>}
      </div>
      {message ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600">
          {message}
        </p>
      ) : (
        help && (
          <p id={`${id}-help`} className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {help}
          </p>
        )
      )}
    </div>
  )
}

export function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]" />
      <span>
        <span className="block text-sm font-semibold text-[var(--ink)]">{label}</span>
        {help && <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{help}</span>}
      </span>
    </label>
  )
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h3 className="mb-4 text-lg font-bold text-[var(--ink)]">{title}</h3>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

export interface ResultLine {
  label: string
  value: string
  /** Riga principale, mostrata in grande. */
  highlight?: boolean
  /** Importo da sottrarre (es. la ritenuta). */
  negative?: boolean
}

/** Pannello scuro con i risultati e il pulsante "Copia risultato". */
export function ResultPanel({ title, lines, footer }: { title: string; lines: ResultLine[]; footer?: ReactNode }) {
  const main = lines.filter((line) => line.highlight)
  const rest = lines.filter((line) => !line.highlight)
  const copyText = [title, ...lines.map((line) => `${line.label}: ${line.negative ? '- ' : ''}${line.value}`)].join('\n')
  return (
    <div className="rounded-2xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.2)] sm:p-6" aria-live="polite">
      <div className="space-y-3">
        {main.map((line) => (
          <div key={line.label}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gold-bright)]">{line.label}</p>
            <p className="mt-1 break-words text-4xl font-bold tabular-nums sm:text-5xl">{line.value}</p>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <dl className="mt-5 divide-y divide-white/10 border-t border-white/10">
          {rest.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-sm text-white/70">{line.label}</dt>
              <dd className={`text-right text-lg font-semibold tabular-nums ${line.negative ? 'text-red-300' : 'text-white'}`}>
                {line.negative ? '− ' : ''}
                {line.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {footer && <div className="mt-4 text-sm leading-6 text-white/80">{footer}</div>}
      <CopyButton text={copyText} />
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations('calcolatrici')
  const { reportCopy } = useCalcUsage()
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      reportCopy()
    } catch {
      setState('error')
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-3 text-base font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
    >
      {state === 'copied' ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
      {state === 'copied' ? t('copied') : state === 'error' ? t('copyError') : t('copy')}
    </button>
  )
}

export function Note({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warning' }) {
  return (
    <p
      className={`rounded-xl px-4 py-3 text-sm leading-6 ${
        tone === 'warning' ? 'border border-amber-200 bg-amber-50 text-amber-950' : 'bg-[var(--gold-pale)]/50 text-[var(--ink)]'
      }`}
    >
      {children}
    </p>
  )
}

export function EmptyResult() {
  const t = useTranslations('calcolatrici')
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-5 text-center text-sm text-[var(--muted)]">{t('emptyResult')}</div>
  )
}

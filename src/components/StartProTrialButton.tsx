'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Gift, LoaderCircle, ShieldCheck } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { startVerifiedProTrial } from '@/app/actions/proTrial'
import { VAT_COUNTRIES_EU, VAT_COUNTRIES_OTHER, vatExample } from '@/lib/vat'

const COUNTRIES = [...VAT_COUNTRIES_EU, ...VAT_COUNTRIES_OTHER]

// "Prova Pro gratis" (pagina /pro): si attiva con la Partita IVA oppure, per
// chi lavora senza, con il codice fiscale. Una prova per Partita IVA o
// codice fiscale (controlli nel server).
export default function StartProTrialButton({ label, autoOpen = false }: { label: string; autoOpen?: boolean }) {
  const t = useTranslations('proTrial')
  const router = useRouter()
  const locale = useLocale()
  const [open, setOpen] = useState(autoOpen)
  const [type, setType] = useState<'vat' | 'tax_code'>('vat')
  const [country, setCountry] = useState('IT')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const countryName = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
    } catch {
      return code
    }
  }
  const input = 'w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-[var(--gold)] focus:outline-none'

  const start = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setBusy(true)
    setError(null)
    try {
      const result = await startVerifiedProTrial({ type, country, value })
      if (result.success) {
        router.push(`/${locale}/dashboard`)
        router.refresh()
        return
      }
      setError(result.reason ?? 'error')
    } catch {
      setError('error')
    }
    setBusy(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--gold)] px-6 py-3 font-bold text-[var(--gold-bright)] transition-colors hover:bg-[var(--gold)]/10"
      >
        <Gift className="h-5 w-5" /> {label}
      </button>
    )
  }

  return (
    <form id="prova" onSubmit={start} className="space-y-3 rounded-2xl border border-[var(--gold)]/40 bg-white/[0.04] p-4 text-left">
      <p className="flex items-center gap-2 font-bold text-white">
        <Gift className="h-5 w-5 text-[var(--gold-bright)]" /> {label}
      </p>
      <p className="text-sm leading-6 text-gray-300">{t('intro')}</p>

      <div className="flex flex-col gap-1.5 text-sm text-gray-200 sm:flex-row sm:gap-4">
        {(['vat', 'tax_code'] as const).map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input
              type="radio"
              name="trial_id_type"
              checked={type === option}
              onChange={() => {
                setType(option)
                setValue('')
                setError(null)
              }}
              className="h-4 w-4 accent-[var(--gold)]"
            />
            {option === 'vat' ? t('withVat') : t('withoutVat')}
          </label>
        ))}
      </div>

      {type === 'vat' ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label={t('country')} className={`${input} sm:w-44`}>
            {COUNTRIES.map((code) => (
              <option key={code} value={code} className="text-black">
                {countryName(code)}
              </option>
            ))}
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            placeholder={vatExample(country) ?? t('vatPlaceholder')}
            aria-label={t('vatLabel')}
            maxLength={20}
            className={`${input} font-mono tracking-wider`}
          />
        </div>
      ) : (
        <>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            placeholder="RSSMRA80A01H501U"
            aria-label={t('taxCodeLabel')}
            maxLength={16}
            className={`${input} font-mono tracking-wider`}
          />
          <p className="text-xs text-gray-400">{t('taxCodeHint')}</p>
        </>
      )}

      <p className="flex items-start gap-1.5 text-xs leading-5 text-gray-400">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gold-bright)]" /> {t('oneTrial')}
      </p>

      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] disabled:opacity-50"
      >
        {busy && <LoaderCircle className="h-5 w-5 animate-spin" />} {t('submit')}
      </button>

      {error && (
        <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-200">
          {t(`error_${error}`)}
          {error === 'birthdateMissing' && (
            <>
              {' '}
              <Link href="/dashboard?profilo=1" className="underline">
                {t('openProfile')}
              </Link>
            </>
          )}
        </p>
      )}
    </form>
  )
}

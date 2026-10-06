'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, KeyRound, MailSearch, ShieldAlert } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { DATA_CLASS_KEYS, type ScudoResult } from '@/lib/scudoDati'

// Esito di un controllo: nessuna fuga oppure l'elenco dei servizi violati
// con i dati esposti e cosa fare adesso.

const FIRST = 8

export default function BreachResult({ result, own }: { result: ScudoResult; own: boolean }) {
  const t = useTranslations('scudoDati')
  const [showAll, setShowAll] = useState(false)

  const label = (raw: string) => {
    const key = DATA_CLASS_KEYS[raw.toLowerCase()]
    return key ? t(`data_${key}`) : raw
  }

  if (!result.breached) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className="text-lg font-bold text-emerald-900">{t('safeTitle')}</p>
            <p className="mt-1 text-sm leading-6 text-emerald-950">{t('safeText')}</p>
            {result.pasteCount > 0 && <p className="mt-2 text-sm text-emerald-950">{t('pasteNote', { count: result.pasteCount })}</p>}
          </div>
        </div>
      </div>
    )
  }

  const shown = showAll ? result.breaches : result.breaches.slice(0, FIRST)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="text-lg font-bold text-red-900">{t('breachedTitle', { count: result.breaches.length })}</p>
            <p className="mt-1 text-sm leading-6 text-red-950">{own ? t('breachedTextOwn') : t('breachedTextOther')}</p>
            {result.pasteCount > 0 && <p className="mt-2 text-sm text-red-950">{t('pasteNote', { count: result.pasteCount })}</p>}
          </div>
        </div>
      </div>

      <ul className="space-y-3">
        {shown.map((breach, index) => {
          const classes = [...new Set(breach.dataClasses.map(label))]
          const risky = breach.passwordRisk === 'plaintext' || breach.passwordRisk === 'easytocrack'
          return (
            <li key={`${breach.name}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-[var(--ink)]">
                  {breach.name}
                  {breach.domain && <span className="ml-2 text-sm font-normal text-gray-500">{breach.domain}</span>}
                </p>
                {breach.date && <span className="text-sm text-gray-500">{breach.date}</span>}
              </div>
              {classes.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('exposedLabel')}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {classes.map((item) => (
                      <li key={item} className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-xs font-medium text-[var(--ink)] ring-1 ring-gray-200">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {risky && (
                <p className="mt-3 flex items-start gap-2 text-sm text-red-800">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {breach.passwordRisk === 'plaintext' ? t('riskPlaintext') : t('riskEasy')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {result.breaches.length > FIRST && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {showAll ? t('showLess') : t('showAll', { count: result.breaches.length })}
        </button>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <h4 className="text-base font-semibold text-amber-950">{t('tipsTitle')}</h4>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-amber-950">
          <li>{t('tipPassword')}</li>
          <li>{t('tip2fa')}</li>
          <li>{t('tipPhishing')}</li>
          <li>{t('tipManager')}</li>
        </ul>
        <Link
          href="/marketplace/checkmail"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-amber-950 ring-1 ring-amber-200 hover:bg-amber-100"
        >
          <MailSearch className="h-4 w-4" aria-hidden />
          {t('checkmailLink')}
        </Link>
      </div>
    </div>
  )
}

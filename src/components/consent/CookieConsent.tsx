'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Cookie, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { needsConsent, OPEN_PREFERENCES_EVENT, readConsent, writeConsent, type ConsentCategory, type ConsentChoices } from '@/lib/consent'
import { useActiveConsentCategories } from '@/components/consent/ConsentGate'

// Banner dei cookie facoltativi (vedi lib/consent.ts). Senza categorie accese
// dall'Admin non mostra nulla. «Accetta» e «Rifiuta» hanno lo stesso aspetto; la
// X chiude come un rifiuto; «Personalizza» apre le scelte per categoria.
export default function CookieConsent() {
  const t = useTranslations('cookieConsent')
  const active = useActiveConsentCategories()
  const [open, setOpen] = useState(false)
  const [detailed, setDetailed] = useState(false)
  const [choices, setChoices] = useState<ConsentChoices>({})

  useEffect(() => {
    if (!active.length) return
    const state = readConsent()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- il cookie si legge solo nel browser
    if (needsConsent(state, active)) setOpen(true)
    const reopen = () => {
      setChoices(readConsent()?.choices ?? {})
      setDetailed(true)
      setOpen(true)
    }
    window.addEventListener(OPEN_PREFERENCES_EVENT, reopen)
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, reopen)
  }, [active])

  if (!active.length || !open) return null

  const save = (value: ConsentChoices) => {
    writeConsent(value, active)
    setOpen(false)
    setDetailed(false)
  }
  const all = (value: boolean) => Object.fromEntries(active.map((c) => [c, value])) as ConsentChoices
  const button = 'flex-1 rounded-xl border-2 border-[var(--ink)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:bg-gray-50 sm:flex-none sm:min-w-32'

  return (
    <div role="dialog" aria-modal="false" aria-label={t('title')} className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4">
      <div className="relative mx-auto max-w-3xl rounded-2xl border border-[var(--gold)]/40 bg-white p-4 shadow-2xl sm:p-5">
        <button type="button" onClick={() => save(all(false))} aria-label={t('closeReject')} title={t('closeReject')} className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
        <p className="flex items-center gap-2 pr-8 font-bold text-[var(--ink)]">
          <Cookie className="h-5 w-5 text-[var(--gold)]" /> {t('title')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {t('text')}{' '}
          <Link href="/privacy#cookie" className="font-semibold text-[var(--gold)] underline">
            {t('policyLink')}
          </Link>
        </p>

        {detailed && (
          <div className="mt-4 space-y-2">
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm">
              <input type="checkbox" checked disabled className="mt-0.5 h-4 w-4" />
              <span>
                <span className="block font-semibold text-[var(--ink)]">
                  {t('necessaryTitle')} <span className="text-xs font-normal text-gray-500">· {t('alwaysOn')}</span>
                </span>
                <span className="text-gray-600">{t('necessaryText')}</span>
              </span>
            </label>
            {active.map((c: ConsentCategory) => (
              <label key={c} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm hover:border-[var(--gold)]">
                <input
                  type="checkbox"
                  checked={choices[c] === true}
                  onChange={(e) => setChoices((prev) => ({ ...prev, [c]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-[var(--gold)]"
                />
                <span>
                  <span className="block font-semibold text-[var(--ink)]">{t(`cat_${c}_title`)}</span>
                  <span className="text-gray-600">{t(`cat_${c}_text`)}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => save(all(false))} className={button}>
            {t('reject')}
          </button>
          <button type="button" onClick={() => save(all(true))} className={button}>
            {t('accept')}
          </button>
          {detailed ? (
            <button type="button" onClick={() => save(choices)} className="w-full rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:brightness-125 sm:ml-auto sm:w-auto">
              {t('save')}
            </button>
          ) : (
            <button type="button" onClick={() => setDetailed(true)} className="w-full px-2 py-2 text-sm font-semibold text-gray-600 underline hover:text-[var(--ink)] sm:ml-auto sm:w-auto">
              {t('customize')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { claimFidelityCode, type ClaimResult } from '@/app/actions/fidelity'
import { defaultLocale } from '../../../i18n'

export default function FidelityClaim({ code }: { code: string }) {
  const t = useTranslations('fidelity')
  const router = useRouter()
  const locale = useLocale()
  const [result, setResult] = useState<ClaimResult | null>(null)
  // Rete caduta: messaggio e «Riprova» invece di restare su «Sto registrando…»
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // In dev (StrictMode) l'effetto parte due volte: il QR va usato una volta sola.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    claimFidelityCode(code, locale)
      .then((res) => {
        if ((res.status === 'ok' || res.status === 'redeemed') && res.token) {
          const prefix = locale === defaultLocale ? '' : `/${locale}`
          router.replace(`${prefix}/f/${res.token}?esito=${res.status}`)
          return
        }
        setResult(res)
      })
      .catch(() => {
        // Il codice non è stato usato: si può riprovare con lo stesso QR
        started.current = false
        setFailed(true)
      })
  }, [code, locale, router, attempt])

  if (failed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ink)] px-4">
        <div className="w-full max-w-sm rounded-2xl bg-[var(--paper)] p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <p className="mt-3 font-bold text-[var(--ink)]">{t('claimNetworkError')}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false)
              setAttempt((n) => n + 1)
            }}
            className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 text-sm font-bold text-[var(--ink)]"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ink)] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--paper)] p-6 text-center">
        {!result ? (
          <>
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-[var(--gold)]" />
            <p className="mt-3 font-semibold text-[var(--ink)]">{t('claimLoading')}</p>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <p className="mt-3 font-bold text-[var(--ink)]">{t(`customerStatus_${result.status}`)}</p>
            {result.status === 'too_soon' && result.nextStampAt && (
              <p className="mt-1 text-sm text-[var(--muted)]">{t('nextStampAt', { time: new Date(result.nextStampAt).toLocaleString(locale) })}</p>
            )}
            {result.token ? (
              <Link
                href={`/f/${result.token}`}
                className="mt-5 inline-block rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 text-sm font-bold text-[var(--ink)]"
              >
                {t('openMyCard')}
              </Link>
            ) : (
              <Link href="/f" className="mt-5 inline-block text-sm font-semibold text-[var(--gold)]">
                {t('myCards')}
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { AtSign, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { checkMyEmail, checkOtherEmail } from '@/app/actions/scudoDati'
import { EMAIL_RE, maskEmail, type ScudoError, type ScudoResult } from '@/lib/scudoDati'
import BreachResult from '@/components/scudoDati/BreachResult'
import PasswordCheck from '@/components/scudoDati/PasswordCheck'
import GoogleRemovalGuide from '@/components/scudoDati/GoogleRemovalGuide'

// SCUDO DATI: la propria email (gratis), un'altra email (KU Karma) e la
// password (solo nel browser).

const BUTTON =
  'flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]'

function ErrorBox({ error, cost }: { error: ScudoError; cost: number }) {
  const t = useTranslations('scudoDati')
  return (
    <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      {t(`err_${error}`, { cost })}
      {error === 'karma' && (
        <Link href="/wallet" className="ml-1 font-semibold underline underline-offset-2">
          {t('earnLink')}
        </Link>
      )}
    </div>
  )
}

export default function ScudoDatiTool({ maskedEmail, cost, initialBalance }: { maskedEmail: string; cost: number; initialBalance: number }) {
  const t = useTranslations('scudoDati')
  const otherId = useId()

  const [ownPending, startOwn] = useTransition()
  const [own, setOwn] = useState<{ result?: ScudoResult; error?: ScudoError } | null>(null)

  const [otherPending, startOther] = useTransition()
  const [otherEmail, setOtherEmail] = useState('')
  const [other, setOther] = useState<{ result?: ScudoResult; error?: ScudoError; email?: string } | null>(null)
  const [balance, setBalance] = useState(initialBalance)

  function runOwn() {
    startOwn(async () => {
      const res = await checkMyEmail().catch(() => ({ ok: false as const, error: 'failed' as const }))
      setOwn(res.ok ? { result: res.result } : { error: res.error })
    })
  }

  function runOther(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = otherEmail.trim()
    if (!EMAIL_RE.test(email)) {
      setOther({ error: 'invalid' })
      return
    }
    startOther(async () => {
      const res = await checkOtherEmail(email).catch(() => ({ ok: false as const, error: 'failed' as const, balance: undefined }))
      if (typeof res.balance === 'number') setBalance(res.balance)
      setOther(res.ok ? { result: res.result, email: maskEmail(email.toLowerCase()) } : { error: res.error })
    })
  }

  return (
    <div className="space-y-6">
      {/* 1. La tua email */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
          <Mail className="h-5 w-5 text-[var(--gold)]" aria-hidden />
          {t('ownTitle')}
        </h3>
        <p className="mt-1 text-sm leading-6 text-gray-600">{t('ownText')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-xl bg-[var(--paper)] px-4 py-2.5 font-mono text-sm text-[var(--ink)] ring-1 ring-gray-200">{maskedEmail || '—'}</span>
          <button type="button" onClick={runOwn} disabled={ownPending || !maskedEmail} className={BUTTON}>
            {ownPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden />}
            {ownPending ? t('checking') : t('check')}
          </button>
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t('free')}</span>
        </div>
        <div aria-live="polite" className="mt-4 empty:hidden">
          {own?.error && <ErrorBox error={own.error} cost={cost} />}
          {own?.result && <BreachResult result={own.result} own />}
        </div>
      </section>

      {/* 2. Un'altra email */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
          <AtSign className="h-5 w-5 text-[var(--gold)]" aria-hidden />
          {t('otherTitle')}
        </h3>
        <p className="mt-1 text-sm leading-6 text-gray-600">{t('otherText')}</p>
        <form onSubmit={runOther} className="mt-4" noValidate>
          <label htmlFor={otherId} className="mb-2 block text-sm font-semibold text-[var(--ink)]">
            {t('otherLabel')}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={otherId}
              type="email"
              inputMode="email"
              value={otherEmail}
              onChange={(event) => {
                setOtherEmail(event.target.value)
                if (other?.error) setOther(null)
              }}
              placeholder={t('otherPlaceholder')}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={254}
              className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
            />
            <button type="submit" disabled={otherPending || !otherEmail.trim()} className={BUTTON}>
              {otherPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden />}
              {otherPending ? t('checking') : t('otherCheck', { cost })}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('balance', { balance })}</p>
        </form>
        <div aria-live="polite" className="mt-4 empty:hidden">
          {other?.error && <ErrorBox error={other.error} cost={cost} />}
          {other?.result && (
            <div className="space-y-3">
              {other.email && <p className="text-sm text-gray-600">{t('resultFor', { email: other.email })}</p>}
              <BreachResult result={other.result} own={false} />
            </div>
          )}
        </div>
      </section>

      {/* 3. La tua password */}
      <PasswordCheck />

      {/* Guida: togliere i propri dati dai risultati di Google */}
      <GoogleRemovalGuide />
    </div>
  )
}

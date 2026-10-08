'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, LoaderCircle, PiggyBank } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { addReceiptToSpendly, type ReceiptSpendlyStatus } from '@/app/actions/ecosystem'

// Ricevuta digitale → Spendly: l'importo della ricevuta entra in Spendly con
// un tocco, come spesa per chi la riceve e come entrata per chi l'ha fatta.
export default function ReceiptSpendlyBox({
  code,
  initialStatus,
  loginHref,
  signupHref,
}: {
  code: string
  initialStatus: ReceiptSpendlyStatus
  loginHref?: string
  // Registrazione con l'invito di chi ha emesso la ricevuta
  signupHref?: string
}) {
  const t = useTranslations('ecosystem')
  const [status, setStatus] = useState(initialStatus)
  const [kind] = useState<'expense' | 'income'>(initialStatus === 'income' ? 'income' : 'expense')
  const [busy, setBusy] = useState(false)
  if (status === 'no_value') return null

  const add = async () => {
    setBusy(true)
    setStatus(await addReceiptToSpendly(code))
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <PiggyBank className="h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-[var(--ink)]">{t('receiptSpendlyTitle')}</p>
          <p className="text-sm text-[var(--muted)]">
            {status === 'added'
              ? t(kind === 'income' ? 'receiptSpendlyAddedIncome' : 'receiptSpendlyAddedExpense')
              : status === 'no_access'
                ? t('receiptSpendlyNoAccess')
                : status === 'login'
                  ? t('receiptSpendlyLogin')
                  : t(status === 'income' ? 'receiptSpendlyHintIncome' : 'receiptSpendlyHintExpense')}
          </p>
        </div>
      </div>
      {status === 'expense' || status === 'income' ? (
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {t(status === 'income' ? 'receiptSpendlyAddIncome' : 'receiptSpendlyAddExpense')}
        </button>
      ) : status === 'added' ? (
        <Link
          href={kind === 'income' ? '/marketplace/spendly/entrate' : '/marketplace/spendly/spese-variabili'}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
        >
          <Check className="h-4 w-4" /> {t('receiptSpendlyOpen')}
        </Link>
      ) : status === 'no_access' ? (
        <Link href="/strumenti/spendly" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
          {t('receiptSpendlyDiscover')}
        </Link>
      ) : (
        // Senza account: prima la registrazione (con l'invito di chi ha emesso la ricevuta), poi l'accesso
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={signupHref ?? '/register'} className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">
            {t('receiptSpendlySignupCta')}
          </Link>
          <Link href={loginHref ?? '/login'} className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
            {t('receiptSpendlyLoginCta')}
          </Link>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Building2, LoaderCircle, MapPin } from 'lucide-react'
import { lookupIbanBank, type IbanBankInfo as Info } from '@/app/actions/ibanBank'

// Banca e sportello di un IBAN italiano (registro pubblico della Banca
// d'Italia). Al server vanno solo ABI e CAB, mai il numero di conto.
export default function IbanBankInfo({ abi, cab }: { abi: string; cab: string }) {
  const t = useTranslations('verificaIban')
  const [info, setInfo] = useState<Info | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    lookupIbanBank(abi, cab)
      .then((r) => alive && setInfo(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [abi, cab])

  if (failed) return null
  if (!info)
    return (
      <p className="mb-4 flex items-center gap-2 text-sm text-[var(--muted)]">
        <LoaderCircle className="h-4 w-4 animate-spin" /> {t('bankLoading')}
      </p>
    )

  return (
    <div className="mb-4 space-y-2 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-4">
      <p className="flex items-start gap-2">
        <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" aria-hidden />
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('bankTitle')}</span>
          {info.bank ? (
            <>
              <span className="block font-bold text-[var(--ink)]">{info.bank.name}</span>
              {info.bank.kind !== 'bank' && <span className="block text-xs text-gray-700">{t(`bankKind_${info.bank.kind}`)}</span>}
            </>
          ) : (
            <span className="block text-sm font-semibold text-amber-900">{t('bankNotFound')}</span>
          )}
        </span>
      </p>
      {info.bank && (
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" aria-hidden />
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('branchTitle')}</span>
            {info.branch ? (
              <span className="block text-sm text-[var(--ink)]">
                {info.branch.address ? `${info.branch.address}, ${info.branch.cap} ` : ''}
                {info.branch.city}
              </span>
            ) : (
              <span className="block text-sm text-gray-700">{t('branchNotFound')}</span>
            )}
          </span>
        </p>
      )}
      <p className="text-[11px] text-[var(--muted)]">{t('bankSource')}</p>
    </div>
  )
}

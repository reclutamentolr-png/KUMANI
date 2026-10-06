'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { checkVatNumber, type VatCheckResult } from '@/app/actions/vatCheck'

// Pulsante «Verifica» sotto un campo partita IVA, con l'esito su una riga.
export default function VatCheck({ value, onUseName }: { value: string; onUseName?: (name: string) => void }) {
  const t = useTranslations('ecosystem')
  const [checking, setChecking] = useState(false)
  // L'esito vale solo per il valore controllato: se il campo cambia, sparisce
  const [result, setResult] = useState<{ value: string; data: VatCheckResult } | null>(null)
  const current = result && result.value === value ? result.data : null

  async function check() {
    const v = value
    if (!v.trim()) return
    setChecking(true)
    try {
      const data = await checkVatNumber(v)
      setResult({ value: v, data })
    } catch {
      setResult({ value: v, data: { status: 'unavailable' } })
    } finally {
      setChecking(false)
    }
  }

  const registry = current?.registryUrl ? (
    <a href={current.registryUrl} target="_blank" rel="noopener noreferrer" className="ml-1 font-semibold underline">
      {t('vatRegistryLink')}
    </a>
  ) : null

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <button
        type="button"
        onClick={check}
        disabled={!value.trim() || checking}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--gold)]/40 px-2 py-0.5 font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {checking && <LoaderCircle className="h-3 w-3 animate-spin" />}
        {checking ? t('vatChecking') : t('vatCheckButton')}
      </button>
      {current?.status === 'valid' && (
        <span className="text-green-700">
          {current.name ? t('vatValidName', { name: current.name }) : t('vatValid')}
          {onUseName && current.name && (
            <button type="button" onClick={() => onUseName(current.name!)} className="ml-2 font-semibold underline hover:text-green-900">
              {t('vatUseName')}
            </button>
          )}
        </span>
      )}
      {current?.status === 'not_found' && (
        <span className="text-amber-700">
          {t('vatNotFound')}
          {registry}
        </span>
      )}
      {current?.status === 'invalid_format' && <span className="text-red-700">{t('vatInvalidFormat')}</span>}
      {current?.status === 'unavailable' && (
        <span className="text-gray-500">
          {t('vatUnavailable')}
          {registry}
        </span>
      )}
    </div>
  )
}

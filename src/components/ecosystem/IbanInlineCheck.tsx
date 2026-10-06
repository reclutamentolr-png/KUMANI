'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { IBAN_LENGTHS, countryName, normalizeIban, validateIban } from '@/lib/iban'

// IBAN scritto in un testo libero: 2 lettere + 2 cifre + 11..30 caratteri, anche a gruppi
const IBAN_LIKE = /\b[A-Z]{2}\d{2}(?:[  ]?[A-Z0-9]){11,30}\b/i

// Riga sotto un campo di testo libero: controlla il primo IBAN trovato.
export default function IbanInlineCheck({ text }: { text: string }) {
  const t = useTranslations('ecosystem')
  const locale = useLocale()
  const result = useMemo(() => {
    const m = IBAN_LIKE.exec(text ?? '')
    if (!m) return null
    // Il testo dopo l'IBAN (es. «… 456 Banca») può finire nella cattura: si taglia alla lunghezza del paese
    const raw = normalizeIban(m[0])
    const len = IBAN_LENGTHS[raw.slice(0, 2)]
    return validateIban(len && raw.length > len ? raw.slice(0, len) : raw)
  }, [text])
  if (!result) return null

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs">
      {result.valid ? (
        <span className="text-green-700">{t('ibanInlineValid', { country: countryName(result.country ?? '', locale) })}</span>
      ) : (
        <span className="text-red-700">{t('ibanInlineInvalid')}</span>
      )}
      <Link
        href={`/marketplace/verifica-iban?iban=${encodeURIComponent(result.normalized)}`}
        className="font-semibold text-[var(--gold)] underline hover:text-[var(--ink)]"
      >
        {t('ibanInlineCheck')}
      </Link>
    </p>
  )
}

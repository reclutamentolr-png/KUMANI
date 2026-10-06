'use client'

import { useId, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ShieldCheck } from 'lucide-react'
import { normalizeIban } from '@/lib/iban'
import { parseVatInput } from '@/lib/vat'
import { defaultLocale } from '../../../i18n'

// Riconosce cosa ha incollato l'utente e restituisce lo strumento giusto
// (percorso senza lingua), oppure null se non si capisce.
export function quickCheckTarget(raw: string): string | null {
  const value = raw.trim().slice(0, 200)
  if (!value) return null

  // IBAN: 2 lettere + 2 cifre all'inizio e almeno 15 caratteri (l'esito,
  // valido o no, lo mostra la pagina Verifica IBAN)
  const iban = normalizeIban(value)
  if (/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban) && iban.length >= 15 && iban.length <= 34) {
    return `/marketplace/verifica-iban?iban=${encodeURIComponent(iban)}`
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return `/marketplace/checkmail?sender=${encodeURIComponent(value)}`

  // Partita IVA (parseVatInput scarta già indirizzi web ed email); anche se
  // la cifra di controllo è sbagliata si va in SVAT, che spiega l'errore
  if (parseVatInput(value)) return `/marketplace/svat?vat=${encodeURIComponent(value)}`

  // Sito: inizia con http oppure contiene un punto e nessuno spazio
  if (/^https?:\/\//i.test(value) || (value.includes('.') && !/\s/.test(value) && /[a-z]/i.test(value))) {
    return `/marketplace/svat?url=${encodeURIComponent(value)}`
  }
  return null
}

// Box «Controlla» nella pagina dei servizi (gruppo Sicurezza): un campo solo
// per IBAN, email, partita IVA o sito; porta allo strumento già compilato.
export default function QuickCheckBox() {
  const t = useTranslations('ecosystem')
  const locale = useLocale()
  const router = useRouter()
  const inputId = useId()
  const [value, setValue] = useState('')
  const [unknown, setUnknown] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = quickCheckTarget(value)
    if (!target) {
      setUnknown(true)
      return
    }
    router.push(`${locale === defaultLocale ? '' : `/${locale}`}${target}`)
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-[var(--gold)]/35 bg-white p-4 shadow-sm sm:p-5" noValidate>
      <label htmlFor={inputId} className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
        <ShieldCheck className="h-5 w-5 text-[var(--gold)]" aria-hidden />
        {t('checkBoxTitle')}
      </label>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('checkBoxText')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setUnknown(false)
          }}
          maxLength={200}
          placeholder={t('checkBoxPlaceholder')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={unknown}
          className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('checkBoxButton')}
        </button>
      </div>
      <div aria-live="polite">
        {unknown && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t('checkBoxUnknown')}</p>}
      </div>
    </form>
  )
}

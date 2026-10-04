'use client'

import { useState, type ReactNode } from 'react'

export type CheckoutFormTexts = {
  asConsumer: string
  asBusiness: string
  consentLabel: string
  consentHint: string
  businessName: string
  vatNumber: string
  vatHint: string
  businessDeclaration: string
  // Accettazione di Termini e Privacy (con i link), obbligatoria per tutti
  termsLabel: ReactNode
  // Abbonamenti: data e prezzo del rinnovo automatico, accanto al pulsante
  renewalNote?: string
}

// Modulo di pagamento (POST a /api/checkout): acquisto come privato, con il
// consenso all'avvio immediato, oppure come azienda/professionista con
// ragione sociale, P.IVA e dichiarazione B2B (niente recesso del consumatore).
// Per tutti: accettazione di Termini e Privacy; per gli abbonamenti, data e
// prezzo del rinnovo automatico scritti sopra il pulsante.
// Il pulsante arriva dal server come children. I testi arrivano tradotti dal
// server (/billing sceglie la lingua dal cookie).
export default function CheckoutForm({
  action,
  texts,
  dark = false,
  children,
}: {
  action: string
  texts: CheckoutFormTexts
  dark?: boolean
  children: ReactNode
}) {
  const [buyer, setBuyer] = useState<'consumer' | 'business'>('consumer')
  const text = dark ? 'text-gray-300' : 'text-gray-600'
  const input = dark
    ? 'w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500'
    : 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900'
  const accent = dark ? 'accent-[var(--gold)]' : 'accent-indigo-600'

  return (
    <form action={action} method="POST" className="space-y-3 text-left">
      <div className={`flex flex-col gap-1.5 text-sm sm:flex-row sm:gap-4 ${text}`}>
        {(['consumer', 'business'] as const).map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="buyer_type"
              value={value}
              checked={buyer === value}
              onChange={() => setBuyer(value)}
              className={`h-4 w-4 ${accent}`}
            />
            {value === 'consumer' ? texts.asConsumer : texts.asBusiness}
          </label>
        ))}
      </div>

      {buyer === 'business' ? (
        <>
          <input name="business_name" required maxLength={200} placeholder={texts.businessName} aria-label={texts.businessName} className={input} />
          <div>
            <input name="vat_number" required maxLength={20} placeholder={texts.vatNumber} aria-label={texts.vatNumber} className={input} />
            <p className={`mt-1 text-xs ${dark ? 'text-gray-500' : 'text-gray-500'}`}>{texts.vatHint}</p>
          </div>
          <label className={`flex items-start gap-2 text-xs leading-relaxed ${text}`}>
            <input type="checkbox" name="business_declaration" value="1" required className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} />
            <span>{texts.businessDeclaration}</span>
          </label>
        </>
      ) : (
        <label className={`flex items-start gap-2 text-xs leading-relaxed ${text}`}>
          <input type="checkbox" name="immediate_start" value="1" required className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} />
          <span>
            <span className="block text-sm font-semibold">{texts.consentLabel}</span>
            <span className="mt-0.5 block">{texts.consentHint}</span>
          </span>
        </label>
      )}

      <label className={`flex items-start gap-2 text-xs leading-relaxed ${text}`}>
        <input type="checkbox" name="accept_terms" value="1" required className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`} />
        <span>{texts.termsLabel}</span>
      </label>

      {texts.renewalNote && <p className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${dark ? 'bg-white/5 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>{texts.renewalNote}</p>}

      {children}
    </form>
  )
}

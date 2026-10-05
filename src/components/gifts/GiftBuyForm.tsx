'use client'

import { useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Gift, Minus, Plus } from 'lucide-react'
import { GIFT_MAX_QUANTITY, GIFT_MESSAGE_MAX } from '@/lib/gifts'

export type GiftOption = { value: string; label: string; priceCents: number; group: 'plan' | 'pass' }

type Texts = { asConsumer: string; asBusiness: string; businessName: string; vatNumber: string; vatHint: string; businessDeclaration: string; termsLabel: ReactNode }

// Modulo d'acquisto dei regali (POST a /api/checkout/gift): cosa regalare,
// quanti codici, messaggio facoltativo, privato o azienda, Termini.
export default function GiftBuyForm({ options, initial, texts }: { options: GiftOption[]; initial: string; texts: Texts }) {
  const t = useTranslations('gifts')
  const locale = useLocale()
  const [item, setItem] = useState(options.some((o) => o.value === initial) ? initial : (options[0]?.value ?? ''))
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState('')
  const [buyer, setBuyer] = useState<'consumer' | 'business'>('consumer')
  const selected = options.find((o) => o.value === item)
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(cents / 100)
  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[var(--gold)] focus:outline-none'
  const plans = options.filter((o) => o.group === 'plan')
  const passes = options.filter((o) => o.group === 'pass')

  return (
    <form action="/api/checkout/gift" method="POST" className="space-y-4">
      <div>
        <label htmlFor="gift-item" className="mb-1 block text-sm font-bold text-[var(--ink)]">
          {t('whatLabel')}
        </label>
        <select id="gift-item" name="item" value={item} onChange={(e) => setItem(e.target.value)} className={input}>
          <optgroup label={t('groupPlans')}>
            {plans.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {money(o.priceCents)}
              </option>
            ))}
          </optgroup>
          {passes.length > 0 && (
            <optgroup label={t('groupPasses')}>
              {passes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {money(o.priceCents)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="mt-1 text-xs text-[var(--muted)]">{selected?.group === 'plan' ? t('planHint') : t('passHint')}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="mb-1 block text-sm font-bold text-[var(--ink)]">{t('quantityLabel')}</span>
          <div className="inline-flex items-center rounded-xl border border-gray-300">
            <button type="button" aria-label="−" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="p-2.5 disabled:opacity-30">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-bold tabular-nums">{quantity}</span>
            <button type="button" aria-label="+" disabled={quantity >= GIFT_MAX_QUANTITY} onClick={() => setQuantity((q) => Math.min(GIFT_MAX_QUANTITY, q + 1))} className="p-2.5 disabled:opacity-30">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <input type="hidden" name="quantity" value={quantity} />
          <p className="mt-1 text-xs text-[var(--muted)]">{t('quantityHint', { max: GIFT_MAX_QUANTITY })}</p>
        </div>
        {selected && (
          <div className="text-right">
            <span className="block text-xs text-[var(--muted)]">{t('total')}</span>
            <span className="text-2xl font-extrabold text-[var(--ink)]">{money(selected.priceCents * quantity)}</span>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="gift-message" className="mb-1 block text-sm font-bold text-[var(--ink)]">
          {t('messageLabel')}
        </label>
        <textarea
          id="gift-message"
          name="message"
          rows={2}
          maxLength={GIFT_MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('messagePlaceholder')}
          className={input}
        />
        <p className="mt-1 text-xs text-[var(--muted)]">{t('messageHint')}</p>
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-gray-600 sm:flex-row sm:gap-4">
        {(['consumer', 'business'] as const).map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input type="radio" name="buyer_type" value={value} checked={buyer === value} onChange={() => setBuyer(value)} className="h-4 w-4 accent-[var(--gold)]" />
            {value === 'consumer' ? texts.asConsumer : texts.asBusiness}
          </label>
        ))}
      </div>
      {buyer === 'business' && (
        <>
          <input name="business_name" required maxLength={200} placeholder={texts.businessName} aria-label={texts.businessName} className={input} />
          <div>
            <input name="vat_number" required maxLength={20} placeholder={texts.vatNumber} aria-label={texts.vatNumber} className={input} />
            <p className="mt-1 text-xs text-gray-500">{texts.vatHint}</p>
          </div>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-gray-600">
            <input type="checkbox" name="business_declaration" value="1" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]" />
            <span>{texts.businessDeclaration}</span>
          </label>
        </>
      )}

      <p className="rounded-lg bg-[var(--gold-pale)]/50 px-3 py-2 text-xs leading-relaxed text-[var(--ink)]">
        {buyer === 'consumer' ? t('termsNoteConsumer') : t('termsNoteBusiness')}
      </p>

      <label className="flex items-start gap-2 text-xs leading-relaxed text-gray-600">
        <input type="checkbox" name="accept_terms" value="1" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]" />
        <span>{texts.termsLabel}</span>
      </label>

      <button type="submit" disabled={!selected} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] disabled:opacity-50">
        <Gift className="h-5 w-5" />
        {selected ? t('payButton', { total: money(selected.priceCents * quantity) }) : t('payButtonEmpty')}
      </button>
    </form>
  )
}

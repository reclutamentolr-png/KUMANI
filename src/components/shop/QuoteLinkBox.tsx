'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BadgeCheck, Check, CircleCheck, Copy, ExternalLink, Link2, LoaderCircle, MessageCircle } from 'lucide-react'
import { getQuotePublicLink } from '@/app/actions/quotes'
import { defaultLocale } from '../../../i18n'

// Pagina del venditore: link del preventivo per il cliente (leggere,
// accettare e pagare online) e stato di accettazione e pagamento.
export default function QuoteLinkBox({
  quoteId,
  quoteNumber,
  initialToken,
  paymentMode,
  depositPercent,
  canCharge,
  acceptedAt,
  acceptedBy,
  paymentStatus,
  paidAmount,
  paidAt,
  siteUrl,
}: {
  // Indirizzo del sito (server): il link è uguale sul server e nel browser
  siteUrl: string
  quoteId: string
  quoteNumber: number
  initialToken: string | null
  paymentMode: 'none' | 'full' | 'deposit'
  depositPercent: number | null
  canCharge: boolean
  acceptedAt: string | null
  acceptedBy: string | null
  paymentStatus: string
  paidAmount: number | null
  paidAt: string | null
}) {
  const t = useTranslations('quotePublic')
  const locale = useLocale()
  const [token, setToken] = useState(initialToken)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  const url = token ? `${siteUrl}${locale === defaultLocale ? '' : `/${locale}`}/preventivo/${token}` : null
  const eur = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  const create = async () => {
    setBusy(true)
    setError(false)
    const result = await getQuotePublicLink(quoteId)
    setBusy(false)
    if (result.success) setToken(result.data.token)
    else setError(true)
  }
  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
          <Link2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-[var(--ink)]">{t('linkTitle')}</h2>
          <p className="text-sm text-[var(--muted)]">
            {paymentMode === 'none'
              ? t('linkHintAccept')
              : !canCharge
                ? t('linkHintNoStripe')
                : paymentMode === 'deposit'
                  ? t('linkHintDeposit', { percent: depositPercent ?? 0 })
                  : t('linkHintFull')}
          </p>
        </div>
      </div>

      {paymentStatus === 'paid' ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <BadgeCheck className="h-4 w-4 shrink-0" /> {t('statusPaid', { amount: eur(paidAmount ?? 0), date: paidAt ? date(paidAt) : '', name: acceptedBy ?? '' })}
        </p>
      ) : acceptedAt ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <CircleCheck className="h-4 w-4 shrink-0" /> {t('statusAccepted', { name: acceptedBy ?? '', date: date(acceptedAt) })}
        </p>
      ) : null}

      {url ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[var(--paper)] px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-700">{url}</span>
            <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--ink)] px-2.5 py-1 text-xs font-bold text-white">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? t('copied') : t('copy')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(t('whatsappText', { number: quoteNumber, url }))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" /> {t('openPage')}
            </a>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} {t('createLink')}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{t('error_saveError')}</p>}
    </section>
  )
}

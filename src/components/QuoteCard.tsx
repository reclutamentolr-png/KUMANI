'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { Copy, FileSpreadsheet, LoaderCircle, Pencil } from 'lucide-react'
import { duplicateQuote } from '@/app/actions/quotes'

type Quote = {
  id: string
  quote_number: number
  client_name: string
  issue_date: string
  total: number
}

export default function QuoteCard({ quote, fromDashboardSuffix = '' }: { quote: Quote; fromDashboardSuffix?: string }) {
  const t = useTranslations('preventivi')
  const locale = useLocale()
  const router = useRouter()
  const [cloning, setCloning] = useState(false)

  // Copia con un nuovo numero e la data di oggi, aperta subito in modifica
  const clone = async () => {
    setCloning(true)
    const result = await duplicateQuote(quote.id)
    if (result.success) router.push(`/marketplace/preventivi/${result.data.id}/edit${fromDashboardSuffix}`)
    else {
      alert(t(result.message))
      setCloning(false)
    }
  }
  const iconButton = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--gold)]/40 bg-white text-[var(--ink)] transition-all hover:bg-[var(--gold-pale)] disabled:opacity-50'

  return (
    <div className="bg-white rounded-xl border border-[var(--gold)]/20 shadow-sm hover:border-[var(--gold)]/50 transition-colors p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="w-10 h-10 rounded-lg bg-[var(--gold-pale)] text-[var(--gold)] flex items-center justify-center shrink-0">
        <FileSpreadsheet className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)] truncate">
            {t('quoteNumberLabel', { number: quote.quote_number })}
          </h3>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {quote.client_name} · {new Date(quote.issue_date).toLocaleDateString(locale)}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="font-bold text-[var(--ink)]">{quote.total.toLocaleString(locale, { style: 'currency', currency: 'EUR' })}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link href={`/marketplace/preventivi/${quote.id}/edit${fromDashboardSuffix}`} className={iconButton} title={t('editQuote')} aria-label={t('editQuote')}>
          <Pencil className="h-4 w-4" />
        </Link>
        <button type="button" onClick={clone} disabled={cloning} className={iconButton} title={t('duplicateQuote')} aria-label={t('duplicateQuote')}>
          {cloning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        </button>
        <Link
          href={`/marketplace/preventivi/${quote.id}${fromDashboardSuffix}`}
          className="px-3 py-2 rounded-lg text-sm font-medium border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all"
        >
          {t('details')}
        </Link>
      </div>
    </div>
  )
}

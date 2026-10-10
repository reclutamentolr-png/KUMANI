'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { Copy, Download, FileSpreadsheet, LoaderCircle, Pencil, Share2 } from 'lucide-react'
import { duplicateQuote, getQuotePdfData } from '@/app/actions/quotes'
import { buildQuotePdfLabels, loadImageAsDataUrl, loadQuoteSectionImages } from '@/lib/pdfHelpers'
import { quoteGrossTotal, quoteImageUrl, type QuoteVatMode } from '@/lib/quotes'
import type { IssuerForPdf, QuoteForPdf } from '@/lib/quotePdfShared'

type Quote = {
  id: string
  quote_number: number
  client_name: string
  issue_date: string
  total: number
  vat_mode?: string | null
  vat_rate?: number | null
  // KUMANI Shop: accettato o pagato dal cliente dalla pagina del preventivo
  accepted_at?: string | null
  payment_status?: string | null
}

export default function QuoteCard({ quote, fromDashboardSuffix = '' }: { quote: Quote; fromDashboardSuffix?: string }) {
  const t = useTranslations('preventivi')
  const locale = useLocale()
  const router = useRouter()
  const [cloning, setCloning] = useState(false)
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null)

  // PDF generato al momento con i dati completi del preventivo
  const buildPdf = async () => {
    const r = await getQuotePdfData(quote.id)
    if (!r.success) throw new Error(r.message)
    const full = r.data.quote as unknown as QuoteForPdf
    const [{ generateQuotePdfBlob }, logoDataUrl, sectionImages] = await Promise.all([
      import('@/lib/quotePdf'),
      r.data.logoUrl ? loadImageAsDataUrl(r.data.logoUrl) : Promise.resolve(null),
      loadQuoteSectionImages(full.sections, quoteImageUrl),
    ])
    const blob = generateQuotePdfBlob({
      quote: full,
      issuer: r.data.issuer as unknown as IssuerForPdf,
      logoDataUrl,
      sectionImages,
      labels: buildQuotePdfLabels(t),
      formatDate: (iso: string) => new Date(iso).toLocaleDateString(locale),
      formatCurrency: (n: number) => n.toLocaleString(locale, { style: 'currency', currency: 'EUR' }),
    })
    return { blob, full }
  }
  const fileName = `preventivo-${quote.quote_number}.pdf`
  const download = (blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  const downloadPdf = async () => {
    setBusy('pdf')
    try {
      download((await buildPdf()).blob)
    } catch (err) {
      console.error(err)
      alert(t('pdfError'))
    } finally {
      setBusy(null)
    }
  }
  // Condividi: menu del telefono con il PDF allegato; dove non c'è, WhatsApp
  // con il riepilogo (e il PDF scaricato, da allegare)
  const share = async () => {
    setBusy('share')
    try {
      const { blob } = await buildPdf()
      const summary = t('shareSummaryText', { number: quote.quote_number, client: quote.client_name, total: quoteGrossTotal(Number(quote.total), quote.vat_mode as QuoteVatMode | null, quote.vat_rate != null ? Number(quote.vat_rate) : null).toLocaleString(locale, { style: 'currency', currency: 'EUR' }) })
      const file = new File([blob], fileName, { type: 'application/pdf' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t('pdfDocumentTitle', { number: quote.quote_number }), text: summary })
      } else {
        download(blob)
        window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank', 'noopener')
      }
    } catch (err) {
      if (!(err instanceof Error) || err.name !== 'AbortError') {
        console.error(err)
        alert(t('pdfError'))
      }
    } finally {
      setBusy(null)
    }
  }

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
          {quote.payment_status === 'paid' ? (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{t('badgePaid')}</span>
          ) : quote.accepted_at ? (
            <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">{t('badgeAccepted')}</span>
          ) : null}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {quote.client_name} · {new Date(quote.issue_date).toLocaleDateString(locale)}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="font-bold text-[var(--ink)]">{quoteGrossTotal(Number(quote.total), quote.vat_mode as QuoteVatMode | null, quote.vat_rate != null ? Number(quote.vat_rate) : null).toLocaleString(locale, { style: 'currency', currency: 'EUR' })}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link href={`/marketplace/preventivi/${quote.id}/edit${fromDashboardSuffix}`} className={iconButton} title={t('editQuote')} aria-label={t('editQuote')}>
          <Pencil className="h-4 w-4" />
        </Link>
        <button type="button" onClick={clone} disabled={cloning} className={iconButton} title={t('duplicateQuote')} aria-label={t('duplicateQuote')}>
          {cloning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        </button>
        <button type="button" data-guest-hide onClick={downloadPdf} disabled={busy !== null} className={iconButton} title={t('downloadPdf')} aria-label={t('downloadPdf')}>
          {busy === 'pdf' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>
        <button type="button" data-guest-hide onClick={share} disabled={busy !== null} className={iconButton} title={t('shareAction')} aria-label={t('shareAction')}>
          {busy === 'share' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
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

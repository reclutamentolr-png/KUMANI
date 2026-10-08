'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Eye, LoaderCircle } from 'lucide-react'
import { buildQuotePdfLabels, loadImageAsDataUrl } from '@/lib/pdfHelpers'
import { computeQuoteTotal, computeSectionsTotal, quoteImageUrl, type QuoteFormData } from '@/lib/quotes'
import type { IssuerForPdf, QuoteForPdf } from '@/lib/quotePdfShared'

// Anteprima dal vivo del preventivo (solo su schermi larghi): è il PDF vero,
// rigenerato poco dopo ogni modifica, con intestazione, cliente e tutti i campi.

export default function QuotePdfPreview({ form, issuer, logoUrl, quoteNumber }: { form: QuoteFormData; issuer: IssuerForPdf; logoUrl: string | null; quoteNumber: number }) {
  const t = useTranslations('preventivi')
  const locale = useLocale()
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const logo = useRef<string | null | undefined>(undefined)
  // Immagini delle sezioni già scaricate (si scaricano una volta sola)
  const images = useRef<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setBusy(true)
      try {
        const [{ generateQuotePdfBlob }] = await Promise.all([import('@/lib/quotePdf')])
        if (logo.current === undefined) logo.current = logoUrl ? await loadImageAsDataUrl(logoUrl).catch(() => null) : null
        const descriptive = form.layout === 'descriptive'
        const items = form.items.filter((i) => i.description.trim())
        const sections = form.sections.filter((s) => s.title.trim() || s.body.trim() || s.amount !== null || s.image || (s.layers?.length ?? 0) > 0)
        for (const s of sections) {
          if (s.kind === 'image' && s.image && !images.current[s.image]) {
            const data = await loadImageAsDataUrl(quoteImageUrl(s.image)).catch(() => null)
            if (data) images.current[s.image] = data
          }
        }
        const quote: QuoteForPdf = {
          quote_number: quoteNumber,
          client_name: form.clientName || '—',
          client_email: form.clientEmail || null,
          client_phone: form.clientPhone || null,
          client_address: form.clientAddress || null,
          client_city: form.clientCity || null,
          client_postal_code: form.clientPostalCode || null,
          client_pec: form.clientPec || null,
          client_vat: form.clientVat || null,
          issue_date: form.issueDate,
          valid_until: form.validUntil || null,
          items,
          payment_info: form.paymentInfo || null,
          notes: form.notes || null,
          total: descriptive ? computeSectionsTotal(sections) : computeQuoteTotal(items),
          layout: form.layout,
          logo_position: form.logoPosition,
          band_style: form.bandStyle,
          subject: form.subject,
          intro: form.intro,
          closing: form.closing,
          sections,
          show_total: form.showTotal,
          vat_mode: form.vatMode,
          signature: form.signature,
        }
        const blob = generateQuotePdfBlob({
          quote,
          issuer,
          logoDataUrl: logo.current,
          labels: buildQuotePdfLabels(t),
          sectionImages: images.current,
          formatDate: (iso: string) => (iso ? new Date(iso).toLocaleDateString(locale) : ''),
          formatCurrency: (n: number) => n.toLocaleString(locale, { style: 'currency', currency: 'EUR' }),
        })
        if (cancelled) return
        const next = URL.createObjectURL(blob)
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return next
        })
      } catch (err) {
        console.error('[QuotePdfPreview]', err)
      } finally {
        if (!cancelled) setBusy(false)
      }
    }, 700)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Il modulo intero: ogni modifica rigenera l'anteprima
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, issuer, logoUrl, quoteNumber, locale])

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
    // Solo alla chiusura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    // Alta quanto tutto il modulo (self-stretch): così il riquadro dentro resta
    // fermo sullo schermo mentre si scorre il modulo, con la sua barra interna
    <aside className="hidden xl:block xl:self-stretch">
      <div className="sticky top-20">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-600">
          <Eye className="h-4 w-4" /> {t('livePreview')}
          {busy && <LoaderCircle className="h-4 w-4 animate-spin text-[var(--gold)]" />}
        </p>
        <div className="h-[calc(100vh-8.5rem)] overflow-hidden rounded-xl border border-gray-300 bg-gray-100 shadow-lg">
          {/* Riquadro nuovo a ogni aggiornamento (key): cambiare solo l'indirizzo aggiungerebbe una
              pagina alla cronologia del browser e «Indietro» sfoglierebbe le anteprime */}
          {url ? <iframe key={url} title={t('livePreview')} src={`${url}#toolbar=0&navpanes=0&view=FitH`} className="h-full w-full" /> : null}
        </div>
        <p className="mt-2 text-xs text-gray-500">{t('livePreviewHint')}</p>
      </div>
    </aside>
  )
}

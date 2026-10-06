'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, LoaderCircle } from 'lucide-react'
import { loadInterFontBase64 } from '@/lib/pdfHelpers'
import type { Catalog } from '@/lib/catalog-server'

// Immagine del sito come data URL per il PDF (null se non si carica: la
// copertina resta solo testo)
async function toDataUrl(path: string): Promise<string | null> {
  try {
    const blob = await (await fetch(path)).blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Scarica il catalogo dei servizi in PDF, nella lingua della pagina
export default function CatalogPdfButton({ catalog, variant = 'gold' }: { catalog: Catalog; variant?: 'gold' | 'light' }) {
  const t = useTranslations('catalog')
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const download = async () => {
    setBusy(true)
    setError(false)
    try {
      // jsPDF solo al clic, fuori dal bundle iniziale
      const [{ generateCatalogPdf }, font, cover, logo] = await Promise.all([
        import('@/lib/catalogPdf'),
        loadInterFontBase64(),
        toDataUrl('/catalog/cover.jpg'),
        toDataUrl('/deck/logo.png'),
      ])
      const date = new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' })
      const blob = generateCatalogPdf(
        catalog,
        {
          title: t('pdfTitle'),
          subtitle: t('pdfSubtitle', { count: catalog.total }),
          intro: t('intro'),
          updated: t('pdfUpdated', { date }),
          plansLine: t('plansLine', { base: catalog.basePrice, pro: catalog.proPrice }),
          indexTitle: t('indexTitle'),
          purposeLabel: t('purposeLabel'),
          pointsLabel: t('pointsLabel'),
          stepsLabel: t('stepsLabel'),
          planFree: t('planFree'),
          planBase: t('planBase'),
          planPro: t('planPro'),
          passFrom: (price) => t('passFrom', { price }),
          footer: t('pdfTitle'),
          site: 'kumani.io',
        },
        font,
        { cover, logo }
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `KUMANI-${t('pdfFileName')}-${locale}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (err) {
      console.error('[catalog] PDF non creato:', err)
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-sm disabled:opacity-60 ${
          variant === 'gold' ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] hover:brightness-105' : 'border border-[var(--gold)]/50 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]'
        }`}
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? t('generating') : t('downloadPdf')}
      </button>
      {error && <span className="text-xs font-semibold text-red-600">{t('pdfError')}</span>}
    </span>
  )
}

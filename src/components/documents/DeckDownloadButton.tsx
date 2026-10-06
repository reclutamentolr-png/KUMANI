'use client'

import { useState } from 'react'
import { Download, LoaderCircle, Presentation } from 'lucide-react'
import { getDeckTexts } from '@/app/actions/deck'
import type { DeckVariant } from '@/lib/deck/types'

const FILE: Record<string, string> = {
  it: 'KUMANI_Presentazione', en: 'KUMANI_Presentation', fr: 'KUMANI_Presentation', es: 'KUMANI_Presentacion',
  pt: 'KUMANI_Apresentacao', de: 'KUMANI_Praesentation', ru: 'KUMANI_Presentation',
}

// PowerPoint della presentazione creato al momento, nella lingua scelta, con
// i testi ufficiali aggiornati (Area Traduttori). Lite = presentazione breve,
// Full = in più tutti i servizi uno per uno.
// File: es. KUMANI_Presentazione_Lite_IT.pptx / KUMANI_Presentazione_Full_IT.pptx
export default function DeckDownloadButton({
  locale,
  variant = 'lite',
  label,
  busyLabel,
  errorLabel,
  main,
}: {
  locale: string
  variant?: DeckVariant
  label: string
  busyLabel: string
  errorLabel: string
  main: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const run = async () => {
    setBusy(true)
    setError(false)
    try {
      const res = await getDeckTexts(locale, variant)
      if (!res.texts) throw new Error(res.error ?? 'texts')
      const { buildDeck } = await import('@/lib/deck/buildDeck')
      const blob = await buildDeck(res.texts, locale, res.minPassEur ?? 10, res.landingPassEur ?? null, res.donationPercentBp ?? null, variant, res.catalog ?? [])
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${FILE[locale] ?? 'KUMANI_Presentation'}_${variant === 'full' ? 'Full' : 'Lite'}_${locale.toUpperCase()}.pptx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    } catch (e) {
      console.error('[presentazione]', e)
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={
          main
            ? 'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-extrabold text-[var(--ink)] shadow-sm transition hover:brightness-105 disabled:opacity-60'
            : 'inline-flex items-center gap-1 rounded-lg border border-[var(--gold)]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--gold)] disabled:opacity-60'
        }
      >
        {busy ? <LoaderCircle className={main ? 'h-4 w-4 animate-spin' : 'h-3.5 w-3.5 animate-spin'} /> : main ? <Download className="h-4 w-4" /> : <Presentation className="h-3.5 w-3.5 text-[var(--gold)]" />}
        {busy ? busyLabel : label}
      </button>
      {error && <span className="text-xs text-red-700">{errorLabel}</span>}
    </>
  )
}

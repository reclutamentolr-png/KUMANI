'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Minus, Plus } from 'lucide-react'

// Misura dello schermo per i test della vista: si appoggia una carta di
// credito (o bancomat, tessera sanitaria: formato standard 85,6 × 54 mm) in
// verticale sul rettangolo e lo si allarga finché coincide. Da qui si sa
// quanti pixel fanno un millimetro, così la "E" e la griglia hanno la
// grandezza giusta. Il valore resta salvato su questo dispositivo.
const CARD_W_MM = 53.98
const CARD_H_MM = 85.6
const STORAGE_KEY = 'aureya_px_per_mm'

export function savedPxPerMm(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return value > 1 && value < 20 ? value : null
  } catch {
    return null
  }
}

export default function ScreenCalibration({ onDone }: { onDone: (pxPerMm: number) => void }) {
  const t = useTranslations('aureya.calibration')
  // Prima stima: telefono circa 6 px/mm, computer circa 3,8
  const [pxPerMm, setPxPerMm] = useState(() => {
    const saved = savedPxPerMm()
    if (saved) return saved
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return 6
    return 3.8
  })

  const change = (delta: number) => setPxPerMm((v) => Math.min(12, Math.max(2, Math.round((v + delta) * 100) / 100)))

  const confirm = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(pxPerMm))
    } catch {
      // Memoria del browser non disponibile: si usa solo per questo test
    }
    onDone(pxPerMm)
  }

  return (
    <div className="p-6 sm:p-8">
      <h2 className="mb-2 flex items-center gap-2 font-bold text-[var(--ink)]">
        <CreditCard className="h-5 w-5 text-[var(--gold)]" /> {t('title')}
      </h2>
      <p className="mb-5 text-sm leading-6 text-[var(--muted)]">{t('body')}</p>

      <div className="flex justify-center">
        <div
          className="flex items-end justify-center rounded-[10px] border-2 border-dashed border-[var(--gold)] bg-[var(--gold-pale)]/60 pb-3"
          style={{ width: CARD_W_MM * pxPerMm, height: CARD_H_MM * pxPerMm }}
        >
          <span className="px-2 text-center text-[11px] font-semibold text-[var(--gold)]">{t('cardHere')}</span>
        </div>
      </div>

      <div className="mx-auto mt-5 flex max-w-sm items-center gap-3">
        <button type="button" onClick={() => change(-0.05)} aria-label={t('smaller')} className="rounded-full border border-[var(--gold)]/50 p-2 text-[var(--ink)] hover:bg-[var(--gold-pale)]">
          <Minus className="h-4 w-4" />
        </button>
        <label htmlFor="aureya-calibration" className="sr-only">{t('sizeLabel')}</label>
        <input
          id="aureya-calibration"
          type="range"
          min={2}
          max={12}
          step={0.01}
          value={pxPerMm}
          onChange={(event) => setPxPerMm(Number(event.target.value))}
          className="w-full accent-[var(--gold)]"
        />
        <button type="button" onClick={() => change(0.05)} aria-label={t('bigger')} className="rounded-full border border-[var(--gold)]/50 p-2 text-[var(--ink)] hover:bg-[var(--gold-pale)]">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={confirm}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
        >
          {t('confirm')}
        </button>
      </div>
    </div>
  )
}

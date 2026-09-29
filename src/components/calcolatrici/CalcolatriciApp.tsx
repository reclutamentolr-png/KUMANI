'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BadgePercent, Percent, Receipt, TrendingUp, type LucideIcon } from 'lucide-react'
import { completeCalcolatrici } from '@/app/actions/calcolatrici'
import { CalcUsageProvider } from './ui'
import VatCalculator from './VatCalculator'
import WithholdingCalculator from './WithholdingCalculator'
import DiscountCalculator from './DiscountCalculator'
import MarginCalculator from './MarginCalculator'

type Tab = 'vat' | 'withholding' | 'discount' | 'margin'

const TABS: { id: Tab; icon: LucideIcon; label: string }[] = [
  { id: 'vat', icon: Percent, label: 'tabVat' },
  { id: 'withholding', icon: Receipt, label: 'tabWithholding' },
  { id: 'discount', icon: BadgePercent, label: 'tabDiscount' },
  { id: 'margin', icon: TrendingUp, label: 'tabMargin' },
]

// Dopo quanto tempo un risultato "fermo" conta come uso dello strumento
const RESULT_DEBOUNCE_MS = 2500

export default function CalcolatriciApp() {
  const t = useTranslations('calcolatrici')
  const [tab, setTab] = useState<Tab>('vat')
  const awarded = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Punto KU giornaliero: una sola chiamata per caricamento della pagina,
  // al primo "Copia risultato" o dopo un risultato rimasto stabile.
  const award = useCallback(() => {
    if (awarded.current) return
    awarded.current = true
    if (timer.current) clearTimeout(timer.current)
    void completeCalcolatrici().catch(() => {})
  }, [])

  const reportResult = useCallback(() => {
    if (awarded.current) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(award, RESULT_DEBOUNCE_MS)
  }, [award])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const usage = useMemo(() => ({ reportResult, reportCopy: award }), [reportResult, award])

  return (
    <CalcUsageProvider value={usage}>
      <div role="tablist" aria-label={t('tabsLabel')} className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map(({ id, icon: Icon, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              id={`calc-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`calc-panel-${id}`}
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${
                active
                  ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)] shadow-md'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(label)}
            </button>
          )
        })}
      </div>

      {/* Tutte montate (nascoste) così i valori restano cambiando scheda */}
      {TABS.map(({ id }) => (
        <div key={id} id={`calc-panel-${id}`} role="tabpanel" aria-labelledby={`calc-tab-${id}`} hidden={tab !== id}>
          {id === 'vat' && <VatCalculator />}
          {id === 'withholding' && <WithholdingCalculator />}
          {id === 'discount' && <DiscountCalculator />}
          {id === 'margin' && <MarginCalculator />}
        </div>
      ))}
    </CalcUsageProvider>
  )
}

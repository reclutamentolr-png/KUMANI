'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Briefcase,
  Calculator,
  Check,
  HandPlatter,
  Info,
  QrCode,
  Signature,
  Ticket,
  UtensilsCrossed,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react'

type ProTool = { key: string; icon: LucideIcon; title: string; info: string }

// Servizi del piano Pro nel riquadro "Per professionisti e imprenditori"
// della homepage: ogni tessera ha la "i" cerchiata che apre la scheda con
// cosa fa il servizio e perché conviene (come la griglia dei servizi).
export default function ProToolsShowcase() {
  const t = useTranslations('landingHome')
  const tc = useTranslations('marketplace')
  const [active, setActive] = useState<ProTool | null>(null)

  const tools: ProTool[] = [
    { key: 'fidelity', icon: Ticket, title: 'Fidelity', info: t('proInfoFidelity') },
    { key: 'menu', icon: UtensilsCrossed, title: 'KUMANI Menu', info: t('proInfoMenu') },
    { key: 'preventivi', icon: Briefcase, title: t('proToolQuotes'), info: t('proInfoQuotes') },
    { key: 'digital-receipt', icon: Check, title: t('proToolReceipts'), info: t('proInfoReceipts') },
    { key: 'magazzino', icon: Warehouse, title: 'Magazzino PRO', info: t('proInfoMagazzino') },
    { key: 'kordata', icon: HandPlatter, title: 'Kordata Pro', info: t('proInfoKordata') },
    { key: 'qr-code-pro', icon: QrCode, title: t('toolQrProTitle'), info: t('proInfoQrPro') },
    { key: 'firma-email', icon: Signature, title: tc('firmaEmail'), info: t('proInfoFirmaEmail') },
    { key: 'calcolatrici', icon: Calculator, title: tc('calcolatrici'), info: t('proInfoCalcolatrici') },
  ]

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {tools.map((tool) => (
          <button
            key={tool.key}
            type="button"
            onClick={() => setActive(tool)}
            className="flex items-center gap-2 rounded-xl border border-[var(--gold)]/20 bg-white/[0.05] px-3 py-2.5 text-left text-sm font-semibold text-white transition-colors hover:border-[var(--gold)]/50 hover:bg-white/[0.08]"
          >
            <tool.icon className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" />
            <span className="min-w-0 flex-1 leading-tight">{tool.title}</span>
            <Info className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div
            className="relative w-full max-w-md rounded-2xl border border-[var(--gold)]/30 bg-[var(--ink-soft)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActive(null)}
              className="absolute right-4 top-4 text-white/60 transition-colors hover:text-white"
              aria-label={t('proInfoClose')}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)]">
              <active.icon className="h-7 w-7 text-[var(--ink)]" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold-bright)]">{t('proInfoBadge')}</p>
            <h3 className="mb-2 mt-1 pr-8 text-xl font-bold text-white">{active.title}</h3>
            <p className="text-sm leading-relaxed text-gray-300">{active.info}</p>
          </div>
        </div>
      )}
    </>
  )
}

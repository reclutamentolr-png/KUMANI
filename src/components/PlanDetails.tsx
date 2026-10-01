'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { ListChecks, Smartphone, Ticket, X } from 'lucide-react'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'

export type PlanDetailsTool = { toolName: string; title: string; description: string; iconName: string; categoryLabel: string; passPrice?: string }

// "Dettagli" su ogni piano della homepage: l'elenco completo dei servizi
// inclusi, con la descrizione di ciascuno, divisi per argomento.
export default function PlanDetails({
  planName,
  price,
  intro,
  tools,
  dark = false,
}: {
  planName: string
  price: string
  intro: string
  tools: PlanDetailsTool[]
  dark?: boolean
}) {
  const t = useTranslations('landingHome')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open])

  // Servizi raggruppati per argomento, nell'ordine in cui compaiono
  const groups = tools.reduce<{ label: string; items: PlanDetailsTool[] }[]>((acc, tool) => {
    const group = acc.find((item) => item.label === tool.categoryLabel)
    if (group) group.items.push(tool)
    else acc.push({ label: tool.categoryLabel, items: [tool] })
    return acc
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
          dark ? 'border border-[var(--gold)]/50 text-[var(--gold-bright)] hover:bg-white/10' : 'border border-white/25 text-white hover:bg-white/10'
        }`}
      >
        <ListChecks className="h-4 w-4" /> {t('planDetailsButton')}
      </button>

      {/* Disegnata nel body: non eredita i colori delle sezioni chiare della homepage */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('planDetailsTitle', { plan: planName })}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-[var(--paper)] text-[var(--ink)] shadow-2xl sm:rounded-3xl"
          >
            <div className="relative bg-[var(--ink)] px-6 pb-5 pt-6 text-white">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)]" />
              <button type="button" onClick={() => setOpen(false)} aria-label={t('planDetailsClose')} className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
              <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--gold-bright)]">{price}</p>
              <h3 className="mt-1 pr-8 text-2xl font-extrabold">{t('planDetailsTitle', { plan: planName })}</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">{intro}</p>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-[var(--gold)]">{group.label}</p>
                  <ul className="space-y-2">
                    {group.items.map((tool) => {
                      const Icon = marketplaceIconMap[tool.iconName] || Smartphone
                      return (
                        <li key={tool.toolName} className="flex gap-3 rounded-xl border border-[var(--gold)]/25 bg-white p-3.5">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ink)] text-[var(--gold-bright)]">
                            <Icon className="h-5 w-5" strokeWidth={1.7} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold">{tool.title}</p>
                            <p className="mt-0.5 text-sm leading-6 text-[var(--muted)]">{tool.description}</p>
                            {tool.passPrice && (
                              <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[var(--gold)] px-2 py-0.5 text-[11px] font-bold">
                                <Ticket className="h-3 w-3 text-[var(--gold)]" /> {t('planDetailsPass', { price: tool.passPrice })}
                              </p>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--gold)]/20 px-6 py-4 text-right">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--gold-bright)]">
                {t('planDetailsClose')}
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  )
}

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'

// Pulsante di download del biglietto: con il solo fronte scarica subito;
// con fronte e retro apre un menu per scegliere quale lato (o entrambi),
// così i file si possono avere separati.

export type SideChoice = 'front' | 'back' | 'both' | 'combined'

type Props = {
  hasBack: boolean
  // PDF: anche fronte e retro in un unico file di 2 pagine
  allowCombined?: boolean
  disabled: boolean
  className: string
  children: ReactNode
  onPick: (choice: SideChoice) => void
}

export default function SideDownloadButton({ hasBack, allowCombined = false, disabled, className, children, onPick }: Props) {
  const t = useTranslations('businessCard')
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const choices: SideChoice[] = allowCombined ? ['front', 'back', 'both', 'combined'] : ['front', 'back', 'both']
  const pick = (choice: SideChoice) => {
    setOpen(false)
    onPick(choice)
  }

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => (hasBack ? setOpen((v) => !v) : onPick('front'))}
        disabled={disabled}
        aria-haspopup={hasBack ? 'menu' : undefined}
        aria-expanded={hasBack ? open : undefined}
        className={className}
      >
        {children}
        {hasBack && <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--gold)]/40 bg-white py-1 shadow-xl">
          <p className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{t('chooseSide')}</p>
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              role="menuitem"
              onClick={() => pick(choice)}
              className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
            >
              {t(`side_${choice}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

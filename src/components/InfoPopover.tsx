'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Info, X } from 'lucide-react'

const WIDTH = 288

// Small clickable caption that reveals a short explanation on click —
// e.g. "How do points work?" next to a stat. Generic/reusable rather than
// one-off, since this pattern (a stat with a one-line rationale behind it)
// shows up in more than one place on the dashboard.
// La scheda è disegnata nel body (portal, position fixed): così non viene
// tagliata dalle card con overflow-hidden né coperta dalle card vicine.
export default function InfoPopover({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTranslations('common')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const toggle = () => {
    if (pos) {
      setPos(null)
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - WIDTH - 12))
    setPos({ top: rect.bottom + 8, left })
  }

  // Si chiude con clic fuori, Esc, scorrimento o ridimensionamento
  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [pos])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={!!pos}
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--gold)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--ink)]"
      >
        <Info className="h-3 w-3" />
        {label}
      </button>

      {pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
            className="fixed z-[200] rounded-xl border border-[var(--gold)]/30 bg-white p-4 text-xs leading-5 text-[var(--muted)] shadow-[0_18px_40px_rgba(23,23,23,0.18)]"
          >
            <button
              type="button"
              onClick={() => setPos(null)}
              aria-label={t('close')}
              className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="pr-4">{children}</div>
          </div>,
          document.body
        )}
    </>
  )
}

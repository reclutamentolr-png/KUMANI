'use client'

import { useEffect, useState } from 'react'
import { Info, X } from 'lucide-react'

// Cerchio con la «i» che apre una spiegazione breve: finestra dal basso sul
// telefono, al centro sul computer. Si chiude con la X, toccando fuori o con Esc.
export default function InfoDialog({
  label,
  title,
  close,
  children,
  className = '',
}: {
  // Testo per i lettori di schermo (es. «Come si usa?»)
  label: string
  title: string
  close: string
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={`relative inline-flex shrink-0 items-center justify-center rounded-full text-[var(--gold)] transition after:absolute after:-inset-2.5 after:content-[''] hover:text-[var(--ink)] ${className}`}
      >
        <Info className="h-[18px] w-[18px]" aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-left text-[var(--ink)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">{title}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={close} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed">{children}</div>
            <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-[var(--ink)] py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)]">
              {close}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

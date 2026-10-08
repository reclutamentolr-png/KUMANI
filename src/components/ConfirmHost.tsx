'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CircleHelp, TriangleAlert, Trash2 } from 'lucide-react'
import { registerConfirmHost, type ConfirmRequest } from '@/lib/confirm'

// Finestra di conferma di KUMANI (vedi lib/confirm): sfondo sfocato, icona,
// testo e due pulsanti. Esc annulla, Invio conferma; per le azioni
// distruttive il pulsante è rosso «Elimina» e il fuoco parte da «Annulla».
export default function ConfirmHost() {
  const t = useTranslations('common')
  const [queue, setQueue] = useState<ConfirmRequest[]>([])
  const current = queue[0]
  const cancelRef = useRef<HTMLButtonElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    registerConfirmHost((req) => setQueue((q) => [...q, req]))
    return () => registerConfirmHost(null)
  }, [])

  const close = (ok: boolean) => {
    if (!current) return
    current.resolve(ok)
    setQueue((q) => q.slice(1))
  }

  useEffect(() => {
    if (!current) return
    ;(current.tone === 'default' ? okRef : cancelRef).current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Una volta per richiesta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  if (!current) return null
  const danger = current.tone === 'danger'
  // Rosso sia per le cancellazioni sia per le altre azioni definitive
  const red = current.tone !== 'default'
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="kumani-confirm-title"
        aria-describedby="kumani-confirm-text"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-[kumaniPop_160ms_ease-out] overflow-hidden rounded-3xl border border-[var(--gold)]/30 bg-white text-[var(--ink)] shadow-2xl"
      >
        <div className={`h-1.5 ${red ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)]'}`} />
        <div className="px-6 pb-5 pt-6 text-center">
          <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${red ? 'bg-red-50 text-red-600' : 'bg-[var(--gold-pale)] text-[var(--gold)]'}`}>
            {danger ? <Trash2 className="h-7 w-7" /> : red ? <TriangleAlert className="h-7 w-7" /> : <CircleHelp className="h-7 w-7" />}
          </span>
          <h2 id="kumani-confirm-title" className="mt-4 text-lg font-bold">
            {current.title ?? t(danger ? 'confirmDeleteTitle' : 'confirmTitle')}
          </h2>
          <p id="kumani-confirm-text" className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">
            {current.message}
          </p>
        </div>
        <div className="flex gap-2 border-t border-gray-100 bg-[var(--paper)] px-5 py-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => close(false)}
            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t('confirmCancel')}
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={() => close(true)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm ${
              red ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] hover:brightness-105'
            }`}
          >
            {current.confirmLabel ?? t(danger ? 'confirmDelete' : 'confirmOk')}
          </button>
        </div>
      </div>
    </div>
  )
}

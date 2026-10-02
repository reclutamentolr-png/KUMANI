'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Sparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Tour al primo accesso: pochi passi che illuminano, uno alla volta, le parti
// principali della dashboard (elementi con data-tour="…"). Parte da solo la
// prima volta; "visto" resta nell'account (user_metadata.tour_seen), così non
// torna su altri dispositivi. Con ?tour=1 si rivede (link nel Centro guide).
const STEPS = [
  { key: 'welcome', target: null },
  { key: 'free', target: 'free' },
  { key: 'shortcuts', target: 'shortcuts' },
  { key: 'invite', target: 'invite' },
  { key: 'points', target: 'points' },
  { key: 'end', target: null },
] as const

const SEEN_KEY = 'kumani_tour_seen'
const GAP = 10

type Rect = { top: number; left: number; width: number; height: number }

export default function DashboardTour({ seen }: { seen: boolean }) {
  const t = useTranslations('tour')
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [cardHeight, setCardHeight] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  // Parte da solo se non è mai stato visto, oppure con ?tour=1
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get('tour') === '1'
    let seenHere = false
    try {
      seenHere = localStorage.getItem(SEEN_KEY) === '1'
    } catch {
      // Memoria del browser non disponibile
    }
    if (forced || (!seen && !seenHere)) {
      const timer = window.setTimeout(() => setOpen(true), 600)
      return () => window.clearTimeout(timer)
    }
  }, [seen])

  const step = STEPS[index]

  // Posizione dell'elemento illuminato (aggiornata con scroll e rotazione)
  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null)
      return
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [step.target])

  useEffect(() => {
    if (!open) return
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
    // Elemento alto (es. i servizi gratuiti): si mostra l'inizio, non il centro
    if (el) el.scrollIntoView({ block: el.offsetHeight > window.innerHeight * 0.5 ? 'start' : 'center', behavior: 'smooth' })
    const timer = window.setTimeout(measure, el ? 450 : 0)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [open, index, step.target, measure])

  useLayoutEffect(() => {
    if (open && cardRef.current) setCardHeight(cardRef.current.offsetHeight)
  }, [open, index, rect])

  useEffect(() => {
    if (open) nextRef.current?.focus()
  }, [open, index])

  const close = useCallback(() => {
    setOpen(false)
    setIndex(0)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      // Memoria del browser non disponibile
    }
    // Togli ?tour=1 dall'indirizzo, così ricaricando non riparte
    const url = new URL(window.location.href)
    if (url.searchParams.has('tour')) {
      url.searchParams.delete('tour')
      window.history.replaceState(null, '', url.toString())
    }
    if (!seen) {
      createClient()
        .auth.updateUser({ data: { tour_seen: true } })
        .catch(() => {})
    }
  }, [seen])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, STEPS.length - 1))
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || typeof document === 'undefined') return null

  const last = index === STEPS.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardWidth = Math.min(360, vw - 32)

  // Il fumetto sta sotto l'elemento se c'è posto, altrimenti sopra;
  // senza elemento (benvenuto e fine) sta al centro
  let cardStyle: React.CSSProperties
  if (rect) {
    const below = rect.top + rect.height + GAP + 12
    const above = rect.top - GAP - 12 - cardHeight
    // Sotto se c'è posto, altrimenti sopra; un elemento più alto dello
    // schermo resta visibile dall'inizio e il fumetto va in fondo
    const top = below + cardHeight < vh - 12 ? below : above >= 12 ? above : vh - cardHeight - 16
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardWidth / 2), vw - cardWidth - 16)
    cardStyle = { top, left, width: cardWidth }
  } else {
    cardStyle = { top: '50%', left: '50%', width: cardWidth, transform: 'translate(-50%, -50%)' }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Sfondo scuro con il "buco" sull'elemento illuminato */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-4 ring-[var(--gold-bright)] transition-all duration-300"
          style={{
            top: rect.top - GAP,
            left: rect.left - GAP,
            width: rect.width + GAP * 2,
            height: rect.height + GAP * 2,
            boxShadow: '0 0 0 9999px rgba(15, 14, 12, 0.72)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(15,14,12,0.72)]" />
      )}
      {/* Tocchi fuori dal fumetto: niente (si chiude solo con Salta o Fine) */}
      <div className="fixed inset-0" onClick={(event) => event.stopPropagation()} />

      <div
        ref={cardRef}
        className="fixed rounded-2xl border border-[var(--gold)]/50 bg-white p-5 text-[var(--ink)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
            {t('stepOf', { n: index + 1, total: STEPS.length })}
          </p>
          <button type="button" onClick={close} aria-label={t('skip')} className="-mr-1 -mt-1 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="tour-title" className="mt-1 flex items-center gap-2 text-lg font-extrabold">
          {(step.key === 'welcome' || step.key === 'end') && <Sparkles className="h-5 w-5 shrink-0 text-[var(--gold)]" />}
          {t(`${step.key}Title`)}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[var(--ink)]/80">{t(`${step.key}Text`)}</p>

        {/* Pallini di avanzamento */}
        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.key} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-[var(--gold)]' : 'w-1.5 bg-gray-200'}`} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {last ? (
            <span />
          ) : (
            <button type="button" onClick={close} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              {t('skip')}
            </button>
          )}
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="rounded-xl border border-gray-200 px-3.5 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-gray-50"
              >
                {t('back')}
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (last ? close() : setIndex(index + 1))}
              className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2 text-sm font-extrabold text-[var(--ink)] shadow-sm hover:brightness-105"
            >
              {last ? t('finish') : t('next')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

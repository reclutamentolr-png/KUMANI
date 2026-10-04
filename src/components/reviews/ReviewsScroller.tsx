'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Fila orizzontale di recensioni: si scorre con il dito, con le frecce o da
// sola ogni 7 secondi (ferma con mouse/dito sopra e con "riduci movimento").
export default function ReviewsScroller({ children, prevLabel, nextLabel }: { children: React.ReactNode; prevLabel: string; nextLabel: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  const step = (direction: 1 | -1) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-review-slide]')
    const width = (card?.offsetWidth ?? el.clientWidth) + 16
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8
    if (direction === 1 && atEnd) el.scrollTo({ left: 0, behavior: 'smooth' })
    else el.scrollBy({ left: direction * width, behavior: 'smooth' })
  }

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => step(1), 7000)
    return () => window.clearInterval(timer)
  }, [paused])

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div ref={track} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {children}
      </div>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={() => step(-1)} aria-label={prevLabel} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gold)]/40 text-[var(--gold-bright)] hover:bg-white/5">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => step(1)} aria-label={nextLabel} className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gold)]/40 text-[var(--gold-bright)] hover:bg-white/5">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

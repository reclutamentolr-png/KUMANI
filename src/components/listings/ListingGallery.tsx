'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Galleria del dettaglio annuncio: si scorre col dito (o con le frecce sul
// computer), con i pallini della foto corrente.
export default function ListingGallery({ images, alt }: { images: string[]; alt: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const go = (i: number) => {
    const el = track.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }
  if (!images.length) return null
  return (
    <div className="relative">
      <div
        ref={track}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-lg border border-gray-100 bg-gray-50 [scrollbar-width:none]"
      >
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={`${alt} ${i + 1}`} className="max-h-80 w-full shrink-0 snap-center object-contain" />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => go(Math.max(0, index - 1))} aria-label="‹" className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow sm:flex">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => go(Math.min(images.length - 1, index + 1))} aria-label="›" className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow sm:flex">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="mt-2 flex justify-center gap-1.5">
            {images.map((src, i) => (
              <button key={src} type="button" onClick={() => go(i)} aria-label={`${i + 1}`} className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-[var(--gold)]' : 'w-2 bg-gray-300'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

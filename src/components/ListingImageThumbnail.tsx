'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Community listing photos were fixed-crop and inert (no way to see the
// full image) — this adds a click-to-enlarge lightbox without changing the
// card's compact thumbnail layout.
// La foto ingrandita va direttamente nel body: la scheda si solleva al
// passaggio del mouse (transform) e un «fixed» al suo interno resterebbe
// legato alla scheda, saltando avanti e indietro (sfarfallio).
export default function ListingImageThumbnail({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)

  // Esc chiude; la pagina sotto non scorre mentre la foto è aperta
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="mb-3 h-40 cursor-zoom-in overflow-hidden rounded-lg bg-gray-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover transition-transform hover:scale-105" />
      </div>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Chiudi"
              className="absolute right-4 top-4 rounded-full bg-black/50 p-1 text-white transition-colors hover:text-gray-300"
            >
              <X className="h-8 w-8" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
          </div>,
          document.body
        )}
    </>
  )
}

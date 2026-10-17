'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'

// Video di YouTube nella homepage, leggero: finché non si preme play c'è solo
// la copertina (nessun lettore, nessun cookie); poi il lettore di
// youtube-nocookie.com parte da solo.
export default function HomeVideo({ id, title, playLabel }: { id: string; title: string; playLabel: string }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-[var(--gold)]/40 bg-black shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`${playLabel}: ${title}`} className="group absolute inset-0 h-full w-full">
          <Image src="/home/inno-kumani.webp" alt="" fill sizes="(max-width: 1024px) 100vw, 900px" className="object-cover" />
          <span className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/5" />
          <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] shadow-[0_0_45px_rgba(233,200,90,0.55)] transition-transform group-hover:scale-110 sm:h-24 sm:w-24">
            <Play className="ml-1 h-9 w-9 fill-[var(--ink)] text-[var(--ink)] sm:h-11 sm:w-11" />
          </span>
          {/* Bianco fisso: nelle sezioni chiare della Home i testi bianchi diventano scuri */}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold backdrop-blur" style={{ color: '#fff' }}>
            {playLabel}
          </span>
        </button>
      )}
    </div>
  )
}

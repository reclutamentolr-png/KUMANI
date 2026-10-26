'use client'

import { useEffect, useState } from 'react'

// Logo dentro un cerchio, sempre intero (mai tagliato): il cerchio prende il
// colore dello sfondo del logo, letto dagli angoli dell'immagine, così non
// resta un bordo di un altro colore (logo nero → cerchio nero, logo su bianco →
// cerchio bianco). Logo trasparente: nessuno sfondo.
export default function LogoCircle({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [bg, setBg] = useState<string | undefined>(undefined)

  useEffect(() => {
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 24
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return
        ctx.drawImage(img, 0, 0, size, size)
        // I quattro angoli: se sono quasi tutti trasparenti il logo non ha sfondo
        const corners = [ctx.getImageData(0, 0, 1, 1).data, ctx.getImageData(size - 1, 0, 1, 1).data, ctx.getImageData(0, size - 1, 1, 1).data, ctx.getImageData(size - 1, size - 1, 1, 1).data]
        const solid = corners.filter((c) => c[3] > 200)
        if (solid.length < 3) return
        const avg = (i: number) => Math.round(solid.reduce((sum, c) => sum + c[i], 0) / solid.length)
        if (alive) setBg(`rgb(${avg(0)}, ${avg(1)}, ${avg(2)})`)
      } catch {
        // Immagine non leggibile (altro sito): resta senza sfondo
      }
    }
    img.src = src
    return () => {
      alive = false
    }
  }, [src])

  return (
    <span className={`relative block overflow-hidden rounded-full ${className}`} style={bg ? { backgroundColor: bg } : undefined}>
      {/* Margine del 12%: anche un logo largo resta dentro il cerchio */}
      {/* eslint-disable-next-line @next/next/no-img-element -- logo della Scheda attività (storage pubblico) */}
      <img src={src} alt={alt} className="absolute left-[12%] top-[12%] h-[76%] w-[76%] object-contain" />
    </span>
  )
}

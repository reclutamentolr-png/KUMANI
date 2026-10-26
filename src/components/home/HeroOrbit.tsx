'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// Apertura «il logo e i servizi intorno»: sul computer sei schede girano
// piano in senso orario attorno al logo (un giro al minuto) e ogni pochi
// secondi una cambia con la scheda successiva dell'elenco (le categorie sono
// già alternate), così passano tutte prima di ricominciare. Si ferma col mouse sopra e con «riduci movimento». Sul
// telefono non c'è (vedi HomeLanding: logo e schede fisse).
export type OrbitItem = { title: string; text: string; scam?: boolean }

const SLOTS = 6
const RADIUS = 40 // % del riquadro

export default function HeroOrbit({ items, center }: { items: OrbitItem[]; center: ReactNode }) {
  const [shown, setShown] = useState<number[]>(() => items.slice(0, SLOTS).map((_, i) => i))
  const [fading, setFading] = useState<number | null>(null)
  // Prossima scheda da far entrare
  const nextItem = useRef(SLOTS)

  useEffect(() => {
    if (items.length <= SLOTS) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timeout: ReturnType<typeof setTimeout>
    const tick = setInterval(() => {
      const slot = Math.floor(Math.random() * SLOTS)
      setFading(slot)
      timeout = setTimeout(() => {
        setShown((current) => {
          let pick = nextItem.current % items.length
          while (current.includes(pick)) pick = (pick + 1) % items.length
          nextItem.current = pick + 1
          const next = [...current]
          next[slot] = pick
          return next
        })
        setFading(null)
      }, 450)
    }, 2600)
    return () => {
      clearInterval(tick)
      clearTimeout(timeout)
    }
  }, [items])

  return (
    <div className="group relative mx-auto aspect-square w-full max-w-[540px]">
      <div aria-hidden className="absolute inset-[10%] rounded-full border border-dashed border-[var(--gold)]/30" />
      <div aria-hidden className="absolute inset-[30%] rounded-full bg-[radial-gradient(circle,rgba(74,58,22,0.9)_0%,rgba(15,13,10,0)_70%)]" />
      <div className="absolute inset-[32%] flex items-center justify-center">{center}</div>
      {/* L'anello che gira; ogni scheda gira al contrario e resta dritta */}
      <ul className="home-orbit absolute inset-0 group-hover:[animation-play-state:paused]" aria-label="KUMANI">
        {shown.map((itemIndex, slot) => {
          const item = items[itemIndex]
          const angle = (slot / SLOTS) * 2 * Math.PI - Math.PI / 2
          return (
            <li
              key={slot}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${50 + RADIUS * Math.cos(angle)}%`, top: `${50 + RADIUS * Math.sin(angle)}%` }}
            >
              <div className="home-orbit-card group-hover:[animation-play-state:paused]">
                <div
                  className={`w-[180px] rounded-2xl px-3.5 py-2.5 text-left shadow-[0_18px_34px_-18px_rgba(0,0,0,0.9)] transition-opacity duration-500 ${fading === slot ? 'opacity-0' : 'opacity-100'} ${
                    item.scam ? 'border border-red-400/60 bg-[#2a0f0d] text-[#ffd9d4]' : 'border border-[var(--gold)]/30 bg-[#1f1a11] text-white'
                  }`}
                >
                  <p className={`text-sm font-extrabold ${item.scam ? 'text-[#ff8a7a]' : 'text-[var(--gold-bright)]'}`}>{item.title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug">{item.text}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

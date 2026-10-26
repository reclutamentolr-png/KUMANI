'use client'

import { createContext, useContext } from 'react'

// Bambino che sta giocando: nei giochi è un cerchio con l'iniziale accanto
// all'angolo in basso a sinistra del foglio (la barra in alto resta libera). Toccandolo si
// torna alla scelta del bambino.
export const KidChipContext = createContext<{ name: string; color: string; onClick: () => void } | null>(null)

export default function KidChip() {
  const kid = useContext(KidChipContext)
  if (!kid) return null
  return (
    <button
      type="button"
      onClick={kid.onClick}
      aria-label={kid.name}
      className="absolute bottom-0 right-full z-[5] mr-3 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#2B2D52] text-base font-extrabold text-white shadow-[2px_2px_0_#2B2D52]"
      style={{ background: kid.color }}
    >
      {kid.name.charAt(0).toUpperCase()}
    </button>
  )
}

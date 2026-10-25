'use client'

import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { adminExpiringCards } from '@/app/actions/adminCosts'
import { expiryLabel, type ExpiringCard } from '@/lib/cardExpiry'

// In cima all'Admin: compare dal mese prima della scadenza di una carta usata
// per pagare i costi fissi (Admin → Costi e margini), con i servizi in cui
// aggiornarla per non perdere gli abbonamenti.
export default function CardExpiryAlert({ onOpen }: { onOpen?: () => void }) {
  const [cards, setCards] = useState<ExpiringCard[]>([])

  useEffect(() => {
    adminExpiringCards()
      .then(setCards)
      .catch(() => {})
  }, [])

  if (!cards.length) return null
  return (
    <>
      {cards.map((c) => (
        <div key={`${c.card}-${c.expiry}`} className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 ${c.lastMonth ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`} role="alert">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold">
              {c.expired ? `Carta ${c.card} scaduta (${expiryLabel(c.expiry)})` : `Carta ${c.card} in scadenza: ${expiryLabel(c.expiry)}`}
            </p>
            <p>Aggiorna la carta in: {c.services.join(', ')}. Poi cambia la scadenza in Costi e margini e l’avviso sparisce.</p>
          </div>
          {onOpen && (
            <button type="button" onClick={onOpen} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:underline">
              Apri Costi e margini
            </button>
          )}
        </div>
      ))}
    </>
  )
}

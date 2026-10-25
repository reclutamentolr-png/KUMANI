'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, CreditCard } from 'lucide-react'
import { adminDeadlines } from '@/app/actions/adminCosts'
import { dayLabel, expiryLabel, type ExpiringCard, type Renewal } from '@/lib/cardExpiry'

// In cima all'Admin: compare dal mese prima della scadenza di una carta usata
// per pagare i costi fissi (Admin → Costi e margini), con i servizi in cui
// aggiornarla per non perdere gli abbonamenti, e dal mese prima di un rinnovo
// annuale (dominio…).
export default function CardExpiryAlert({ onOpen }: { onOpen?: () => void }) {
  const [cards, setCards] = useState<ExpiringCard[]>([])
  const [renewals, setRenewals] = useState<Renewal[]>([])

  useEffect(() => {
    adminDeadlines()
      .then((d) => {
        setCards(d.cards)
        setRenewals(d.renewals)
      })
      .catch(() => {})
  }, [])

  const open = onOpen && (
    <button type="button" onClick={onOpen} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:underline">
      Apri Costi e margini
    </button>
  )
  if (!cards.length && !renewals.length) return null
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
          {open}
        </div>
      ))}
      {renewals.map((r) => (
        <div key={`${r.name}-${r.date}`} className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900" role="alert">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold">Rinnovo il {dayLabel(r.date)}: {r.name}</p>
            <p>
              {r.provider ? `Su ${r.provider}. ` : ''}Controlla che il rinnovo automatico sia attivo e la carta valida. Se il prezzo cambia, aggiornalo in Costi e margini.
            </p>
          </div>
          {open}
        </div>
      ))}
    </>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Layers, LoaderCircle } from 'lucide-react'
import { adminScamMonthCards, adminSetScamMonthCard, type ScamMonthCard } from '@/app/actions/scamCards'
import { SCAM_CARDS } from '@/lib/scamCards/cards'
import { todayKey } from '@/lib/agenda'

// Admin → Community → Carte Antitruffa: la carta del mese. Chi la prende con
// le domande in quel mese ha la cornice arcobaleno; nell'album è in evidenza.
// Scegliere la truffa che sta girando di più (come il post social del mese).

const monthLabel = (month: string) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' })

function nextMonths(count: number): string[] {
  const [y, m] = todayKey().split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 15))
    return d.toISOString().slice(0, 7)
  })
}

export default function ScamCardsAdminPanel() {
  const [chosen, setChosen] = useState<Map<string, number> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminScamMonthCards().then((rows: ScamMonthCard[] | null) => setChosen(new Map((rows ?? []).map((r) => [r.month, r.cardNo]))))
  }, [])

  const save = async (month: string, value: string) => {
    setBusy(month)
    setError(null)
    const cardNo = value ? Number(value) : null
    const res = await adminSetScamMonthCard(month, cardNo)
    setBusy(null)
    if (!res.success) return setError(res.error ?? 'Salvataggio non riuscito')
    setChosen((prev) => {
      const next = new Map(prev)
      if (cardNo) next.set(month, cardNo)
      else next.delete(month)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Layers className="h-6 w-6 text-[var(--gold)]" /> Carte Antitruffa · Carta del mese
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Scegli la truffa che sta girando di più. Nell’album è in evidenza e chi la prende con le 3 domande in quel mese ha la cornice arcobaleno (anche chi l’aveva già in oro può rifare le domande).
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Le carte rare arrivano da sole: a chi segnala per primo un caso nuovo alla Rete Anti-Truffa, quando lo confermi.
        </p>
        {!chosen ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carico…
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-gray-100">
            {nextMonths(4).map((month, i) => (
              <li key={month} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-sm font-semibold capitalize text-gray-900">
                  {monthLabel(month)} {i === 0 && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold normal-case text-emerald-800">in corso</span>}
                </span>
                <span className="flex items-center gap-2">
                  {busy === month && <LoaderCircle className="h-4 w-4 animate-spin text-gray-400" />}
                  <select
                    value={chosen.get(month) ?? ''}
                    onChange={(e) => save(month, e.target.value)}
                    disabled={busy !== null}
                    className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm"
                    aria-label={`Carta di ${monthLabel(month)}`}
                  >
                    <option value="">— nessuna —</option>
                    {SCAM_CARDS.map((c) => (
                      <option key={c.no} value={c.no}>
                        {String(c.no).padStart(2, '0')} · {c.name}
                      </option>
                    ))}
                  </select>
                </span>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </div>
  )
}

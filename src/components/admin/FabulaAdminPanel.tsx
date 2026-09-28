'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, EyeOff, Plus, Trash2, X } from 'lucide-react'
import { adminAddFabulaWord, adminListFabula, adminRemoveFabulaWord, adminSetFabulaStatus } from '@/app/actions/admin'
import { diceEmoji } from '@/lib/fabula'

type Tab = 'pending' | 'hidden' | 'published' | 'words'
type Row = Record<string, unknown>

const when = (iso: unknown) =>
  typeof iso === 'string' ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(iso)) : ''
const person = (row: Row) => {
  const p = row.author as { first_name?: string | null; last_name?: string | null; email?: string | null } | null
  return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || '—' : '—'
}
const REASON: Record<string, string> = { offensive: 'Offensiva', spam: 'Spam', other: 'Altro' }

// Admin → Fabula: storie in attesa (nuovi iscritti o parole filtrate),
// nascoste dopo le segnalazioni, pubblicate, e l'elenco delle parole filtrate.
export default function FabulaAdminPanel() {
  const [tab, setTab] = useState<Tab>('pending')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [word, setWord] = useState('')

  const load = useCallback(async (current: Tab) => {
    setRows(null)
    const result = await adminListFabula(current)
    setRows(result.rows)
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento dal server a ogni cambio di scheda (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  const act = async (action: () => Promise<{ success: boolean; error?: string | null }>) => {
    const result = await action()
    if (!result.success) {
      alert('Errore: ' + (result.error ?? ''))
      return false
    }
    await load(tab)
    return true
  }

  const tabs: [Tab, string][] = [
    ['pending', 'In attesa'],
    ['hidden', 'Nascoste dalle segnalazioni'],
    ['published', 'Pubblicate'],
    ['words', 'Parole filtrate'],
  ]
  const button = 'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Kumani Fabula</h2>
        <p className="mt-1 max-w-3xl text-gray-600">
          Chi ha i giorni di accesso minimi pubblica subito nella galleria. Arrivano qui in attesa le storie dei nuovi iscritti e quelle con una
          parola filtrata; dopo le segnalazioni previste (Impostazioni) una storia si nasconde da sola. Pubblica, rendi privata o rimuovi.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? 'bg-[var(--ink)] text-white' : 'border border-gray-300 text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {tab === 'words' ? (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Basta l&apos;inizio della parola (es. &quot;stronz&quot; copre stronzo, stronzata…). Una storia che le contiene non viene rifiutata: va in attesa
            del tuo controllo.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!word.trim()) return
              act(() => adminAddFabulaWord(word)).then((ok) => ok && setWord(''))
            }}
            className="flex gap-2"
          >
            <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={40} placeholder="Nuova parola" className="w-full max-w-xs rounded-lg border border-gray-300 p-2 text-sm" />
            <button type="submit" className={`${button} bg-[var(--ink)] text-white`}>
              <Plus className="h-3.5 w-3.5" /> Aggiungi
            </button>
          </form>
          {rows === null ? (
            <p className="text-sm text-gray-400">Caricamento…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {rows.map((row) => (
                <span key={String(row.word)} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
                  {String(row.word)}
                  <button type="button" onClick={() => act(() => adminRemoveFabulaWord(String(row.word)))} aria-label="Rimuovi" className="text-gray-400 hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : rows === null ? (
        <p className="text-sm text-gray-400">Caricamento…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">Niente da controllare.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const reports = (row.reports as { id: string; reason: string; status: string }[] | null) ?? []
            const open = reports.filter((r) => r.status === 'open')
            return (
              <div key={String(row.id)} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg">
                      {diceEmoji((row.dice as number[]) ?? [])}{' '}
                      <span className="ml-1 rounded-full bg-[var(--ink)] px-2 py-0.5 align-middle text-[10px] font-bold text-[var(--gold-bright)]">
                        {String(row.locale).toUpperCase()}
                      </span>
                    </p>
                    {row.title ? <p className="mt-1 font-semibold text-gray-900">{String(row.title)}</p> : null}
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{String(row.body)}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {person(row)} · {row.roll_date ? `lancio del ${String(row.roll_date)}` : 'lancio libero'} · {when(row.created_at)}
                    </p>
                    {open.length > 0 && (
                      <p className="mt-1 text-xs font-semibold text-red-700">
                        {open.length} segnalazioni: {open.map((r) => REASON[r.reason] ?? r.reason).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tab !== 'published' && (
                      <button type="button" onClick={() => act(() => adminSetFabulaStatus(String(row.id), 'published'))} className={`${button} bg-emerald-600 text-white`}>
                        <Check className="h-3.5 w-3.5" /> Pubblica
                      </button>
                    )}
                    <button type="button" onClick={() => act(() => adminSetFabulaStatus(String(row.id), 'private'))} className={`${button} border border-gray-300 text-gray-700`}>
                      <EyeOff className="h-3.5 w-3.5" /> Rendi privata
                    </button>
                    <button
                      type="button"
                      onClick={() => confirm('Rimuovere la storia? L’autore non la vedrà più.') && act(() => adminSetFabulaStatus(String(row.id), 'removed'))}
                      className={`${button} border border-red-200 text-red-600`}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

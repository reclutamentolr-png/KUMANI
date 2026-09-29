'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { adminSearchUsers, type StaffUserHit } from '@/app/actions/admin'

// Scelta di un utente nel pannello Staff: si scrive nome, cognome, codice o
// email e si sceglie dai risultati (ricerca sul server, niente elenchi fissi
// che con molti utenti diventano inutilizzabili).
export default function AdminUserPicker({
  scope,
  selected,
  onSelect,
  placeholder = 'Cerca per nome, cognome, codice o email…',
}: {
  scope: 'matrix' | 'coupons'
  selected: StaffUserHit | null
  onSelect: (user: StaffUserHit | null) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StaffUserHit[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const requestId = useRef(0)

  // Ricerca con una piccola attesa mentre si scrive
  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) {
      queueMicrotask(() => setResults([]))
      return
    }
    const id = ++requestId.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const { users } = await adminSearchUsers(text, scope)
      if (id === requestId.current) {
        setResults(users)
        setLoading(false)
        setOpen(true)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query, scope])

  const name = (user: StaffUserHit) => `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || '—'

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--gold)]/50 bg-[var(--gold-pale)] px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{name(selected)}</p>
          <p className="truncate text-xs text-gray-600">
            <span className="font-mono">{selected.referral_code}</span>
            {selected.email ? ` · ${selected.email}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null)
            setQuery('')
            setResults([])
          }}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <X className="h-3.5 w-3.5" /> Cambia
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 p-3 pl-9 pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
      {open && query.trim().length >= 2 && !loading && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-gray-500">Nessun utente trovato</li>
          ) : (
            results.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(user)
                    setOpen(false)
                  }}
                  className="w-full px-3 py-2.5 text-left hover:bg-[var(--gold-pale)]"
                >
                  <span className="block truncate text-sm font-semibold text-gray-900">{name(user)}</span>
                  <span className="block truncate text-xs text-gray-500">
                    <span className="font-mono">{user.referral_code}</span>
                    {user.email ? ` · ${user.email}` : ''}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="mt-1 text-xs text-gray-400">Scrivi almeno 2 caratteri</p>
      )}
    </div>
  )
}

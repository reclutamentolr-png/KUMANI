'use client'

import { useEffect, useState } from 'react'
import { Monitor, Radio, Smartphone } from 'lucide-react'
import { adminLivePresence, type LivePresence } from '@/app/actions/adminReports'

// Admin → Uso reale → «In questo momento»: persone sul sito adesso (schede
// aperte e in primo piano negli ultimi 2 minuti) e in quale pagina. Si
// aggiorna da solo ogni 30 secondi. Staff escluso.
const EVERY_MS = 30_000

export default function LivePresenceBox() {
  const [data, setData] = useState<LivePresence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const load = () => {
      if (document.visibilityState !== 'visible') return
      adminLivePresence().then((result) => {
        if (cancelled) return
        if ('error' in result) setError(result.error)
        else {
          setError(null)
          setData(result)
          setUpdated(new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()))
        }
      })
    }
    load()
    const timer = setInterval(load, EVERY_MS)
    document.addEventListener('visibilitychange', load)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', load)
    }
  }, [])

  const maxPage = Math.max(1, ...(data?.pages ?? []).map((p) => p.total))

  return (
    <section className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--ink)] p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Radio className="h-5 w-5 text-[var(--gold-bright)]" aria-hidden />
          In questo momento
          <span className="relative ml-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
        </h3>
        <p className="text-xs text-white/60">{updated ? `Aggiornato alle ${updated} · ogni 30 secondi` : 'Caricamento…'}</p>
      </div>
      <p className="mt-0.5 text-sm text-white/60">Persone con KUMANI aperto adesso (pagina in primo piano negli ultimi 2 minuti). Staff escluso.</p>

      {error ? (
        <p className="mt-3 rounded-xl bg-red-500/15 p-3 text-sm font-semibold text-red-200">{error}</p>
      ) : (
        data && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-4xl font-extrabold text-[var(--gold-bright)]">{data.total}</p>
                <p className="text-xs text-white/60">sul sito ora</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data.visitors} <span className="text-sm font-normal text-white/60">visitatori</span>
                </p>
                <p className="text-2xl font-bold">
                  {data.members} <span className="text-sm font-normal text-white/60">soci</span>
                </p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-white/60" aria-hidden /> {data.mobile} da telefono
                </p>
                <p className="flex items-center gap-1.5">
                  <Monitor className="h-4 w-4 text-white/60" aria-hidden /> {data.desktop} da computer
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data.last_hour}</p>
                <p className="text-xs text-white/60">schede aperte nell&apos;ultima ora</p>
              </div>
            </div>

            {data.pages.length > 0 ? (
              <ul className="mt-5 space-y-2">
                {data.pages.map((p) => (
                  <li key={p.page}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-semibold" title={p.page}>
                        {p.label}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <b>{p.total}</b>
                        {p.members > 0 && <span className="text-white/60"> · {p.members} soci</span>}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-[var(--gold)]" style={{ width: `${(p.total / maxPage) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-white/60">Nessuno sul sito in questo momento.</p>
            )}
          </>
        )
      )}
    </section>
  )
}

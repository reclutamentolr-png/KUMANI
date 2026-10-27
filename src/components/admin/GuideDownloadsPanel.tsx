'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpenCheck, Download, LoaderCircle, Printer, RefreshCw } from 'lucide-react'
import { adminGuideDownloads, type GuideDownloadStats } from '@/app/actions/guideDownloads'

// Admin → Manuale Antitruffa: quante volte è stato scaricato in PDF o aperto
// per la stampa, in quali lingue, negli ultimi 30 giorni e gli ultimi download.

const LANG: Record<string, string> = { it: 'Italiano', en: 'Inglese', fr: 'Francese', es: 'Spagnolo', pt: 'Portoghese', de: 'Tedesco', ru: 'Russo' }
const when = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

export default function GuideDownloadsPanel() {
  const [data, setData] = useState<GuideDownloadStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setData(await adminGuideDownloads())
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- primo caricamento dei dati
    void load()
  }, [load])

  const max = Math.max(1, ...(data?.byDay.map((d) => d.n) ?? [1]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <BookOpenCheck className="h-6 w-6 text-[var(--gold)]" /> Manuale Antitruffa
          </h2>
          <p className="text-sm text-[var(--muted)]">Quante volte i Kumani hanno scaricato o stampato il manuale.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Aggiorna
        </button>
      </div>

      {data?.error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{data.error}</p> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Totale" value={data.total} strong />
            <Stat label="Persone diverse" value={data.people} />
            <Stat label="Scaricati in PDF" value={data.pdf} icon={<Download className="h-4 w-4" />} />
            <Stat label="Aperti per la stampa" value={data.print} icon={<Printer className="h-4 w-4" />} />
            <Stat label="Oggi" value={data.today} />
            <Stat label="Ultimi 7 giorni" value={data.last7} />
            <Stat label="Ultimi 30 giorni" value={data.last30} />
            <Stat label="Lingue" value={data.byLocale.length} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-[var(--ink)]">Ultimi 30 giorni</h3>
            <div className="flex h-36 items-end gap-[3px]">
              {data.byDay.map((d) => (
                <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${shortDay(d.day)}: ${d.n}`}>
                  <div className="rounded-t bg-[var(--gold)]" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 3 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-gray-500">
              <span>{data.byDay[0] ? shortDay(data.byDay[0].day) : ''}</span>
              <span>oggi</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-[var(--ink)]">Per lingua</h3>
              {data.byLocale.length ? (
                <ul className="space-y-2">
                  {data.byLocale.map((l) => (
                    <li key={l.locale} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 text-gray-700">{LANG[l.locale] ?? l.locale}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <span className="block h-full rounded-full bg-[var(--gold)]" style={{ width: `${(l.n / Math.max(1, data.total)) * 100}%` }} />
                      </span>
                      <span className="w-10 text-right font-semibold">{l.n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Ancora nessun download.</p>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-[var(--ink)]">Ultimi download</h3>
              {data.recent.length ? (
                <ul className="divide-y divide-gray-100 text-sm">
                  {data.recent.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 py-1.5">
                      {r.mode === 'pdf' ? <Download className="h-4 w-4 shrink-0 text-[var(--gold)]" /> : <Printer className="h-4 w-4 shrink-0 text-gray-500" />}
                      <span className="min-w-0 flex-1 truncate">{r.name ?? 'Kumano'}</span>
                      <span className="text-xs uppercase text-gray-500">{r.locale}</span>
                      <span className="w-24 text-right text-xs text-gray-500">{when(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Ancora nessun download.</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[var(--gold)]" />
      )}
    </div>
  )
}

function Stat({ label, value, strong, icon }: { label: string; value: number; strong?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl p-4 ${strong ? 'bg-[var(--ink)] text-white' : 'border border-gray-200 bg-white'}`}>
      <p className={`flex items-center gap-1.5 text-xs ${strong ? 'text-[var(--gold-bright)]' : 'text-gray-500'}`}>
        {icon} {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{value.toLocaleString('it-IT')}</p>
    </div>
  )
}

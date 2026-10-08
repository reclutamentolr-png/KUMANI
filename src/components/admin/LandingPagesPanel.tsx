'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Flag, LoaderCircle, PanelsTopLeft, Search } from 'lucide-react'
import { closeLandingReport, listLandingPagesAdmin, setLandingSuspended } from '@/app/actions/admin'
import { askConfirm } from '@/lib/confirm'

type Owner = { first_name: string | null; last_name: string | null; email: string | null }
type PageRow = { owner_id: string; slug: string; is_published: boolean; suspended: boolean; suspended_reason: string | null; updated_at: string; owner: Owner | null }
type Report = { id: string; reason: string; details: string | null; created_at: string; page: { owner_id: string; slug: string; suspended: boolean } | null }

const REASONS: Record<string, string> = {
  scam: 'Truffa o pagina ingannevole',
  fake_reviews: 'Testimonianze false',
  offensive: 'Contenuti offensivi o illegali',
  copyright: 'Foto o testi usati senza permesso',
  other: 'Altro',
}

// Admin → Landing Page: segnalazioni dei visitatori e sospensione delle
// pagine. Una pagina sospesa sparisce subito da kumani.io/p/… e da Google.
export default function LandingPagesPanel() {
  const [pages, setPages] = useState<PageRow[] | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [working, setWorking] = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    const result = await listLandingPagesAdmin(q)
    setPages(result.pages as unknown as PageRow[])
    setReports(result.reports as unknown as Report[])
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono, come gli altri pannelli)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load('')
  }, [load])

  const suspend = async (ownerId: string, slug: string, on: boolean) => {
    let reason = ''
    if (on) {
      const answer = prompt(`Sospendere kumani.io/p/${slug}? Scrivi il motivo (lo vede il titolare):`)
      if (answer === null) return
      reason = answer
    } else if (!(await askConfirm(`Riattivare kumani.io/p/${slug}?`))) return
    setWorking(ownerId)
    const result = await setLandingSuspended(ownerId, on, reason)
    setWorking(null)
    if (!result.success) notify('Errore: ' + result.error)
    await load(search)
  }

  const close = async (id: string) => {
    setWorking(id)
    const result = await closeLandingReport(id)
    setWorking(null)
    if (!result.success) notify('Errore: ' + result.error)
    await load(search)
  }

  const pageLink = (slug: string) => (
    <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-sm text-blue-700 hover:underline">
      /p/{slug} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <PanelsTopLeft className="h-6 w-6" /> Landing Page
        </h2>
        <p className="mt-1 text-gray-600">Pagine vetrina degli utenti Pro: segnalazioni dei visitatori e sospensione.</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
          <Flag className="h-5 w-5 text-red-600" /> Segnalazioni aperte ({reports.length})
        </h3>
        {reports.length === 0 ? (
          <p className="text-sm text-gray-500">Nessuna segnalazione da controllare.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{REASONS[r.reason] ?? r.reason}</p>
                  {r.details && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{r.details}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    {r.page && pageLink(r.page.slug)} · {new Date(r.created_at).toLocaleString('it-IT')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={working === r.id} onClick={() => close(r.id)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700">
                    Chiudi
                  </button>
                  {r.page && !r.page.suspended && (
                    <button
                      type="button"
                      disabled={working === r.page.owner_id}
                      onClick={() => suspend(r.page!.owner_id, r.page!.slug, true)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      Sospendi pagina
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-gray-900">Tutte le pagine</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              load(search)
            }}
            className="flex items-center gap-2"
          >
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca indirizzo" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
            <button type="submit" className="rounded-lg bg-gray-900 p-2 text-white" aria-label="Cerca">
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>
        {pages === null ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" />
        ) : pages.length === 0 ? (
          <p className="text-sm text-gray-500">Nessuna pagina.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Indirizzo</th>
                  <th className="py-2 pr-3">Titolare</th>
                  <th className="py-2 pr-3">Stato</th>
                  <th className="py-2 pr-3">Modificata</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pages.map((p) => (
                  <tr key={p.owner_id}>
                    <td className="py-2 pr-3">{pageLink(p.slug)}</td>
                    <td className="py-2 pr-3">
                      {[p.owner?.first_name, p.owner?.last_name].filter(Boolean).join(' ')}
                      <span className="block text-xs text-gray-500">{p.owner?.email}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {p.suspended ? (
                        <span className="text-red-700" title={p.suspended_reason ?? ''}>
                          Sospesa
                        </span>
                      ) : p.is_published ? (
                        <span className="text-emerald-700">Pubblicata</span>
                      ) : (
                        <span className="text-gray-500">Bozza</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-500">{new Date(p.updated_at).toLocaleDateString('it-IT')}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        disabled={working === p.owner_id}
                        onClick={() => suspend(p.owner_id, p.slug, !p.suspended)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${p.suspended ? 'border border-gray-300 text-gray-700' : 'bg-red-50 text-red-700'}`}
                      >
                        {p.suspended ? 'Riattiva' : 'Sospendi'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Flag, LoaderCircle } from 'lucide-react'
import { listConvivioReports, resolveConvivioReport } from '@/app/actions/admin'

type Person = { first_name: string | null; last_name: string | null; email: string | null }
type Report = {
  id: string
  reason: string
  status: 'open' | 'closed'
  created_at: string
  group: { id: string; title: string; status: string; supplier_name: string; leader: Person | null } | null
  reporter: Person | null
}

// Admin → Convivio: segnalazioni sulle cordate. Lo Staff chiude la
// segnalazione o annulla anche la cordata (i partecipanti lo vedono subito).
export default function ConvivioReportsPanel({ locale }: { locale: string }) {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await listConvivioReports()
    setReports(result.reports as unknown as Report[])
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono, come KuManagementPanel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const resolve = async (report: Report, cancel: boolean) => {
    if (cancel && !confirm(`Annullare la cordata "${report.group?.title ?? ''}"?`)) return
    setWorking(report.id)
    const result = await resolveConvivioReport(report.id, cancel)
    setWorking(null)
    if (!result.success) alert('Errore: ' + result.error)
    await load()
  }

  const name = (p: Person | null) => (p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || '—' : '—')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Kordata — segnalazioni</h2>
        <p className="mt-1 text-gray-600">
          Segnalazioni degli utenti sulle cordate (acquisti di gruppo). In Fase 1 KUMANI non gestisce pagamenti: i partecipanti pagano
          direttamente il fornitore. Puoi chiudere la segnalazione o annullare la cordata.
        </p>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {reports === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nessuna segnalazione.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className={`rounded-xl border bg-white p-4 shadow-sm ${report.status === 'open' ? 'border-red-200' : 'border-gray-200 opacity-70'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                    <Flag className="h-4 w-4 text-red-500" /> {report.group?.title ?? '—'}
                    {report.group && (
                      <a href={`/${locale}/convivio/${report.group.id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Capocordata {name(report.group?.leader ?? null)} · fornitore {report.group?.supplier_name} · stato {report.group?.status}
                  </p>
                  <p className="text-xs text-gray-500">
                    Segnalata da {name(report.reporter)} · {new Date(report.created_at).toLocaleString('it-IT')}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${report.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                  {report.status === 'open' ? 'Da gestire' : 'Chiusa'}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">{report.reason}</p>
              {report.status === 'open' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={working === report.id} onClick={() => resolve(report, false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    Chiudi segnalazione
                  </button>
                  <button type="button" disabled={working === report.id} onClick={() => resolve(report, true)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                    Chiudi e annulla la cordata
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

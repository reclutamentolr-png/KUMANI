'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useState } from 'react'
import { Flag, LoaderCircle } from 'lucide-react'
import { listAffinityReports, resolveAffinityReport } from '@/app/actions/admin'
import { askConfirm } from '@/lib/confirm'

type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null; is_blocked?: boolean }
type Report = { id: string; reason: string; status: 'open' | 'closed'; created_at: string; reporter: Person | null; reported: Person | null }

// Admin → Affinity: segnalazioni fatte dagli utenti di Affinity Amicizie.
// Chi segnala ha già bloccato la persona; qui lo Staff chiude la
// segnalazione o blocca anche l'account su tutta la piattaforma.
export default function AffinityReportsPanel() {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await listAffinityReports()
    setReports(result.reports as unknown as Report[])
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono, come KuManagementPanel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const resolve = async (report: Report, block: boolean) => {
    const who = `${report.reported?.first_name ?? ''} ${report.reported?.last_name ?? ''}`.trim()
    if (block && !(await askConfirm(`Bloccare l'account di ${who} su tutta la piattaforma?`))) return
    setWorking(report.id)
    const result = await resolveAffinityReport(report.id, block)
    setWorking(null)
    if (!result.success) notify('Errore: ' + result.error)
    await load()
  }

  const name = (p: Person | null) => (p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || '—' : '—')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Affinity — segnalazioni</h2>
        <p className="mt-1 text-gray-600">
          Segnalazioni da Affinity Amicizie. Chi segnala ha già bloccato automaticamente la persona segnalata. Qui puoi chiudere la
          segnalazione oppure bloccare l&apos;account segnalato su tutta la piattaforma. Il numero di presentazioni settimanali si
          imposta in Impostazioni.
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
            <div
              key={report.id}
              className={`rounded-xl border bg-white p-4 shadow-sm ${report.status === 'open' ? 'border-red-200' : 'border-gray-200 opacity-70'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                    <Flag className="h-4 w-4 text-red-500" /> {name(report.reported)}
                    {report.reported?.is_blocked && <span className="rounded bg-red-100 px-1.5 text-[10px] font-bold text-red-700">BLOCCATO</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    segnalato da {name(report.reporter)} · {new Date(report.created_at).toLocaleString('it-IT')}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${report.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                  {report.status === 'open' ? 'Da gestire' : 'Chiusa'}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">{report.reason}</p>
              {report.status === 'open' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={working === report.id}
                    onClick={() => resolve(report, false)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Chiudi segnalazione
                  </button>
                  <button
                    type="button"
                    disabled={working === report.id}
                    onClick={() => resolve(report, true)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Chiudi e blocca l&apos;account
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

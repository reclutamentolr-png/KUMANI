'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Cloud, CreditCard, Database, ExternalLink, LoaderCircle, Mail, RefreshCw, Server, XCircle } from 'lucide-react'
import { adminPlatformReports } from '@/app/actions/adminPlatforms'
import type { PlatformReport, PlatformStatus } from '@/lib/platforms'

// Admin → Piattaforme collegate: una scheda per servizio esterno con stato,
// consumi rispetto ai limiti del piano e collegamento al suo pannello.

const ICONS: Record<PlatformReport['id'], typeof Database> = {
  supabase: Database,
  vercel: Server,
  resend: Mail,
  cloudflare: Cloud,
  stripe: CreditCard,
}

const STATUS: Record<PlatformStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: 'Tutto a posto', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  warning: { label: 'Da controllare', className: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle },
  error: { label: 'Problema', className: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
  not_configured: { label: 'Da collegare', className: 'bg-gray-100 text-gray-600 border-gray-200', Icon: CircleDashed },
}

const barColor = (p: number) => (p >= 90 ? 'bg-red-500' : p >= 75 ? 'bg-amber-500' : 'bg-emerald-500')

export default function PlatformsPanel() {
  const [reports, setReports] = useState<PlatformReport[] | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const apply = useCallback((result: Awaited<ReturnType<typeof adminPlatformReports>>) => {
    setLoading(false)
    if (!result.success || !result.reports) {
      setError(result.error ?? 'Errore sconosciuto')
      return
    }
    setError(null)
    setReports(result.reports)
    setCheckedAt(result.checkedAt ?? null)
  }, [])

  const load = () => {
    setLoading(true)
    adminPlatformReports().then(apply)
  }

  useEffect(() => {
    adminPlatformReports().then(apply)
  }, [apply])

  const counts = (reports ?? []).reduce<Record<PlatformStatus, number>>(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { ok: 0, warning: 0, error: 0, not_configured: 0 },
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Piattaforme collegate</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Stato e consumi dei servizi su cui gira KUMANI, letti in tempo reale dalle loro API. Le barre diventano gialle al 75% del limite e rosse al 90%.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Aggiorna
        </button>
      </div>

      {reports && (
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {(Object.keys(STATUS) as PlatformStatus[])
            .filter((s) => counts[s] > 0)
            .map((s) => (
              <span key={s} className={`rounded-full border px-3 py-1 ${STATUS[s].className}`}>
                {STATUS[s].label}: {counts[s]}
              </span>
            ))}
          {checkedAt && <span className="px-1 py-1 font-normal text-gray-500">Controllato alle {new Date(checkedAt).toLocaleTimeString('it-IT')}</span>}
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Errore: {error}</div>}

      {!reports && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Controllo delle piattaforme in corso…
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(reports ?? []).map((r) => {
          const Icon = ICONS[r.id]
          const st = STATUS[r.status]
          return (
            <section key={r.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{r.name}</h3>
                    <p className="text-xs text-gray-500">
                      {r.summary}
                      {typeof r.latencyMs === 'number' && r.id !== 'supabase' ? ` · ${r.latencyMs} ms` : ''}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${st.className}`}>
                  <st.Icon className="h-3.5 w-3.5" /> {st.label}
                </span>
              </div>

              {r.items.length > 0 && (
                <dl className="mt-4 space-y-3">
                  {r.items.map((item, i) => (
                    <div key={i}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                        <dt className="text-gray-500">{item.label}</dt>
                        <dd className="break-words text-right font-medium text-gray-900">{item.value}</dd>
                      </div>
                      {typeof item.percent === 'number' && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${barColor(item.percent)}`} style={{ width: `${Math.max(item.percent, 1)}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs tabular-nums text-gray-500">{item.percent}%</span>
                        </div>
                      )}
                      {item.hint && <p className="mt-0.5 break-words text-xs text-gray-400">{item.hint}</p>}
                    </div>
                  ))}
                </dl>
              )}

              {r.missing && r.missing.length > 0 && (
                <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
                  <p className="font-semibold text-gray-700">Per collegarla aggiungi in Vercel (e in .env.local):</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 font-mono">
                    {r.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {r.notes && r.notes.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-gray-500">
                  {r.notes.map((n, i) => (
                    <li key={i}>• {n}</li>
                  ))}
                </ul>
              )}

              <a
                href={r.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-1.5 self-start pt-4 text-sm font-semibold text-gray-900 hover:underline"
              >
                Apri pannello {r.name} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </section>
          )
        })}
      </div>
    </div>
  )
}

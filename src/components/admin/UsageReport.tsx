'use client'

import { useEffect, useState } from 'react'
import { HardDrive, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { adminUsageReport, type LimitsTopRow, type UsageTopRow } from '@/app/actions/admin'

const BUCKET_LABEL: Record<string, string> = {
  'cv-photos': 'CV',
  'findo-photos': 'Findo',
  'landing-photos': 'Landing',
  'quote-logos-v2': 'Preventivi',
  'receipt-photos-v2': 'Ricevute',
  'menu-photos': 'Menu',
  'casa-files': 'Casa',
  'garage-files': 'Garage',
  'identity-docs': 'Identità',
  'convivio-photos': 'Kordata',
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

const who = (r: { name: string | null; email: string | null; user_id: string }) => (
  <span className="min-w-0">
    <span className="block truncate font-semibold text-gray-900">{r.name || r.email || r.user_id.slice(0, 8)}</span>
    {r.name && r.email && <span className="block truncate text-xs text-gray-500">{r.email}</span>}
  </span>
)

// I 10 utenti che occupano più spazio (file + dati) e i 10 più vicini a un
// limite: per capire se alzare i limiti o intervenire.
export default function UsageReport() {
  const [usage, setUsage] = useState<UsageTopRow[]>([])
  const [limits, setLimits] = useState<LimitsTopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apply = (r: Awaited<ReturnType<typeof adminUsageReport>>) => {
    setUsage(r.usage)
    setLimits(r.limits)
    setError(r.error)
    setLoading(false)
  }
  useEffect(() => {
    adminUsageReport().then(apply)
  }, [])
  const refresh = async () => {
    setLoading(true)
    apply(await adminUsageReport())
  }

  const totalFiles = usage.reduce((s, r) => s + r.file_bytes, 0)

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
            <HardDrive className="h-4 w-4 text-[var(--gold)]" /> Chi occupa più spazio
          </h3>
          <button type="button" onClick={refresh} disabled={loading} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200" title="Aggiorna">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
        <p className="px-5 pt-3 text-xs text-gray-500">
          File caricati (foto e documenti) e dati nel database (stima del peso delle righe dei servizi). I primi 10 insieme: {formatBytes(totalFiles)} di file.
        </p>
        {error && <p className="px-5 py-3 text-sm text-red-600">{error}</p>}
        <ol className="divide-y divide-gray-100">
          {usage.map((r, i) => (
            <li key={r.user_id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
              <span className="w-5 shrink-0 pt-0.5 text-right font-bold text-gray-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                {who(r)}
                <span className="mt-0.5 block text-xs text-gray-500">
                  {Object.entries(r.buckets)
                    .sort((a, b) => b[1].bytes - a[1].bytes)
                    .map(([bucket, v]) => `${BUCKET_LABEL[bucket] ?? bucket} ${formatBytes(v.bytes)}`)
                    .join(' · ') || 'nessun file'}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className="block font-bold tabular-nums text-gray-900">{formatBytes(r.file_bytes + r.db_bytes)}</span>
                <span className="block text-xs tabular-nums text-gray-500">
                  {r.files} file · {r.db_rows} righe
                </span>
              </div>
            </li>
          ))}
          {!loading && !usage.length && !error && <li className="px-5 py-4 text-sm text-gray-500">Nessun dato.</li>}
        </ol>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
            <TriangleAlert className="h-4 w-4 text-[var(--gold)]" /> Chi si avvicina ai limiti
          </h3>
        </div>
        <p className="px-5 pt-3 text-xs text-gray-500">Per ogni persona il limite più pieno. Rosso dal 90%, arancione dal 70%.</p>
        <ol className="divide-y divide-gray-100">
          {limits.map((r, i) => {
            const tone = r.pct >= 90 ? 'bg-red-500' : r.pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
            return (
              <li key={r.user_id} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                <span className="w-5 shrink-0 pt-0.5 text-right font-bold text-gray-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  {who(r)}
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    {r.section} · {r.label}
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block font-bold tabular-nums text-gray-900">{r.pct.toLocaleString('it-IT')}%</span>
                  <span className="block text-xs tabular-nums text-gray-500">
                    {r.used.toLocaleString('it-IT')} / {r.max.toLocaleString('it-IT')}
                  </span>
                </div>
              </li>
            )
          })}
          {!loading && !limits.length && !error && <li className="px-5 py-4 text-sm text-gray-500">Nessun dato.</li>}
        </ol>
      </section>
    </div>
  )
}

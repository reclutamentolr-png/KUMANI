'use client'

import { useEffect, useState } from 'react'
import { ListOrdered, LoaderCircle, Save } from 'lucide-react'
import { notify } from '@/lib/adminNotify'
import { adminListKuActivityPoints, adminSaveKuActivityPoints, type KuActivityPointsRow } from '@/app/actions/admin'

// Specchietto dei KU Karma assegnati per ogni attività (accesso giornaliero
// e uso di ciascuno strumento, una volta al giorno). 0 = nessun KU Karma.
export default function KuActivityPointsTable() {
  const [rows, setRows] = useState<KuActivityPointsRow[] | null>(null)
  const [saved, setSaved] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminListKuActivityPoints().then((result) => {
      setRows(result.rows)
      setSaved(Object.fromEntries(result.rows.map((row) => [row.key, row.points])))
      setError(result.error)
    })
  }, [])

  const changed = (rows ?? []).filter((row) => saved[row.key] !== row.points)

  const save = async () => {
    setSaving(true)
    setError(null)
    const result = await adminSaveKuActivityPoints(changed.map(({ key, points }) => ({ key, points })))
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Errore durante il salvataggio')
      return
    }
    setSaved(Object.fromEntries((rows ?? []).map((row) => [row.key, row.points])))
    notify('KU Karma per attività salvati.', 'success')
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <ListOrdered className="w-5 h-5" /> KU Karma per attività
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Quanti KU Karma riceve un Kumano per ogni attività: l&apos;accesso giornaliero e il primo uso del giorno di ciascuno
          strumento. 0 = l&apos;attività non dà KU Karma. Le modifiche valgono dal momento del salvataggio.
        </p>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {rows === null ? (
        <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <label key={row.key} className="flex items-center justify-between gap-3 border-b border-gray-100 py-1.5 text-sm">
              <span className={saved[row.key] !== row.points ? 'font-semibold text-[var(--ink)]' : 'text-gray-700'}>{row.label}</span>
              <input
                type="number"
                min="0"
                max="100"
                value={row.points}
                onChange={(e) =>
                  setRows((prev) => (prev ?? []).map((r) => (r.key === row.key ? { ...r, points: Math.max(0, parseInt(e.target.value, 10) || 0) } : r)))
                }
                className="w-20 rounded-lg border border-gray-300 p-1.5 text-right"
              />
            </label>
          ))}
        </div>
      )}
      <div className="flex justify-end border-t pt-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || changed.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--ink)] text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salva {changed.length > 0 ? `(${changed.length})` : ''}
        </button>
      </div>
    </div>
  )
}

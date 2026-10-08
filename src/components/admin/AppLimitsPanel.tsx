'use client'

import { useEffect, useMemo, useState } from 'react'
import { Brush, Gauge, LoaderCircle, RotateCcw, Save } from 'lucide-react'
import { notify } from '@/lib/adminNotify'
import { adminListAppLimits, adminRunCleanupNow, adminSaveAppLimits, type AppLimitRow } from '@/app/actions/admin'
import { askConfirm } from '@/lib/confirm'
import UsageReport from '@/components/admin/UsageReport'

const UNIT: Record<AppLimitRow['kind'], string> = {
  count: 'massimo',
  files: 'file',
  keep: 'da tenere',
  days: 'giorni',
  months: 'mesi',
}

// Admin → Limiti e pulizia: quante cose può creare una persona in ogni
// servizio, quanti file per spazio e quanto storico tiene la pulizia
// notturna. I valori stanno nel database (app_limits) e valgono subito.
export default function AppLimitsPanel() {
  const [rows, setRows] = useState<AppLimitRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  const apply = ({ items, error }: Awaited<ReturnType<typeof adminListAppLimits>>) => {
    if (error) notify('Errore: ' + error)
    setRows(items)
    setDraft(Object.fromEntries(items.map((r) => [r.key, String(r.value)])))
    setLoading(false)
  }
  const load = async () => apply(await adminListAppLimits())
  useEffect(() => {
    adminListAppLimits().then(apply)
  }, [])

  const changes = useMemo(
    () =>
      rows
        .filter((r) => draft[r.key] !== undefined && draft[r.key] !== String(r.value))
        .map((r) => ({ key: r.key, value: Number(draft[r.key]) })),
    [rows, draft]
  )
  const invalid = changes.some((c) => !Number.isInteger(c.value) || c.value < 0)

  const sections = useMemo(() => {
    const map = new Map<string, AppLimitRow[]>()
    for (const r of rows) map.set(r.section, [...(map.get(r.section) ?? []), r])
    return [...map.entries()]
  }, [rows])

  const save = async () => {
    if (!changes.length || invalid) return
    setSaving(true)
    const result = await adminSaveAppLimits(changes)
    setSaving(false)
    if (!result.success) return notify('Errore: ' + result.error)
    notify(`Salvato: ${changes.length} ${changes.length === 1 ? 'valore' : 'valori'}`)
    await load()
  }

  const cleanNow = async () => {
    if (!(await askConfirm('Lanciare adesso la pulizia notturna? Cancella i dati più vecchi dei tempi impostati qui sotto.', { title: 'Pulizia adesso', confirmLabel: 'Avvia la pulizia', tone: 'warning' }))) return
    setCleaning(true)
    const result = await adminRunCleanupNow()
    setCleaning(false)
    if (!result.success || !result.result) return notify('Errore: ' + result.error)
    const removed = Object.entries(result.result)
      .filter(([k, v]) => k !== 'at' && Number(v) > 0)
      .map(([k, v]) => `${k}: ${v}`)
    notify(removed.length ? `Pulizia fatta — ${removed.join(', ')}` : 'Pulizia fatta: niente da cancellare')
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-gray-500">
        <LoaderCircle className="h-5 w-5 animate-spin" /> Caricamento…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Gauge className="h-6 w-6 text-[var(--gold)]" /> Limiti e pulizia
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Quante cose può creare ogni persona nei servizi, quanti file può caricare e quanto storico tiene la pulizia notturna (ogni giorno alle 2:30; i file non più usati alle 3:30).
            I valori valgono subito, senza aggiornare l’app. Chi raggiunge un limite vede «Hai raggiunto il numero massimo consentito»: non perde nulla, deve solo eliminare qualcosa
            per aggiungere altro.
          </p>
        </div>
        <button
          type="button"
          onClick={cleanNow}
          disabled={cleaning}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {cleaning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Brush className="h-4 w-4" />} Pulizia adesso
        </button>
      </div>

      {/* Chi occupa più spazio e chi si avvicina ai limiti */}
      <UsageReport />

      {sections.map(([section, items]) => (
        <section key={section} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
            <h3 className="text-base font-bold text-[var(--ink)]">{section}</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {items.map((r) => {
              const changed = draft[r.key] !== String(r.value)
              return (
                <li key={r.key} className={`flex flex-wrap items-center gap-3 px-5 py-2.5 ${changed ? 'bg-amber-50' : ''}`}>
                  <label htmlFor={`lim-${r.key}`} className="min-w-0 flex-1 text-sm text-gray-800">
                    {r.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`lim-${r.key}`}
                      type="number"
                      min={0}
                      step={1}
                      value={draft[r.key] ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-right text-sm font-semibold tabular-nums focus:border-[var(--gold)] focus:outline-none"
                    />
                    <span className="w-16 text-xs text-gray-500">{UNIT[r.kind]}</span>
                    {changed && (
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, [r.key]: String(r.value) }))}
                        title={`Torna a ${r.value}`}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!changes.length || invalid || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-lg disabled:opacity-50"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {changes.length ? `Salva ${changes.length} ${changes.length === 1 ? 'modifica' : 'modifiche'}` : 'Nessuna modifica'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Eye, Gift, LoaderCircle, Sparkles, TreePine } from 'lucide-react'
import { adminGetChristmas, adminSaveChristmas, adminSetChristmasPreview } from '@/app/actions/adminChristmas'
import { CHRISTMAS_MAX_PCT, type ChristmasMode, type ChristmasSettings, type ChristmasState } from '@/lib/christmasShared'
import { notify } from '@/lib/adminNotify'

const MODES: { key: ChristmasMode; label: string; hint: string }[] = [
  { key: 'auto', label: 'Automatiche', hint: 'Dal 1° dicembre al 6 gennaio' },
  { key: 'on', label: 'Sempre accese', hint: 'Da subito, finché non le spegni' },
  { key: 'off', label: 'Spente', hint: 'Niente ghirlanda né cappello' },
]

// Admin → Natale: ghirlanda sotto la barra nera e cappello sul logo (Home
// dell'app, homepage pubblica, pagina del regalo) e l'offerta di Natale
// (sconto sui regali e sul primo anno di abbonamento).
export default function ChristmasPanel() {
  const [settings, setSettings] = useState<ChristmasSettings | null>(null)
  const [state, setState] = useState<ChristmasState | null>(null)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminGetChristmas().then((result) => {
      if ('error' in result) return notify('Errore: ' + result.error)
      setSettings(result.settings)
      setState(result.state)
      setPreview(result.preview)
    })
  }, [])

  if (!settings || !state) return <p className="text-sm text-gray-500">Caricamento…</p>

  const set = (patch: Partial<ChristmasSettings>) => setSettings({ ...settings, ...patch })

  const save = async () => {
    setSaving(true)
    const result = await adminSaveChristmas(settings)
    setSaving(false)
    if (!result.success) return notify('Errore: ' + result.error)
    setSettings(result.settings)
    setState(result.state)
    notify('Impostazioni di Natale salvate.', 'success')
  }

  const togglePreview = async () => {
    const next = !preview
    await adminSetChristmasPreview(next)
    setPreview(next)
    notify(next ? 'Anteprima accesa: ora vedi ghirlanda e cappello nella tua Home (solo tu).' : 'Anteprima spenta.', 'success')
  }

  const input = 'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]'

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <TreePine className="h-7 w-7 text-emerald-700" /> Natale
        </h2>
        <p className="mt-1 text-gray-600">
          Le decorazioni (ghirlanda sotto la barra nera e cappello sul logo) e l&apos;offerta di Natale. Le modifiche valgono dopo «Salva».
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 font-semibold ${state.decorations ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
          Decorazioni oggi: {state.decorations ? 'accese' : 'spente'}
        </span>
        <span className={`rounded-full px-3 py-1 font-semibold ${state.offer ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
          Offerta oggi: {state.offer ? 'attiva' : 'non attiva'}
        </span>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Sparkles className="h-5 w-5 text-[var(--gold)]" /> Decorazioni
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => set({ decorations: mode.key })}
              className={`rounded-xl border p-3 text-left ${settings.decorations === mode.key ? 'border-[var(--gold)] bg-[var(--gold-pale)] ring-1 ring-[var(--gold)]' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <span className="block text-sm font-bold text-gray-900">{mode.label}</span>
              <span className="block text-xs text-gray-600">{mode.hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={togglePreview} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <Eye className="h-4 w-4" /> {preview ? 'Spegni anteprima' : 'Anteprima solo per me'}
          </button>
          {preview && (
            <a href="/dashboard" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] underline underline-offset-4">
              Apri la Home <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          L&apos;anteprima mostra le decorazioni nella barra della tua Home e dei servizi, senza accenderle agli altri. La homepage pubblica e la
          pagina del regalo le mostrano solo quando sono accese davvero.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Gift className="h-5 w-5 text-red-600" /> Offerta di Natale
        </h3>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <input type="checkbox" checked={settings.offer} onChange={(e) => set({ offer: e.target.checked })} className="h-4 w-4 accent-[var(--gold)]" />
          Offerta accesa (vale solo tra le date qui sotto)
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-gray-700">
            <span className="mb-1 block font-semibold">Sconto sui regali (un anno di Base o Pro)</span>
            <span className="flex items-center gap-2">
              <input type="number" min={0} max={CHRISTMAS_MAX_PCT} value={settings.giftPct} onChange={(e) => set({ giftPct: Number(e.target.value) })} className={`${input} w-24`} />%
            </span>
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block font-semibold">Sconto sul primo anno di chi si abbona</span>
            <span className="flex items-center gap-2">
              <input type="number" min={0} max={CHRISTMAS_MAX_PCT} value={settings.planPct} onChange={(e) => set({ planPct: Number(e.target.value) })} className={`${input} w-24`} />%
            </span>
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block font-semibold">Dal</span>
            <input type="date" value={settings.from} onChange={(e) => set({ from: e.target.value })} className={input} />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block font-semibold">Al (compreso)</span>
            <input type="date" value={settings.until} onChange={(e) => set({ until: e.target.value })} className={input} />
          </label>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-gray-600">
          <li>Massimo {CHRISTMAS_MAX_PCT}%. Con 0% quella parte dell&apos;offerta non si mostra.</li>
          <li>Regali: il prezzo scontato si vede in «Regali» e si paga così; chi riceve il codice ha lo stesso anno completo.</li>
          <li>Abbonamento: lo sconto vale una volta sola, sul primo anno (Base o Pro), e si somma all&apos;eventuale credito dei Pass. Il rinnovo è a prezzo pieno.</li>
          <li>Con l&apos;offerta attiva, in cima alla Home compare il riquadro «Natale con KUMANI» (chiudibile per un giorno).</li>
        </ul>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ink-soft)] disabled:bg-gray-400"
        >
          {saving && <LoaderCircle className="h-4 w-4 animate-spin" />} Salva
        </button>
      </div>
    </div>
  )
}

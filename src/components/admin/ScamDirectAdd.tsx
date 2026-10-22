'use client'

import { useState } from 'react'
import { LoaderCircle, ShieldPlus } from 'lucide-react'
import { notify } from '@/lib/adminNotify'
import { adminAddConfirmedScam } from '@/app/actions/scamNet'

// Admin → Rete Anti-Truffa: «Aggiungi una truffa certa». Lo Staff inserisce
// un sito, un numero, un IBAN… e l'avviso compare subito in Speculum.
const KINDS = [
  ['site', 'Sito web', 'es. www.itaconsob.it'],
  ['phone', 'Telefono', 'es. +39 333 1234567'],
  ['iban', 'IBAN', 'es. IT60X0542811101000000123456'],
  ['email', 'Email', 'es. assistenza@finto-sito.com'],
  ['social', 'Profilo social', 'es. instagram.com/profilo-falso'],
] as const
const CATEGORIES = [
  ['investment', 'Investimenti miracolosi / recupero fondi'],
  ['bank', 'Falso operatore della banca'],
  ['courier', 'Falso corriere'],
  ['phishing', 'Furto di dati (phishing)'],
  ['marketplace', 'Compravendita online'],
  ['rental', 'Affitto inesistente'],
  ['romance', 'Truffa sentimentale'],
  ['job', 'Falso lavoro'],
  ['support', 'Falsa assistenza tecnica'],
  ['prize', 'Falsa vincita o regalo'],
  ['other', 'Altro (es. prestito facile)'],
] as const

export default function ScamDirectAdd({ onAdded }: { onAdded?: () => void }) {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('site')
  const [value, setValue] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>('investment')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    const r = await adminAddConfirmedScam({ kind, value, category, description })
    setBusy(false)
    if (!r.success) return notify('Errore: ' + (r.error ?? ''))
    notify(`✅ ${r.display} è ora una truffa confermata: chi lo controlla in Speculum vede l’avviso rosso`)
    setValue('')
    setDescription('')
    onAdded?.()
  }

  const field = 'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'
  return (
    <section className="rounded-xl border-2 border-red-200 bg-red-50/40 p-5">
      <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <ShieldPlus className="h-5 w-5 text-red-700" /> Aggiungi una truffa certa
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Per i dati che lo Staff sa con certezza essere una truffa. L’avviso compare subito a chi li controlla in Speculum (sito, telefono, IBAN, email, profilo). Mai
        dati di persone private che non c’entrano.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <label className="text-sm font-medium text-gray-700">
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={field}>
            {KINDS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Dato
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={KINDS.find(([k]) => k === kind)?.[2]} className={field} />
        </label>
      </div>
      <label className="mt-3 block text-sm font-medium text-gray-700">
        Tipo di truffa
        <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={field}>
          {CATEGORIES.map(([c, label]) => (
            <option key={c} value={c}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm font-medium text-gray-700">
        Descrizione (la vedono gli utenti nell’avviso)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 600))}
          rows={3}
          placeholder="es. Finto portale «autorizzato CONSOB» per sbloccare criptovalute: truffa del recupero fondi."
          className={field}
        />
      </label>
      <button
        type="button"
        disabled={busy || !value.trim() || description.trim().length < 10}
        onClick={submit}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Aggiungi come truffa confermata
      </button>
    </section>
  )
}

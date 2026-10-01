'use client'

import { useCallback, useEffect, useState } from 'react'
import { HeartHandshake, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react'
import {
  adminAddPayout,
  adminDeletePayout,
  adminGetDonations,
  adminSaveAssociation,
  adminSaveDonationSettings,
  adminSetActiveAssociation,
  type AdminAssociation,
  type AdminPayout,
} from '@/app/actions/donations'

const euro = (cents: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const input = 'w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]'
const emptyAssociation = { name: '', tax_code: '', description: '', mission: '', website: '', logo_url: '' }

// Admin → Donazioni: importi donati per abbonamento, valore dei Punti
// Community donati, associazioni (una attiva), versamenti fatti e riepilogo.
export default function DonationsPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [associations, setAssociations] = useState<AdminAssociation[]>([])
  const [payouts, setPayouts] = useState<AdminPayout[]>([])
  const [totals, setTotals] = useState({ subscriptionCents: 0, pointsCents: 0 })
  const [settings, setSettings] = useState({ base: '3', pro: '6', point: '0.10' })
  const [form, setForm] = useState<typeof emptyAssociation & { id?: string }>(emptyAssociation)
  const [payout, setPayout] = useState({ association_id: '', amount_eur: '', paid_on: new Date().toISOString().slice(0, 10), reference: '', receipt_url: '', notes: '' })
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminGetDonations()
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setAssociations(result.associations)
    setPayouts(result.payouts)
    setTotals(result.totals)
    setSettings({
      base: String(result.settings.baseCents / 100),
      pro: String(result.settings.proCents / 100),
      point: String(result.settings.pointValueCents / 100),
    })
    setPayout((prev) => ({ ...prev, association_id: prev.association_id || result.associations.find((a) => a.is_active)?.id || result.associations[0]?.id || '' }))
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    // Caricamento dal server all'apertura (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const run = async (key: string, action: () => Promise<{ success: boolean; error?: string }>, done?: () => void) => {
    setBusy(key)
    const result = await action()
    setBusy(null)
    if (!result.success) {
      alert('Errore: ' + (result.error ?? ''))
      return
    }
    done?.()
    await load()
  }

  const toCents = (value: string) => Math.round(Number(value.replace(',', '.')) * 100)
  const active = associations.find((a) => a.is_active)
  const accrued = totals.subscriptionCents + totals.pointsCents
  const paid = payouts.reduce((sum, p) => sum + p.amount_cents, 0)

  if (loading) return <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <HeartHandshake className="h-7 w-7" /> Donazioni
        </h2>
        <p className="mt-1 text-gray-600">
          Per ogni pagamento con carta di un abbonamento (primo pagamento e rinnovi) KUMANI dona una cifra fissa
          all&apos;associazione attiva; il passaggio da Base a Pro aggiunge la differenza; un rimborso annulla la donazione. I
          Kumani possono donare i propri KU Points: KUMANI versa il controvalore in euro. Tutto è visibile in
          Homepage, nella pagina Donazioni e nel Portafoglio.
        </p>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!active && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Nessuna associazione attiva: le donazioni non maturano e le sezioni pubbliche restano nascoste finché non ne
            attivi una.
          </p>
        )}
      </div>

      {/* Riepilogo */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          ['Maturato in totale', euro(accrued)],
          ['Da abbonamenti', euro(totals.subscriptionCents)],
          ['Da KU Points', euro(totals.pointsCents)],
          ['Già versato', euro(paid)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold text-gray-700">Da versare: {euro(Math.max(accrued - paid, 0))}</p>

      {/* Impostazioni */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">Importi</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-gray-600">
            Donazione per abbonamento Base (€)
            <input value={settings.base} onChange={(e) => setSettings({ ...settings, base: e.target.value })} inputMode="decimal" className={input} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Donazione per abbonamento Pro (€)
            <input value={settings.pro} onChange={(e) => setSettings({ ...settings, pro: e.target.value })} inputMode="decimal" className={input} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Valore di 1 KU Point donato (€)
            <input value={settings.point} onChange={(e) => setSettings({ ...settings, point: e.target.value })} inputMode="decimal" className={input} />
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Riferimento: con il pacchetto base 294 punti valgono 49 € di voucher (circa 0,17 € a punto). 0 al valore del punto
          = donazione di punti spenta.
        </p>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run('settings', () => adminSaveDonationSettings({ baseCents: toCents(settings.base), proCents: toCents(settings.pro), pointValueCents: toCents(settings.point) }))}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Salva importi
        </button>
      </section>

      {/* Associazioni */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">Associazioni</h3>
        {associations.length === 0 ? (
          <p className="text-sm text-gray-500">Nessuna associazione: aggiungine una qui sotto.</p>
        ) : (
          <ul className="space-y-2">
            {associations.map((a) => (
              <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${a.is_active ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.logo_url && <img src={a.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">
                    {a.name} {a.is_active && <span className="ml-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">ATTIVA</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    Maturato {euro(a.accrued_cents)} · versato {euro(a.paid_cents)} · da versare {euro(Math.max(a.accrued_cents - a.paid_cents, 0))}
                  </p>
                </div>
                <button type="button" onClick={() => setForm({ id: a.id, name: a.name, tax_code: a.tax_code ?? '', description: a.description ?? '', mission: a.mission ?? '', website: a.website ?? '', logo_url: a.logo_url ?? '' })} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700">
                  Modifica
                </button>
                {a.is_active ? (
                  <button type="button" disabled={busy !== null} onClick={() => confirm('Disattivare questa associazione? Le donazioni smettono di maturare finché non ne attivi un\'altra.') && run('off', () => adminSetActiveAssociation(null))} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700">
                    Disattiva
                  </button>
                ) : (
                  <button type="button" disabled={busy !== null} onClick={() => confirm(`Rendere "${a.name}" l'associazione attiva? Le nuove donazioni andranno a lei.`) && run('on', () => adminSetActiveAssociation(a.id))} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Rendi attiva
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-4">
          <p className="text-sm font-semibold text-gray-800">{form.id ? 'Modifica associazione' : 'Nuova associazione'}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-600">Nome *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></label>
            <label className="text-xs font-medium text-gray-600">Codice fiscale / C.F. ETS<input value={form.tax_code} onChange={(e) => setForm({ ...form, tax_code: e.target.value })} className={input} /></label>
            <label className="text-xs font-medium text-gray-600 sm:col-span-2">Missione in una frase (visibile in Homepage)<input value={form.mission} onChange={(e) => setForm({ ...form, mission: e.target.value })} maxLength={300} className={input} /></label>
            <label className="text-xs font-medium text-gray-600 sm:col-span-2">Descrizione (pagina Donazioni)<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} maxLength={2000} className={input} /></label>
            <label className="text-xs font-medium text-gray-600">Sito web<input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={input} /></label>
            <label className="text-xs font-medium text-gray-600">Logo (indirizzo dell&apos;immagine)<input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} className={input} /></label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy !== null} onClick={() => run('assoc', () => adminSaveAssociation(form), () => setForm(emptyAssociation))} className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Save className="h-4 w-4" /> {form.id ? 'Salva modifiche' : 'Aggiungi associazione'}
            </button>
            {form.id && (
              <button type="button" onClick={() => setForm(emptyAssociation)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">
                Annulla
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Versamenti */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-gray-900">Versamenti all&apos;associazione</h3>
        <p className="text-sm text-gray-600">Registra ogni bonifico fatto: compare nella pagina pubblica Donazioni con data e riferimento.</p>
        {associations.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-gray-600">
              Associazione
              <select value={payout.association_id} onChange={(e) => setPayout({ ...payout, association_id: e.target.value })} className={input}>
                {associations.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">Importo (€)<input value={payout.amount_eur} onChange={(e) => setPayout({ ...payout, amount_eur: e.target.value })} inputMode="decimal" className={input} /></label>
            <label className="text-xs font-medium text-gray-600">Data<input type="date" value={payout.paid_on} onChange={(e) => setPayout({ ...payout, paid_on: e.target.value })} className={input} /></label>
            <label className="text-xs font-medium text-gray-600">Riferimento (es. CRO bonifico)<input value={payout.reference} onChange={(e) => setPayout({ ...payout, reference: e.target.value })} className={input} /></label>
            <label className="text-xs font-medium text-gray-600">Ricevuta (indirizzo, facoltativo)<input value={payout.receipt_url} onChange={(e) => setPayout({ ...payout, receipt_url: e.target.value })} className={input} /></label>
            <label className="text-xs font-medium text-gray-600">Note interne<input value={payout.notes} onChange={(e) => setPayout({ ...payout, notes: e.target.value })} className={input} /></label>
            <div className="sm:col-span-3">
              <button
                type="button"
                disabled={busy !== null || !payout.association_id}
                onClick={() =>
                  run('payout', () => adminAddPayout({ ...payout, amount_eur: Number(payout.amount_eur.replace(',', '.')) }), () =>
                    setPayout({ ...payout, amount_eur: '', reference: '', receipt_url: '', notes: '' })
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Registra versamento
              </button>
            </div>
          </div>
        )}
        {payouts.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="py-2">Data</th>
                <th>Associazione</th>
                <th>Riferimento</th>
                <th className="text-right">Importo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-gray-100">
                  <td className="py-2">{new Date(p.paid_on).toLocaleDateString('it-IT')}</td>
                  <td>{p.association}</td>
                  <td className="text-gray-600">{p.reference ?? '—'}</td>
                  <td className="text-right font-semibold">{euro(p.amount_cents)}</td>
                  <td className="text-right">
                    <button type="button" aria-label="Elimina" disabled={busy !== null} onClick={() => confirm('Eliminare questo versamento?') && run('del', () => adminDeletePayout(p.id))} className="p-1 text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

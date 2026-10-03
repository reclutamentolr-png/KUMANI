'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import {
  adminCostsSummary,
  adminDeleteCost,
  adminDeleteExpense,
  adminListCosts,
  adminSaveCost,
  adminSaveExpense,
  type PlatformCost,
  type PlatformExpense,
} from '@/app/actions/adminCosts'
import { COST_CATEGORIES, COST_CATEGORY_LABEL, FREQUENCY_LABEL, type CostCategory, type CostFrequency } from '@/lib/platformCosts'
import { notify } from '@/lib/adminNotify'

// Admin → Costi e margini: quanto costa la piattaforma (fissi e variabili),
// i costi automatici (commissioni, provvigioni, donazioni, voucher usati),
// il margine e gli impegni futuri (voucher e KU Points non ancora usati).

type Summary = NonNullable<Awaited<ReturnType<typeof adminCostsSummary>>>

const eur = (cents: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const toCents = (text: string) => {
  const n = Number(String(text).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}
const toText = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')
const today = () => new Date().toISOString().slice(0, 10)

function Row({ label, value, hint, strong, negative }: { label: string; value: string; hint?: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 py-2 last:border-0">
      <div>
        <p className={`text-sm ${strong ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{label}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      <p className={`whitespace-nowrap text-sm ${strong ? 'font-bold' : 'font-medium'} ${negative ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

type CostDraft = { id?: string; name: string; provider: string; category: CostCategory; amount: string; frequency: CostFrequency; start_date: string; end_date: string; notes: string }
type ExpenseDraft = { id?: string; description: string; category: CostCategory; amount: string; spent_on: string; notes: string }

export default function CostsPanel() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [costs, setCosts] = useState<PlatformCost[]>([])
  const [expenses, setExpenses] = useState<PlatformExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [costDraft, setCostDraft] = useState<CostDraft | null>(null)
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const [list, sum] = await Promise.all([adminListCosts(), adminCostsSummary()])
    setCosts(list?.costs ?? [])
    setExpenses(list?.expenses ?? [])
    setSummary(sum)
    setLoading(false)
  }, [])

  useEffect(() => {
    Promise.all([adminListCosts(), adminCostsSummary()]).then(([list, sum]) => {
      setCosts(list?.costs ?? [])
      setExpenses(list?.expenses ?? [])
      setSummary(sum)
      setLoading(false)
    })
  }, [])

  const saveCost = async () => {
    if (!costDraft) return
    const cents = toCents(costDraft.amount || '0')
    if (Number.isNaN(cents)) return notify('Importo non valido.')
    setSaving(true)
    const r = await adminSaveCost({ ...costDraft, amount_cents: cents, end_date: costDraft.end_date || null })
    setSaving(false)
    if (!r.success) return notify(r.error ?? 'Salvataggio non riuscito.')
    setCostDraft(null)
    notify('Costo salvato.', 'success')
    reload()
  }

  const saveExpense = async () => {
    if (!expenseDraft) return
    const cents = toCents(expenseDraft.amount)
    if (Number.isNaN(cents) || cents <= 0) return notify('Importo non valido.')
    setSaving(true)
    const r = await adminSaveExpense({ ...expenseDraft, amount_cents: cents })
    setSaving(false)
    if (!r.success) return notify(r.error ?? 'Salvataggio non riuscito.')
    setExpenseDraft(null)
    notify('Spesa salvata.', 'success')
    reload()
  }

  const removeCost = async (cost: PlatformCost) => {
    if (!window.confirm(`Eliminare il costo "${cost.name}"? Se è solo terminato, meglio indicare la data di fine.`)) return
    await adminDeleteCost(cost.id)
    reload()
  }
  const removeExpense = async (e: PlatformExpense) => {
    if (!window.confirm(`Eliminare la spesa "${e.description}"?`)) return
    await adminDeleteExpense(e.id)
    reload()
  }

  if (loading && !summary) return <div className="flex justify-center py-12"><LoaderCircle className="h-6 w-6 animate-spin text-gray-400" /></div>
  if (!summary) return <p className="text-sm text-red-600">Non autorizzato.</p>
  const s = summary
  const c = s.commitments
  const input = 'w-full rounded-lg border border-gray-300 p-2 text-sm'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Costi e margini</h2>
          <p className="mt-1 text-sm text-gray-500">Quanto costa la piattaforma, quanto rende e quali impegni restano aperti (voucher e KU Points non ancora usati).</p>
        </div>
        <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Aggiorna
        </button>
      </div>

      {s.toComplete > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {s.toComplete} {s.toComplete === 1 ? 'costo fisso ha' : 'costi fissi hanno'} ancora l&apos;importo a 0 €: completali qui sotto con le cifre vere.
        </p>
      )}
      {s.testMode && <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">Stripe è in modalità di prova: gli incassi sono di test.</p>}

      {/* Numeri principali */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Costi fissi al mese', value: eur(s.monthlyRun), hint: `${eur(s.yearlyRun)} all'anno` },
          { label: 'Spese variabili del mese', value: eur(s.variableThisMonth), hint: `${eur(s.variableTotal)} in tutto` },
          { label: 'Margine operativo', value: eur(s.operating), hint: 'Dall\'inizio, IVA esclusa', danger: s.operating < 0 },
          { label: 'Costo di struttura (voucher usati)', value: eur(s.structure), hint: 'Servizi dati con i KU Points' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-2xl font-bold ${k.danger ? 'text-red-700' : 'text-gray-900'}`}>{k.value}</p>
            <p className="text-xs text-gray-500">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="font-bold text-gray-900">Conto economico (dall&apos;inizio)</h3>
          <p className="mb-2 text-xs text-gray-500">Importi IVA esclusa sugli incassi. Le commissioni Stripe sono già tolte dagli incassi.</p>
          <Row label="Incassi netti" value={eur(s.revenueNet)} hint={`${eur(s.cashIn)} IVA ${s.vatRate}% inclusa · commissioni Stripe ${eur(s.stripeFees)}`} />
          <Row label="Costi fissi maturati" value={`− ${eur(s.fixedAccrued)}`} negative={s.fixedAccrued > 0} />
          <Row label="Spese variabili" value={`− ${eur(s.variableTotal)}`} negative={s.variableTotal > 0} />
          <Row label="Provvigioni agenti" value={`− ${eur(s.agents)}`} hint="Pagate e da pagare" negative={s.agents > 0} />
          <Row label="Donazioni maturate" value={`− ${eur(s.donations)}`} hint="Abbonamenti e KU Points donati" negative={s.donations > 0} />
          <Row label="Margine operativo" value={eur(s.operating)} strong negative={s.operating < 0} />
          <Row label="Costo di struttura: voucher usati" value={`− ${eur(s.structure)}`} hint="Servizi dati senza incasso, a prezzo di listino (non è un'uscita di cassa)" negative={s.structure > 0} />
          <Row label="Margine dopo la struttura" value={eur(s.afterStructure)} strong negative={s.afterStructure < 0} />
          {!s.available && <p className="mt-2 text-xs text-amber-700">Incassi non disponibili in questo momento (Stripe non raggiungibile): sono mostrati solo i costi.</p>}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="font-bold text-gray-900">Impegni futuri</h3>
          <p className="mb-2 text-xs text-gray-500">Non sono ancora costi: lo diventano quando vengono usati o pagati.</p>
          <Row label="KU Points ancora da convertire" value={eur(c.pointsMax)} hint={`${c.points} punti: valore massimo se tutti convertiti in voucher col pacchetto più conveniente`} />
          <Row label="Voucher creati e non ancora usati" value={eur(c.vouchersUnused)} />
          <Row label="Credito voucher non ancora speso" value={eur(c.voucherCredit)} />
          <Row label="Provvigioni agenti da pagare" value={eur(c.agentsDue)} />
          <Row label="Donazioni da versare" value={eur(c.donationsDue)} />
          <Row label="Totale impegni (massimo)" value={eur(c.pointsMax + c.vouchersUnused + c.voucherCredit + c.agentsDue + c.donationsDue)} strong />
        </div>
      </div>

      {/* Costi fissi */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-gray-900">Costi fissi</h3>
          <button type="button" onClick={() => setCostDraft({ name: '', provider: '', category: 'altro', amount: '', frequency: 'monthly', start_date: today(), end_date: '', notes: '' })} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Nuovo costo
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500">
              <tr><th className="py-2 pr-3">Costo</th><th className="py-2 pr-3">Categoria</th><th className="py-2 pr-3">Frequenza</th><th className="py-2 pr-3 text-right">Importo</th><th className="py-2 pr-3 text-right">Al mese</th><th className="py-2 pr-3">Dal / al</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {costs.map((cost) => {
                const ended = Boolean(cost.end_date && cost.end_date < today())
                return (
                  <tr key={cost.id} className={ended ? 'text-gray-400' : ''}>
                    <td className="py-2 pr-3">
                      <p className="font-semibold">{cost.name}</p>
                      <p className="text-xs text-gray-500">{[cost.provider, cost.notes].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="py-2 pr-3">{COST_CATEGORY_LABEL[cost.category]}</td>
                    <td className="py-2 pr-3">{FREQUENCY_LABEL[cost.frequency]}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{cost.amount_cents === 0 ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Da compilare</span> : eur(cost.amount_cents)}</td>
                    <td className="py-2 pr-3 text-right">{cost.frequency === 'one_off' ? '—' : eur(cost.frequency === 'yearly' ? Math.round(cost.amount_cents / 12) : cost.amount_cents)}</td>
                    <td className="py-2 pr-3 text-xs">{new Date(cost.start_date).toLocaleDateString('it-IT')}{cost.end_date ? ` → ${new Date(cost.end_date).toLocaleDateString('it-IT')}` : ''}</td>
                    <td className="whitespace-nowrap py-2 text-right">
                      <button type="button" onClick={() => setCostDraft({ id: cost.id, name: cost.name, provider: cost.provider ?? '', category: cost.category, amount: toText(cost.amount_cents), frequency: cost.frequency, start_date: cost.start_date, end_date: cost.end_date ?? '', notes: cost.notes ?? '' })} className="p-1 text-gray-500 hover:text-gray-900" title="Modifica"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => removeCost(cost)} className="p-1 text-gray-400 hover:text-red-600" title="Elimina"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                )
              })}
              {costs.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-gray-500">Nessun costo fisso.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spese variabili */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-gray-900">Spese variabili</h3>
          <button type="button" onClick={() => setExpenseDraft({ description: '', category: 'ai', amount: '', spent_on: today(), notes: '' })} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Nuova spesa
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">Le spese che cambiano di mese in mese: fattura dell&apos;intelligenza artificiale, pubblicità, stampa, eventi… Commissioni Stripe, provvigioni e donazioni si calcolano da sole.</p>
        <ul className="divide-y divide-gray-100 text-sm">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-semibold">{e.description}</p>
                <p className="text-xs text-gray-500">{new Date(e.spent_on).toLocaleDateString('it-IT')} · {COST_CATEGORY_LABEL[e.category]}{e.notes ? ` · ${e.notes}` : ''}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold">{eur(e.amount_cents)}</span>
                <button type="button" onClick={() => setExpenseDraft({ id: e.id, description: e.description, category: e.category, amount: toText(e.amount_cents), spent_on: e.spent_on, notes: e.notes ?? '' })} className="p-1 text-gray-500 hover:text-gray-900" title="Modifica"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => removeExpense(e)} className="p-1 text-gray-400 hover:text-red-600" title="Elimina"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
          {expenses.length === 0 && <li className="py-4 text-center text-gray-500">Nessuna spesa variabile registrata.</li>}
        </ul>
      </div>

      {/* Modulo costo fisso */}
      {costDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setCostDraft(null)}>
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{costDraft.id ? 'Modifica costo' : 'Nuovo costo fisso'}</h3><button type="button" onClick={() => setCostDraft(null)}><X className="h-5 w-5 text-gray-400" /></button></div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Nome</label><input className={input} value={costDraft.name} onChange={(e) => setCostDraft({ ...costDraft, name: e.target.value })} placeholder="Es. Hosting del sito" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Fornitore</label><input className={input} value={costDraft.provider} onChange={(e) => setCostDraft({ ...costDraft, provider: e.target.value })} placeholder="Es. Vercel" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Categoria</label><select className={input} value={costDraft.category} onChange={(e) => setCostDraft({ ...costDraft, category: e.target.value as CostCategory })}>{COST_CATEGORIES.map((k) => <option key={k} value={k}>{COST_CATEGORY_LABEL[k]}</option>)}</select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Importo (€)</label><input className={input} inputMode="decimal" value={costDraft.amount} onChange={(e) => setCostDraft({ ...costDraft, amount: e.target.value })} placeholder="0,00" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Frequenza</label><select className={input} value={costDraft.frequency} onChange={(e) => setCostDraft({ ...costDraft, frequency: e.target.value as CostFrequency })}>{(['monthly', 'yearly', 'one_off'] as const).map((k) => <option key={k} value={k}>{FREQUENCY_LABEL[k]}</option>)}</select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Dal</label><input type="date" className={input} value={costDraft.start_date} onChange={(e) => setCostDraft({ ...costDraft, start_date: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Al (se terminato)</label><input type="date" className={input} value={costDraft.end_date} onChange={(e) => setCostDraft({ ...costDraft, end_date: e.target.value })} /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Note</label><input className={input} value={costDraft.notes} onChange={(e) => setCostDraft({ ...costDraft, notes: e.target.value })} /></div>
            <p className="text-xs text-gray-500">Importo IVA inclusa se il fornitore la applica. Per i servizi in dollari usa il cambio della fattura.</p>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setCostDraft(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm">Annulla</button><button type="button" disabled={saving} onClick={saveCost} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvataggio…' : 'Salva'}</button></div>
          </div>
        </div>
      )}

      {/* Modulo spesa variabile */}
      {expenseDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setExpenseDraft(null)}>
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{expenseDraft.id ? 'Modifica spesa' : 'Nuova spesa variabile'}</h3><button type="button" onClick={() => setExpenseDraft(null)}><X className="h-5 w-5 text-gray-400" /></button></div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Descrizione</label><input className={input} value={expenseDraft.description} onChange={(e) => setExpenseDraft({ ...expenseDraft, description: e.target.value })} placeholder="Es. Fattura AI di ottobre" /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Importo (€)</label><input className={input} inputMode="decimal" value={expenseDraft.amount} onChange={(e) => setExpenseDraft({ ...expenseDraft, amount: e.target.value })} placeholder="0,00" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Data</label><input type="date" className={input} value={expenseDraft.spent_on} onChange={(e) => setExpenseDraft({ ...expenseDraft, spent_on: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Categoria</label><select className={input} value={expenseDraft.category} onChange={(e) => setExpenseDraft({ ...expenseDraft, category: e.target.value as CostCategory })}>{COST_CATEGORIES.map((k) => <option key={k} value={k}>{COST_CATEGORY_LABEL[k]}</option>)}</select></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-gray-700">Note</label><input className={input} value={expenseDraft.notes} onChange={(e) => setExpenseDraft({ ...expenseDraft, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setExpenseDraft(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm">Annulla</button><button type="button" disabled={saving} onClick={saveExpense} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvataggio…' : 'Salva'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

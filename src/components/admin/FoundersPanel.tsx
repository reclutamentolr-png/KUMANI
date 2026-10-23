'use client'

import { useCallback, useEffect, useState } from 'react'
import { Award, LoaderCircle } from 'lucide-react'
import { adminGetFounders, adminGrantFoundersExisting, adminHideFoundersSoldOut, adminSetFounders, type AdminFounder, type AdminSoldOut } from '@/app/actions/adminFounders'
import { askConfirm } from '@/lib/confirm'

// Admin → Voucher e coupon → Fondatori: la promozione «primi 50» (accesa,
// posti), l'elenco dei Fondatori e il regalo agli iscritti di prima.
export default function FoundersPanel() {
  const [enabled, setEnabled] = useState(false)
  const [limit, setLimit] = useState(50)
  const [founders, setFounders] = useState<AdminFounder[] | null>(null)
  const [soldOut, setSoldOut] = useState<AdminSoldOut | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await adminGetFounders()
    if ('error' in r) return setMsg(r.error)
    setEnabled(r.enabled)
    setLimit(r.limit)
    setSoldOut(r.soldOut)
    setFounders(r.founders)
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento della sezione
    load()
  }, [load])

  const counted = (founders ?? []).filter((f) => f.counted).length
  const early = (founders ?? []).filter((f) => !f.counted).length

  const save = async (nextEnabled: boolean) => {
    setBusy('save')
    const r = await adminSetFounders(nextEnabled, limit)
    setBusy(null)
    if (!r.success) return setMsg(r.error ?? 'Errore')
    setEnabled(nextEnabled)
    setMsg('Salvato')
  }

  const toggleSoldOutBanner = async () => {
    if (!soldOut) return
    setBusy('soldout')
    const r = await adminHideFoundersSoldOut(!soldOut.hidden)
    setBusy(null)
    setMsg(r.success ? (soldOut.hidden ? 'Banner «esauriti» di nuovo visibile' : 'Banner «esauriti» nascosto') : (r.error ?? 'Errore'))
    load()
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

  const grantExisting = async () => {
    if (!(await askConfirm('Includere nei posti gli iscritti attuali senza abbonamento attivo, in ordine di iscrizione? Il loro Piano Plus si attiva subito per 12 mesi. Chi è già attivo (es. i Pro regalati) resta fuori e resta com’è.'))) return
    setBusy('grant')
    const r = await adminGrantFoundersExisting()
    setBusy(null)
    setMsg(r.success ? `Fatto: ${r.included} iscritti inclusi nei posti, Plus attivato e avviso inviato.` : (r.error ?? 'Errore'))
    load()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-[var(--gold)]/50 bg-gradient-to-br from-[var(--gold-pale)]/60 to-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-gray-900">
          <Award className="h-5 w-5 text-[var(--gold)]" /> Promozione di lancio (Early Bird)
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Sconto commerciale del 100% sul Piano Plus per 12 mesi ai primi utenti in ordine cronologico di registrazione (art. 6 c.1 lett. c DPR
          430/2001). Si applica da solo al completamento dell&apos;iscrizione, il Plus si attiva subito e non si rinnova in automatico. In homepage
          e nella registrazione compare il contatore; le condizioni sono nei Termini (sezione «Promozione di lancio»). Staff, account KUMANI,
          agenti e chi ha già un abbonamento non contano.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-gray-700">
            Posti
            <input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="mt-1 block w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => save(!enabled)}
            className={`min-h-10 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50 ${enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {enabled ? 'Spegni la promozione' : 'Accendi la promozione'}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => save(enabled)} className="min-h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 disabled:opacity-50">
            Salva i posti
          </button>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
            {enabled ? 'Accesa' : 'Spenta'} · {counted}/{limit} posti presi
          </span>
        </div>
        {soldOut && (
          <div className="mt-4 rounded-lg border border-[var(--gold)]/40 bg-white/70 p-3 text-sm text-gray-700">
            🎉 <strong>Posti esauriti</strong> il {fmt(soldOut.fullAt)}
            {soldOut.hours !== null && <> (in {soldOut.hours <= 24 ? `${soldOut.hours} ore` : `${Math.ceil(soldOut.hours / 24)} giorni`})</>}. Il banner «esauriti» resta fino al{' '}
            {fmt(soldOut.bannerUntil)}
            {soldOut.hidden && <strong> (ora nascosto)</strong>}.
            <button
              type="button"
              disabled={busy !== null}
              onClick={toggleSoldOutBanner}
              className="ml-2 min-h-9 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 disabled:opacity-50"
            >
              {soldOut.hidden ? 'Mostra il banner' : 'Nascondi il banner'}
            </button>
          </div>
        )}
        <div className="mt-4 border-t border-[var(--gold)]/30 pt-4">
          <p className="text-sm text-gray-700">
            <strong>Iscritti attuali</strong>: chi non ha un abbonamento attivo entra nei {limit} posti in ordine di iscrizione (prima dei nuovi), con il
            Plus attivo subito. Chi è già attivo (per esempio i Pro che hai regalato) resta fuori. Premilo prima di accendere la promozione; si può
            ripremere senza doppioni.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={grantExisting}
            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-50"
          >
            {busy === 'grant' && <LoaderCircle className="h-4 w-4 animate-spin" />} Includi gli iscritti attuali senza abbonamento
          </button>
        </div>
        {msg && <p className="mt-3 text-sm font-semibold text-gray-800">{msg}</p>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="font-bold text-gray-900">
          Primi iscritti con lo sconto <span className="text-sm font-normal text-gray-500">({counted} su {limit}{early ? ` · ${early} fuori dai posti` : ''})</span>
        </p>
        {!founders ? (
          <p className="mt-2 text-sm text-gray-500">Caricamento...</p>
        ) : founders.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nessun Fondatore ancora.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 pr-3">N°</th>
                  <th className="py-2 pr-3">Chi</th>
                  <th className="py-2 pr-3">Dal</th>
                  <th className="py-2">Piano Plus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {founders.map((f, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 font-bold">{f.number ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-gray-900">{f.name}</div>
                      {f.email && <div className="text-xs text-gray-500">{f.email}</div>}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">{new Date(f.joinedAt).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })}</td>
                    <td className="py-2">
                      {f.voucher === 'redeemed' ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Attivo (sconto 100%)</span>
                      ) : f.voucher === 'active' ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Da attivare</span>
                      ) : (
                        <span className="text-xs text-gray-500">Aveva già un abbonamento</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

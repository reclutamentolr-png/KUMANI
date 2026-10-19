'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Download, Gift, LoaderCircle, MessageCircle, Pencil, Search, Trash2, X } from 'lucide-react'
import { notify } from '@/lib/adminNotify'
import { askConfirm } from '@/lib/confirm'
import { PUBLIC_SITE_URL } from '@/lib/siteUrl'
import { createPromoCodes, listPromoCodes, revokePromoCode, updatePromoCode, type PromoCode } from '@/app/actions/adminPromoCodes'

// Admin → «Codici omaggio»: abbonamenti di un anno regalati per promuovere
// KUMANI (es. al lancio), uno alla volta o tanti insieme, ognuno con il nome
// di chi lo riceve. Per ogni codice: se e quando è stato attivato, e da quale
// account. Si attivano come gli altri voucher: «Hai un codice?» in
// registrazione o in dashboard, oppure il link /register?voucher=CODICE.

const SITE = PUBLIC_SITE_URL.replace(/\/+$/, '')
const linkOf = (code: string) => `${SITE}/register?voucher=${encodeURIComponent(code)}`
const planLabel = (plan: string) => (plan === 'pro' ? 'Pro' : 'Base')
const when = (iso: string) => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const dayOf = (iso: string) => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))

const messageOf = (c: { code: string; plan: string; recipientName: string | null }) =>
  `Ciao${c.recipientName ? ` ${c.recipientName.split(' ')[0]}` : ''}! Ti regalo un anno di KUMANI ${planLabel(c.plan)}. ` +
  `Attivalo da qui: ${linkOf(c.code)}\nSe sei già iscritto, inserisci il codice ${c.code} in «Hai un codice?».`

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text)
    notify(done, 'success')
  } catch {
    notify('Copia non riuscita: seleziona il testo e copialo a mano.')
  }
}

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]'
const STATUS = {
  active: { label: 'Da attivare', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  redeemed: { label: 'Attivato', className: 'bg-green-50 text-green-800 ring-green-200' },
  revoked: { label: 'Revocato', className: 'bg-gray-100 text-gray-500 ring-gray-200' },
} as const

type Filter = 'all' | PromoCode['status']

export default function PromoCodesPanel() {
  const [codes, setCodes] = useState<PromoCode[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Nuovi codici
  const [plan, setPlan] = useState<'base' | 'pro'>('base')
  const [namesText, setNamesText] = useState('')
  const [quantity, setQuantity] = useState('')
  const [campaign, setCampaign] = useState('')
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] = useState<{ code: string; recipientName: string | null; plan: string }[]>([])
  // Elenco
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [editing, setEditing] = useState<{ id: string; recipientName: string; campaign: string } | null>(null)

  const load = async () => {
    const result = await listPromoCodes()
    if ('error' in result) setError(result.error)
    else {
      setError(null)
      setCodes(result.codes)
    }
  }

  useEffect(() => {
    let cancelled = false
    listPromoCodes().then((result) => {
      if (cancelled) return
      if ('error' in result) setError(result.error)
      else setCodes(result.codes)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const names = namesText.split(/\r?\n/).map((n) => n.trim()).filter(Boolean)
  const toCreate = names.length || Math.max(0, Math.floor(Number(quantity) || 0))

  const handleCreate = async () => {
    if (!toCreate) {
      notify('Scrivi almeno un nome (uno per riga) oppure quanti codici senza nome vuoi creare.')
      return
    }
    setCreating(true)
    const result = await createPromoCodes({ plan, names, quantity: Number(quantity) || 0, campaign })
    setCreating(false)
    if (!result.success) {
      notify(result.error)
      return
    }
    setJustCreated(result.created.map((c) => ({ ...c, plan })))
    setNamesText('')
    setQuantity('')
    notify(result.created.length === 1 ? 'Codice creato.' : `${result.created.length} codici creati.`, 'success')
    await load()
  }

  const handleSave = async () => {
    if (!editing) return
    const result = await updatePromoCode(editing.id, { recipientName: editing.recipientName, campaign: editing.campaign })
    if (!result.success) {
      notify(result.error || 'Salvataggio non riuscito.')
      return
    }
    setEditing(null)
    await load()
  }

  const handleRevoke = async (c: PromoCode) => {
    if (!(await askConfirm(`Revocare il codice ${c.code}${c.recipientName ? ` di ${c.recipientName}` : ''}? Non si potrà più attivare.`))) return
    const result = await revokePromoCode(c.id)
    if (!result.success) notify(result.error || 'Revoca non riuscita.')
    await load()
  }

  const campaigns = useMemo(() => [...new Set((codes ?? []).map((c) => c.campaign).filter((c): c is string => !!c))].sort(), [codes])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (codes ?? []).filter((c) => {
      if (filter !== 'all' && c.status !== filter) return false
      if (campaignFilter && c.campaign !== campaignFilter) return false
      if (!q) return true
      return [c.code, c.recipientName, c.campaign, c.redeemer?.name, c.redeemer?.email].some((v) => v?.toLowerCase().includes(q))
    })
  }, [codes, query, filter, campaignFilter])

  const counts = useMemo(() => {
    const scope = (codes ?? []).filter((c) => !campaignFilter || c.campaign === campaignFilter)
    return {
      all: scope.length,
      active: scope.filter((c) => c.status === 'active').length,
      redeemed: scope.filter((c) => c.status === 'redeemed').length,
      revoked: scope.filter((c) => c.status === 'revoked').length,
    }
  }, [codes, campaignFilter])
  const given = counts.all - counts.revoked
  const rate = given ? Math.round((counts.redeemed / given) * 100) : 0

  const exportCsv = () => {
    const cell = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      ['Codice', 'Assegnato a', 'Piano', 'Campagna', 'Stato', 'Creato il', 'Attivato il', 'Account che lo ha attivato', 'Email', 'Link'].map(cell).join(';'),
      ...visible.map((c) =>
        [c.code, c.recipientName, planLabel(c.plan), c.campaign, STATUS[c.status].label, when(c.createdAt), c.redeemedAt ? when(c.redeemedAt) : '', c.redeemer?.name, c.redeemer?.email, c.status === 'active' ? linkOf(c.code) : '']
          .map(cell)
          .join(';'),
      ),
    ]
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `KUMANI_codici_omaggio${campaignFilter ? `_${campaignFilter.replace(/[^\p{L}\p{N}]+/gu, '_')}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Gift className="h-7 w-7" />
          Codici omaggio
        </h2>
        <p className="mt-1 text-gray-600">
          Abbonamenti di un anno da regalare per far conoscere KUMANI, per esempio al lancio. Crea un codice alla volta o tanti insieme, ognuno con il nome della
          persona a cui lo dai: qui vedi se e quando lo ha attivato. Si attivano una sola volta, dal link o da «Hai un codice?».
        </p>
      </div>

      {/* Nuovi codici */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-bold text-gray-900">Crea codici</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="promo-names" className="text-sm font-semibold text-gray-700">
              A chi li dai <span className="font-normal text-gray-500">(un nome per riga: un codice per ogni nome)</span>
            </label>
            <textarea
              id="promo-names"
              rows={6}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              placeholder={'Mario Rossi\nGiulia Bianchi – Bar Centrale\nLuca Verdi'}
              className={inputClass}
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-gray-700">Piano</span>
              <div className="flex gap-2" role="group" aria-label="Piano">
                {(['base', 'pro'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    aria-pressed={plan === p}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${plan === p ? 'bg-[var(--ink)] text-white' : 'bg-white text-gray-800 ring-1 ring-gray-300 hover:ring-[var(--gold)]'}`}
                  >
                    {planLabel(p)} · 1 anno
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="promo-campaign" className="text-sm font-semibold text-gray-700">
                Campagna <span className="font-normal text-gray-500">(facoltativa, per ritrovarli)</span>
              </label>
              <input id="promo-campaign" list="promo-campaigns" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Es. Lancio Milano" maxLength={60} className={inputClass} />
              <datalist id="promo-campaigns">
                {campaigns.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="promo-quantity" className="text-sm font-semibold text-gray-700">
                Oppure quanti codici senza nome <span className="font-normal text-gray-500">(il nome si aggiunge dopo)</span>
              </label>
              <input
                id="promo-quantity"
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={names.length > 0}
                placeholder={names.length ? `${names.length} dai nomi` : 'Es. 50'}
                className={`${inputClass} disabled:bg-gray-50`}
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !toCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--ink)] px-5 py-2.5 font-medium text-white hover:bg-[var(--ink-soft)] disabled:opacity-50"
        >
          {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
          {creating ? 'Creazione…' : toCreate ? `Crea ${toCreate === 1 ? '1 codice' : `${toCreate} codici`} ${planLabel(plan)}` : 'Crea codici'}
        </button>

        {justCreated.length > 0 && (
          <div className="space-y-3 rounded-lg border border-[var(--gold)]/30 bg-[var(--gold-pale)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{justCreated.length === 1 ? 'Codice creato' : `${justCreated.length} codici creati`}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copy(justCreated.map((c) => `${c.recipientName ?? '—'}\t${c.code}\t${linkOf(c.code)}`).join('\n'), 'Elenco copiato.')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 ring-1 ring-gray-300 hover:ring-[var(--gold)]"
                >
                  <Copy className="h-3.5 w-3.5" /> Copia elenco
                </button>
                <button type="button" onClick={() => setJustCreated([])} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800">
                  <X className="h-3.5 w-3.5" /> Chiudi
                </button>
              </div>
            </div>
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
              {justCreated.map((c) => (
                <li key={c.code} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <code className="font-mono font-bold text-gray-900">{c.code}</code>
                  <span className="text-gray-700">{c.recipientName ?? <i className="text-gray-400">senza nome</i>}</span>
                  <button type="button" onClick={() => copy(messageOf(c), 'Messaggio copiato: incollalo su WhatsApp.')} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                    <MessageCircle className="h-3.5 w-3.5" /> Copia messaggio
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Riepilogo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Codici dati', value: given, hint: 'esclusi i revocati' },
          { label: 'Attivati', value: counts.redeemed, hint: given ? `${rate}% dei codici dati` : '—' },
          { label: 'Da attivare', value: counts.active, hint: 'ancora validi' },
          { label: 'Revocati', value: counts.revoked, hint: 'non più attivabili' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-600">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--ink)]">{s.value}</p>
            <p className="text-xs text-gray-500">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Elenco */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="promo-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca nome, codice, campagna o chi lo ha attivato"
              className={`${inputClass} pl-9`}
            />
          </div>
          <select id="promo-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="all">Tutti ({counts.all})</option>
            <option value="active">Da attivare ({counts.active})</option>
            <option value="redeemed">Attivati ({counts.redeemed})</option>
            <option value="revoked">Revocati ({counts.revoked})</option>
          </select>
          {campaigns.length > 0 && (
            <select id="promo-campaign-filter" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Tutte le campagne</option>
              {campaigns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={exportCsv}
            disabled={!visible.length}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800 ring-1 ring-gray-300 hover:ring-[var(--gold)] disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>

        {codes === null ? (
          <p className="flex items-center gap-2 p-6 text-sm text-gray-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
          </p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">{codes.length ? 'Nessun codice con questi filtri.' : 'Ancora nessun codice omaggio: creane uno qui sopra.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Assegnato a</th>
                  <th className="px-4 py-3">Codice</th>
                  <th className="px-4 py-3">Piano</th>
                  <th className="px-4 py-3">Stato</th>
                  <th className="px-4 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((c) => {
                  const isEditing = editing?.id === c.id
                  return (
                    <tr key={c.id} className="align-top">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              id={`promo-edit-name-${c.id}`}
                              autoFocus
                              value={editing.recipientName}
                              onChange={(e) => setEditing({ ...editing, recipientName: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                              placeholder="Nome"
                              maxLength={120}
                              className={inputClass}
                            />
                            <input
                              id={`promo-edit-campaign-${c.id}`}
                              list="promo-campaigns"
                              value={editing.campaign}
                              onChange={(e) => setEditing({ ...editing, campaign: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                              placeholder="Campagna"
                              maxLength={60}
                              className={inputClass}
                            />
                            <div className="flex gap-2">
                              <button type="button" onClick={handleSave} className="inline-flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white">
                                <Check className="h-3.5 w-3.5" /> Salva
                              </button>
                              <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900">
                                Annulla
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditing({ id: c.id, recipientName: c.recipientName ?? '', campaign: c.campaign ?? '' })}
                            className="group text-left"
                            title="Modifica nome e campagna"
                          >
                            <span className={`font-semibold ${c.recipientName ? 'text-gray-900' : 'italic text-gray-400'}`}>{c.recipientName ?? 'Senza nome'}</span>
                            <Pencil className="ml-1.5 inline h-3.5 w-3.5 text-gray-300 group-hover:text-[var(--gold)]" />
                            <span className="block text-xs text-gray-500">
                              {c.campaign ? `${c.campaign} · ` : ''}creato il {dayOf(c.createdAt)}
                            </span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-[13px] font-semibold text-gray-900">{c.code}</code>
                      </td>
                      <td className="px-4 py-3 font-semibold">{planLabel(c.plan)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
                        {c.status === 'redeemed' && (
                          <span className="mt-1 block text-xs text-gray-600">
                            il {c.redeemedAt ? when(c.redeemedAt) : '—'}
                            {c.redeemer && (
                              <>
                                <br />
                                da <b>{c.redeemer.name}</b>
                                {c.redeemer.email && <span className="text-gray-500"> · {c.redeemer.email}</span>}
                              </>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.status === 'active' && (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => copy(messageOf(c), 'Messaggio copiato: incollalo su WhatsApp.')}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 ring-1 ring-gray-300 hover:ring-[var(--gold)]"
                              title="Messaggio con il link, da incollare su WhatsApp o in una email"
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> Messaggio
                            </button>
                            <button
                              type="button"
                              onClick={() => copy(linkOf(c.code), 'Link copiato.')}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-800 ring-1 ring-gray-300 hover:ring-[var(--gold)]"
                            >
                              <Copy className="h-3.5 w-3.5" /> Link
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevoke(c)}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                              title="Revoca: il codice non si potrà più attivare"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

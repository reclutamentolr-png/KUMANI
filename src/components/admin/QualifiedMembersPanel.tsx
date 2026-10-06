'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Crown, Download, LoaderCircle, Mail, MessageCircle, Phone, Sparkles, Star } from 'lucide-react'
import { adminListQualifiedMembers, type QualifiedMember } from '@/app/actions/adminQualified'

const RANKS = [
  { key: 'diamond_star', label: 'Kuman Black', Icon: Crown, chip: 'bg-gray-900 text-amber-300' },
  { key: 'shining_star', label: 'Kuman Star', Icon: Sparkles, chip: 'bg-amber-100 text-amber-800' },
  { key: 'rising_star', label: 'Kuman Green', Icon: Star, chip: 'bg-emerald-100 text-emerald-800' },
] as const
type Filter = (typeof RANKS)[number]['key'] | 'all'

const day = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
const topRank = (m: QualifiedMember) => RANKS.find((r) => m.ranks?.[r.key]) ?? RANKS[2]
const waLink = (phone: string) => {
  const digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
  return `https://wa.me/${digits.startsWith('39') || digits.length > 10 ? digits : `39${digits}`}`
}

// Admin → Punti e premi → Qualificati: chi ha raggiunto le qualifiche (i
// Kuman Black per primi), con i dati per contattarli. La vetrina nel Kumano
// del Giorno, l'invito all'evento annuale e il Consiglio dei Black li
// organizza lo Staff partendo da qui.
export default function QualifiedMembersPanel() {
  const [members, setMembers] = useState<QualifiedMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('diamond_star')

  const load = useCallback(async () => {
    const result = await adminListQualifiedMembers()
    setMembers(result.members)
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono, come gli altri pannelli)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: members?.length ?? 0 }
    for (const r of RANKS) c[r.key] = (members ?? []).filter((m) => topRank(m).key === r.key).length
    return c
  }, [members])
  const shown = (members ?? []).filter((m) => filter === 'all' || topRank(m).key === filter)

  const exportCsv = () => {
    const header = ['Nome', 'Cognome', 'Email', 'Telefono', 'Città', 'Provincia', 'Paese', 'Codice', 'Piano', 'Qualifica', 'Data qualifica', 'Attivazioni', 'KU Points confermati', 'Voucher premio', 'Voucher usati']
    const rows = shown.map((m) => {
      const r = topRank(m)
      return [m.first_name, m.last_name, m.email, m.phone, m.city, m.province, m.country, m.referral_code, m.plan, r.label, m.ranks?.[r.key] ? day(m.ranks[r.key]) : '', m.activations, m.confirmed_points, m.vouchers_total, m.vouchers_used]
    })
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `kumani-qualificati-${filter}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Crown className="h-7 w-7 text-amber-500" /> Qualificati
        </h2>
        <p className="mt-1 text-gray-600">
          Chi ha raggiunto Kuman Green, Star o Black, con i dati per contattarli. Ai Kuman Black spettano anche la vetrina nel Kumano del
          Giorno, l’invito all’evento annuale KUMANI e il Consiglio dei Black: li organizza lo Staff partendo da questo elenco. Qualifiche e
          numeri contano solo attivazioni e KU Points confermati (passati i giorni del recesso).
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[...RANKS, { key: 'all' as const, label: 'Tutti' }].map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setFilter(r.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${filter === r.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {r.label} <span className="opacity-70">({counts[r.key] ?? 0})</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!shown.length}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Esporta CSV
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {members === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nessuno con questa qualifica.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((m) => {
            const r = topRank(m)
            const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || '—'
            return (
              <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                      {name}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.chip}`}>
                        <r.Icon className="h-3.5 w-3.5" /> {r.label}
                      </span>
                      <span className="text-xs font-normal text-gray-500">
                        {m.referral_code} · piano {m.plan === 'none' ? 'Free' : m.plan}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{[m.city, m.province, m.country].filter(Boolean).join(', ') || '—'}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {RANKS.filter((x) => m.ranks?.[x.key])
                        .map((x) => `${x.label} il ${day(m.ranks[x.key])}`)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-600">
                    <p>
                      <b className="text-gray-900">{m.activations}</b> attivazioni · <b className="text-gray-900">{m.confirmed_points}</b> KU Points
                    </p>
                    <p>
                      Voucher premio: {m.vouchers_used}/{m.vouchers_total} usati{m.black_plus > 0 ? ` · Black continuo ×${m.black_plus}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3 text-sm">
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50">
                      <Mail className="h-4 w-4" /> {m.email}
                    </a>
                  )}
                  {m.phone && (
                    <>
                      <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50">
                        <Phone className="h-4 w-4" /> {m.phone}
                      </a>
                      <a
                        href={waLink(m.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </a>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

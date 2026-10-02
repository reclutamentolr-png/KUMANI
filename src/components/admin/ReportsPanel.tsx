'use client'

import { useEffect, useState } from 'react'
import { BarChart3, LoaderCircle } from 'lucide-react'
import {
  adminReportAgents,
  adminReportCommunityVouchers,
  adminReportDonors,
  adminReportPasses,
  adminReportPoints,
  adminReportShops,
  type AgentRanking,
  type DonorRanking,
  type PassReport,
  type PointsRanking,
  type ReportPerson,
  type ShopReport,
  type VoucherRanking,
} from '@/app/actions/adminReports'

export type ReportTab = 'passes' | 'shops' | 'agents' | 'vouchers' | 'donors' | 'points'

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'passes', label: 'Pass servizi' },
  { key: 'shops', label: 'Negozi (lotti voucher)' },
  { key: 'agents', label: 'Agenti' },
  { key: 'vouchers', label: 'Voucher community (top 20)' },
  { key: 'donors', label: 'Donatori (top 50)' },
  { key: 'points', label: 'KU Points e KU Karma (top 100)' },
]

const eur = (cents: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const day = (iso: string) => new Date(iso).toLocaleDateString('it-IT')
const num = (n: number) => n.toLocaleString('it-IT')

function Who({ person }: { person: ReportPerson }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate font-semibold text-gray-900">{person.name}</span>
      <span className="block truncate text-xs text-gray-500">
        {person.code ?? ''}
        {person.email ? ` · ${person.email}` : ''}
      </span>
    </span>
  )
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">{empty}</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-4 py-3 font-semibold ${i > 1 ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((cells, r) => (
            <tr key={r} className="hover:bg-gray-50">
              {cells.map((cell, i) => (
                <td key={i} className={`px-4 py-2.5 align-middle ${i > 1 ? 'text-right tabular-nums' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const Rank = ({ n }: { n: number }) => (
  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${n <= 3 ? 'bg-[var(--gold)] text-white' : 'bg-gray-100 text-gray-600'}`}>
    {n}
  </span>
)

// Admin → Statistiche e classifiche: chi usa e fa rendere le funzioni di
// KUMANI (Pass, negozi, agenti, voucher, donazioni, punti).
export default function ReportsPanel({ initialTab = 'passes' }: { initialTab?: ReportTab }) {
  const [tab, setTab] = useState<ReportTab>(initialTab)
  const [data, setData] = useState<Partial<Record<ReportTab, unknown>>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (data[tab] !== undefined) return
    const load = {
      passes: adminReportPasses,
      shops: adminReportShops,
      agents: adminReportAgents,
      vouchers: adminReportCommunityVouchers,
      donors: adminReportDonors,
      points: adminReportPoints,
    }[tab]
    load().then((result) => {
      if ('error' in result) setError(result.error)
      else {
        setError(null)
        setData((prev) => ({ ...prev, [tab]: result }))
      }
    })
  }, [tab, data])

  const current = data[tab]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <BarChart3 className="h-7 w-7" /> Statistiche e classifiche
        </h2>
        <p className="mt-1 text-gray-600">Chi usa e fa crescere KUMANI: utile per capire cosa rende e per premiare chi si impegna.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === key ? 'border-[var(--gold)] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {current === undefined && !error && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
        </p>
      )}

      {tab === 'passes' && current !== undefined && <Passes report={current as PassReport} />}
      {tab === 'shops' && current !== undefined && (
        <>
          <p className="text-sm text-gray-600">Negozi ordinati per voucher attivati dai loro clienti: i primi sono quelli da premiare.</p>
          <Table
            head={['#', 'Negozio', 'Lotti', 'Voucher', 'Attivati', '% attivati', 'Incassato']}
            empty="Nessun lotto di voucher venduto ai negozi."
            rows={(current as { shops: ShopReport }).shops.map((s, i) => [
              <Rank key="r" n={i + 1} />,
              <span key="n" className="font-semibold text-gray-900">{s.business}</span>,
              num(s.batches),
              num(s.vouchers),
              <b key="a">{num(s.redeemed)}</b>,
              s.vouchers ? `${Math.round((s.redeemed / s.vouchers) * 100)}%` : '—',
              eur(s.revenueCents),
            ])}
          />
        </>
      )}
      {tab === 'agents' && current !== undefined && (
        <>
          <p className="text-sm text-gray-600">
            Agenti ordinati per attivazioni (prime vendite non annullate). Ogni agente vede la propria posizione nella sua zona riservata.
          </p>
          <Table
            head={['#', 'Agente', 'Attivazioni', 'Rinnovi', 'Clienti', 'Clienti attivi', 'Provvigioni']}
            empty="Nessun agente registrato."
            rows={(current as { agents: AgentRanking }).agents.map((a, i) => [
              <Rank key="r" n={i + 1} />,
              <span key="n" className="block">
                <Who person={a.person} />
                <span className="text-xs text-gray-500">
                  {a.agentCode}
                  {!a.active && ' · sospeso'}
                </span>
              </span>,
              <b key="f">{num(a.firstSales)}</b>,
              num(a.renewals),
              num(a.customers),
              num(a.activeCustomers),
              eur(a.commissionCents),
            ])}
          />
        </>
      )}
      {tab === 'vouchers' && current !== undefined && (
        <>
          <p className="text-sm text-gray-600">I 20 Kumani con più voucher attivati (creati con il credito dei KU Points, esclusi omaggi dello Staff e lotti negozi).</p>
          <Table
            head={['#', 'Kumano', 'Attivati', 'Creati', 'Da regalare', 'Da vendere']}
            empty="Nessun voucher creato dalla community."
            rows={(current as { top: VoucherRanking }).top.map((v, i) => [
              <Rank key="r" n={i + 1} />,
              <Who key="w" person={v.person} />,
              <b key="a">{num(v.redeemed)}</b>,
              num(v.created),
              num(v.gifted),
              num(v.sold),
            ])}
          />
        </>
      )}
      {tab === 'donors' && current !== undefined && (
        <>
          <p className="text-sm text-gray-600">I 50 Kumani che hanno donato di più con i loro KU Points (valore versato da KUMANI all&apos;associazione).</p>
          <Table
            head={['#', 'Kumano', 'Donato', 'KU Points donati', 'Donazioni', 'Dal suo abbonamento']}
            empty="Nessuna donazione di KU Points finora."
            rows={(current as { top: DonorRanking }).top.map((d, i) => [
              <Rank key="r" n={i + 1} />,
              <Who key="w" person={d.person} />,
              <b key="c">{eur(d.donatedCents)}</b>,
              num(d.points),
              num(d.donations),
              eur(d.subscriptionCents),
            ])}
          />
        </>
      )}
      {tab === 'points' && current !== undefined && (
        <>
          <p className="text-sm text-gray-600">
            I 100 Kumani con più KU Points guadagnati da quando sono iscritti, con i KU Karma guadagnati in totale, ancora disponibili e già usati.
          </p>
          <Table
            head={['#', 'Kumano', 'KU Points guadagnati', 'KU Points ora', 'KU Karma totali', 'KU Karma ora', 'KU Karma usati', 'Iscritto dal']}
            empty="Nessun dato."
            rows={(current as { top: PointsRanking }).top.map((p, i) => [
              <Rank key="r" n={i + 1} />,
              <Who key="w" person={p.person} />,
              <b key="e">{num(p.kuPointsEarned)}</b>,
              num(p.kuPointsBalance),
              num(p.karmaEarned),
              num(p.karmaBalance),
              num(p.karmaUsed),
              day(p.joinedAt),
            ])}
          />
        </>
      )}
    </div>
  )
}

function Passes({ report }: { report: PassReport }) {
  const sold = report.byTool.reduce((n, t) => n + t.sold, 0)
  const codes = report.byTool.reduce((n, t) => n + t.codes, 0)
  const cents = report.byTool.reduce((n, t) => n + t.soldCents, 0)
  const active = report.byTool.reduce((n, t) => n + t.active, 0)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Pass venduti con carta', num(sold)],
          ['Incassato', eur(cents)],
          ['Attivati con codice', num(codes)],
          ['Attivi oggi', num(active)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
      <h3 className="font-bold text-gray-900">Per servizio</h3>
      <Table
        head={['#', 'Servizio', 'Venduti', 'Incassato', 'Con codice', 'Attivi oggi']}
        empty="Nessun pass attivato finora."
        rows={report.byTool.map((t, i) => [<Rank key="r" n={i + 1} />, <b key="t">{t.title}</b>, num(t.sold), eur(t.soldCents), num(t.codes), num(t.active)])}
      />
      <h3 className="font-bold text-gray-900">Ultimi pass</h3>
      <Table
        head={['Data', 'Kumano', 'Servizio', 'Origine', 'Importo', 'Scadenza']}
        empty="Nessun pass attivato finora."
        rows={report.recent.map((p) => [
          day(p.createdAt),
          <Who key="w" person={p.person} />,
          p.title,
          p.revoked ? 'Rimborsato' : p.source === 'stripe' ? 'Carta' : p.source === 'code' ? 'Codice' : 'Staff',
          p.amountCents ? eur(p.amountCents) : '—',
          day(p.expiresAt),
        ])}
      />
    </div>
  )
}

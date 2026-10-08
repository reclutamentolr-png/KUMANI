'use client'

import { useEffect, useState } from 'react'
import { Activity, Crown, Gift, Lock, RefreshCw, Sparkles, Ticket, User, Users } from 'lucide-react'
import { adminOverview, type AdminOverview, type OverviewTool, type PaidPeriod } from '@/app/actions/adminOverview'

// Admin → Panoramica: tre sezioni a riquadri quadrati.
// Utenti (Free, Base, Pro, online ora, bloccati) · Servizi più usati per
// fascia (Gratis, Base, Pro) · Abbonamenti pagati (oggi, settimana, mese) e
// attivazioni con voucher.

const eur = (cents: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Tile({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  pulse,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ReactNode
  tone?: 'default' | 'gold' | 'ink' | 'green' | 'red'
  pulse?: boolean
}) {
  const tones = {
    default: 'bg-white border-gray-200 text-gray-900',
    gold: 'bg-[var(--gold-pale)]/50 border-[var(--gold)]/40 text-[var(--ink)]',
    ink: 'bg-[var(--ink)] border-[var(--ink)] text-[var(--gold-bright)]',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    red: 'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={`flex aspect-square min-w-0 flex-col justify-between rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {pulse && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />}
        {icon}
        <span className="line-clamp-2 leading-tight">{label}</span>
      </div>
      <div className="text-3xl font-bold leading-none sm:text-4xl">{value}</div>
      <div className="min-h-[2rem] text-xs leading-4 opacity-75">{sub}</div>
    </div>
  )
}

function ToolBand({ label, tools, tone, days }: { label: string; tools: OverviewTool[]; tone: 'default' | 'gold' | 'ink'; days: number }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tools.map((tool, i) => (
          <Tile
            key={tool.tool}
            tone={tone}
            label={`#${i + 1}`}
            value={<span className="line-clamp-2 block text-lg leading-tight sm:text-xl">{tool.title}</span>}
            sub={
              <>
                <span className="text-base font-bold">{tool.users}</span> {tool.users === 1 ? 'persona' : 'persone'}
                <br />
                {tool.useDays} giorni d&apos;uso in {days} gg
              </>
            }
          />
        ))}
        {Array.from({ length: Math.max(5 - tools.length, 0) }, (_, i) => (
          <div key={`empty-${i}`} className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
            #{tools.length + i + 1}
            <br />
            Nessun altro servizio usato negli ultimi {days} giorni
          </div>
        ))}
      </div>
    </div>
  )
}

function PaidTile({ label, period, error }: { label: string; period: PaidPeriod; error: boolean }) {
  return (
    <Tile
      tone="gold"
      label={label}
      value={error ? '—' : period.count}
      sub={
        error ? (
          'Stripe non risponde'
        ) : (
          <>
            <span className="text-base font-bold">{eur(period.cents)}</span>
            <br />
            {period.newCount} nuovi · {period.renewalCount} rinnovi
          </>
        )
      }
    />
  )
}

export default function AdminOverviewPanel({ userName, onlineUsers }: { userName: string; onlineUsers: number }) {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setData(await adminOverview())
    setLoading(false)
  }
  useEffect(() => {
    // Caricamento all'apertura della sezione
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  const dash = '…'
  const u = data?.users
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--ink)] p-6 text-white shadow-lg sm:p-8">
        <div>
          <h2 className="mb-1 text-3xl font-bold">Benvenuto, {userName.split(' ')[0]}!</h2>
          <p className="text-white/80">Ecco lo stato attuale della tua piattaforma Kumani.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-[var(--gold-bright)] hover:bg-white/10 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Aggiorna
        </button>
      </div>

      <Section title="Utenti" hint={u ? `${u.total} registrati in tutto` : undefined}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile label="Free" icon={<User className="h-3.5 w-3.5" />} value={u ? u.free : dash} sub={u && u.proTrial > 0 ? `di cui ${u.proTrial} in prova Pro` : 'Senza abbonamento'} />
          <Tile tone="gold" label="Base" icon={<Users className="h-3.5 w-3.5" />} value={u ? u.base : dash} sub="Abbonamento Base attivo" />
          <Tile tone="ink" label="Pro" icon={<Crown className="h-3.5 w-3.5" />} value={u ? u.pro : dash} sub="Abbonamento Pro attivo" />
          <Tile tone="green" pulse label="Online ora" icon={<Activity className="h-3.5 w-3.5" />} value={onlineUsers} sub="Ultimi 15 minuti" />
          <Tile tone="red" label="Bloccati" icon={<Lock className="h-3.5 w-3.5" />} value={u ? u.blocked : dash} sub="Account bloccati" />
        </div>
      </Section>

      <Section title="Servizi" hint="I 5 più usati per fascia: persone diverse che li hanno aperti o usati negli ultimi 30 giorni">
        {data ? (
          <div className="space-y-5">
            <ToolBand label="Gratis" tools={data.tools.free} tone="default" days={data.tools.days} />
            <ToolBand label="Base" tools={data.tools.base} tone="gold" days={data.tools.days} />
            <ToolBand label="Pro" tools={data.tools.pro} tone="ink" days={data.tools.days} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">{loading ? 'Caricamento…' : 'Dati non disponibili.'}</p>
        )}
      </Section>

      <Section title="Abbonamenti / Attivazioni" hint="Pagati: abbonamenti Base e Pro, passaggi a Pro e rinnovi pagati con Stripe (orario italiano)">
        {data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <PaidTile label="Pagati oggi" period={data.paid.today} error={data.paid.error} />
              <PaidTile label="Pagati in settimana" period={data.paid.week} error={data.paid.error} />
              <PaidTile label="Pagati nel mese" period={data.paid.month} error={data.paid.error} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Tile
                tone="ink"
                label="Voucher abbonamenti"
                icon={<Ticket className="h-3.5 w-3.5" />}
                value={data.vouchers.plans.redeemed}
                sub={
                  <>
                    attivati (voucher e regali Base/Pro)
                    <br />
                    {data.vouchers.plans.available} ancora da usare
                  </>
                }
              />
              <Tile
                tone="ink"
                label="Voucher servizi singoli"
                icon={<Gift className="h-3.5 w-3.5" />}
                value={data.vouchers.passes.redeemed}
                sub={
                  <>
                    Pass attivati con un codice
                    <br />
                    {data.vouchers.passes.available} ancora da usare
                  </>
                }
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{loading ? 'Caricamento…' : 'Dati non disponibili.'}</p>
        )}
      </Section>
      <p className="flex items-center gap-1.5 text-xs text-gray-400">
        <Sparkles className="h-3.5 w-3.5" /> I servizi aperti si contano da oggi; prima valeva solo l&apos;uso che dà i KU Karma.
      </p>
    </div>
  )
}

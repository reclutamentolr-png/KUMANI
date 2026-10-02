'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Link2,
  LogOut,
  MessageCircle,
  Receipt,
  Share2,
  Store,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import Logo from '@/components/Logo'
import LocalizedLink from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/client'
import { formatEuroCents } from '@/lib/agents'
import type { AgentOverview } from '@/app/actions/agents'

type Commission = AgentOverview['commissions'][number]
type StateFilter = 'all' | Commission['state']

const PAGE = 20
const STATES: Commission['state'][] = ['pending', 'matured', 'paid', 'cancelled']

// ── Formattazione (fuso di Roma, così server e browser coincidono) ──────

function useFormatters() {
  const locale = useLocale()
  return useMemo(() => {
    const dateFmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome' })
    // Le date "solo giorno" (YYYY-MM-DD) non vanno spostate dal fuso orario
    const dayFmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    const pctFmt = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 })
    const numFmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
    return {
      locale,
      date: (iso: string) => dateFmt.format(new Date(iso)),
      day: (ymd: string) => dayFmt.format(new Date(`${ymd.slice(0, 10)}T00:00:00Z`)),
      euro: (cents: number) => formatEuroCents(cents, locale),
      pct: (pct: number) => pctFmt.format(pct / 100),
      plain: (cents: number) => numFmt.format(cents / 100),
    }
  }, [locale])
}

// Condivisione nativa disponibile solo nel browser (sul server: no)
const noopSubscribe = () => () => {}
function useCanShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false
  )
}

// ── Pulsante di uscita (usato anche nella pagina "account sospeso") ─────

export function AgentLogoutButton({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const t = useTranslations('agentArea')
  const [busy, setBusy] = useState(false)

  const logout = async () => {
    setBusy(true)
    // Si chiude solo la sessione di questo browser
    await createClient().auth.signOut({ scope: 'local' })
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- ricarica completa per azzerare lo stato della sessione
    window.location.href = '/login'
  }

  const cls =
    variant === 'dark'
      ? 'border-[var(--gold)]/40 text-[var(--gold-pale)] hover:bg-white/10'
      : 'border-[var(--ink)]/20 text-[var(--ink)] hover:bg-[var(--gold-pale)]'

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${cls}`}
    >
      <LogOut className="h-4 w-4" />
      {t('logout')}
    </button>
  )
}

// ── Mattoni grafici ─────────────────────────────────────────────────────

function Section({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          <span className="text-[var(--gold)]">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function StateBadge({ c }: { c: Commission }) {
  const t = useTranslations('agentArea')
  const f = useFormatters()
  const styles: Record<Commission['state'], string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    matured: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    paid: 'bg-[var(--ink)] text-[var(--gold-bright)] border-[var(--ink)]',
    cancelled: 'bg-red-50 text-red-700 border-red-200 line-through',
  }
  const label = c.state === 'pending' ? t('commissions.state.pendingUntil', { date: f.date(c.maturesAt) }) : t(`commissions.state.${c.state}`)
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[c.state]}`}>{label}</span>
}

function ShowMore({ onClick, remaining }: { onClick: () => void; remaining: number }) {
  const t = useTranslations('agentArea')
  return (
    <div className="mt-4 text-center">
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg border border-[var(--gold)]/50 px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
      >
        {t('showMore', { count: remaining })}
      </button>
    </div>
  )
}

// ── Il tuo link ─────────────────────────────────────────────────────────

function LinkCard({ agent }: { agent: AgentOverview['agent'] }) {
  const t = useTranslations('agentArea')
  const canShare = useCanShare()
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(agent.link, { width: 480, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#171717', light: '#ffffff' } })
      .then((url) => {
        if (alive) setQr(url)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [agent.link])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(agent.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Appunti non disponibili: il link resta selezionabile a mano
    }
  }

  const downloadQr = () => {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = `KUMANI-${agent.code}.png`
    a.click()
  }

  const message = t('link.shareMessage', { link: agent.link })

  const share = async () => {
    try {
      await navigator.share({ title: t('link.shareTitle'), text: t('link.shareText'), url: agent.link })
    } catch {
      // Condivisione annullata dall'utente
    }
  }

  const btn =
    'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50'

  return (
    <Section icon={<Link2 className="h-5 w-5" />} title={t('link.title')}>
      <div className="grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('link.code')}</p>
            <p className="font-mono text-2xl font-bold tracking-widest text-[var(--ink)]">{agent.code}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('link.fullLink')}</p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={agent.link}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t('link.fullLink')}
                className="min-w-0 flex-1 rounded-lg border border-[var(--gold)]/40 bg-white px-3 py-2 font-mono text-sm text-[var(--ink)]"
              />
              <button type="button" onClick={copy} className={`${btn} bg-[var(--ink)] text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]`}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t('link.copied') : t('link.copy')}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canShare && (
              <button type="button" onClick={share} className={`${btn} border border-[var(--gold)]/50 text-[var(--ink)] hover:bg-[var(--gold-pale)]`}>
                <Share2 className="h-4 w-4" />
                {t('link.share')}
              </button>
            )}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn} bg-[#25D366] text-white hover:bg-[#1ebe5b]`}
            >
              <MessageCircle className="h-4 w-4" />
              {t('link.whatsapp')}
            </a>
          </div>
          <p className="rounded-lg bg-[var(--gold-pale)]/60 p-3 text-sm text-[var(--ink)]">{t('link.note')}</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex h-44 w-44 items-center justify-center rounded-xl border border-[var(--gold)]/30 bg-white p-2">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- immagine generata nel browser come data URL
              <img src={qr} alt={t('link.qrAlt')} className="h-full w-full" />
            ) : (
              <span className="text-xs text-[var(--muted)]">{t('link.qrLoading')}</span>
            )}
          </div>
          <button type="button" onClick={downloadQr} disabled={!qr} className={`${btn} border border-[var(--gold)]/50 text-[var(--ink)] hover:bg-[var(--gold-pale)]`}>
            <Download className="h-4 w-4" />
            {t('link.downloadQr')}
          </button>
        </div>
      </div>
    </Section>
  )
}

// ── Periodi ─────────────────────────────────────────────────────────────

// Le proprie attivazioni e la posizione tra gli agenti attivi
function Ranking({ ranking }: { ranking: AgentOverview['ranking'] }) {
  const t = useTranslations('agentArea')
  const stats = [
    { key: 'activations', value: ranking.activations },
    { key: 'renewals', value: ranking.renewals },
    { key: 'customers', value: ranking.customers },
    { key: 'activeCustomers', value: ranking.activeCustomers },
  ] as const
  return (
    <Section icon={<Trophy className="h-5 w-5" />} title={t('ranking.title')}>
      {ranking.position !== null && ranking.total > 0 && (
        <p className="mb-4 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/60 px-4 py-3 text-base font-bold text-[var(--ink)]">
          {t('ranking.position', { position: ranking.position, total: ranking.total })}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ key, value }) => (
          <div key={key} className="rounded-xl border border-[var(--gold)]/25 bg-white p-4 text-center">
            <p className="text-2xl font-bold text-[var(--ink)]">{value}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{t(`ranking.${key}`)}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{t('ranking.hint')}</p>
    </Section>
  )
}

function Periods({ periods }: { periods: AgentOverview['periods'] }) {
  const t = useTranslations('agentArea')
  const f = useFormatters()
  const keys = ['today', 'week', 'month', 'year'] as const
  return (
    <Section icon={<TrendingUp className="h-5 w-5" />} title={t('periods.title')}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {keys.map((k) => {
          const p = periods[k]
          return (
            <div key={k} className="min-w-0 rounded-xl bg-[var(--ink)] p-3 text-white sm:p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-bright)]">{t(`periods.${k}`)}</p>
              <p className="mt-2 text-xl font-bold sm:text-2xl">{t('periods.sales', { count: p.sales })}</p>
              {/* Sul telefono etichetta sopra e cifra sotto: le cifre lunghe non escono dal riquadro */}
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-2">
                  <dt className="text-white/60">{t('periods.revenue')}</dt>
                  <dd className="font-semibold">{f.euro(p.netCents)}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-2">
                  <dt className="text-white/60">{t('periods.commission')}</dt>
                  <dd className="font-semibold text-[var(--gold-bright)]">{f.euro(p.commissionCents)}</dd>
                </div>
              </dl>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ── Portafoglio ─────────────────────────────────────────────────────────

function WalletCard({ wallet, agent }: { wallet: AgentOverview['wallet']; agent: AgentOverview['agent'] }) {
  const t = useTranslations('agentArea')
  const f = useFormatters()
  const items = [
    { key: 'pending', cents: wallet.pendingCents, hint: t('wallet.pendingHint'), cls: 'border-amber-300 bg-amber-50' },
    { key: 'matured', cents: wallet.maturedCents, hint: t('wallet.maturedHint'), cls: 'border-emerald-300 bg-emerald-50' },
    { key: 'paid', cents: wallet.paidCents, hint: t('wallet.paidHint'), cls: 'border-[var(--gold)]/40 bg-[var(--gold-pale)]/50' },
  ] as const
  return (
    <Section icon={<Wallet className="h-5 w-5" />} title={t('wallet.title')}>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((i) => (
          <div key={i.key} className={`rounded-xl border p-4 ${i.cls}`}>
            <p className="text-sm font-semibold text-[var(--ink)]">{t(`wallet.${i.key}`)}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{f.euro(i.cents)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{i.hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-sm font-semibold text-[var(--gold-bright)]">
          {t('wallet.rateFirst', { pct: f.pct(agent.commissionFirstPct) })}
        </span>
        <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-sm font-semibold text-[var(--gold-bright)]">
          {t('wallet.rateRenewal', { pct: f.pct(agent.commissionRenewalPct) })}
        </span>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{t('wallet.explanation')}</p>
    </Section>
  )
}

// ── Clienti ─────────────────────────────────────────────────────────────

function Customers({ customers }: { customers: AgentOverview['customers'] }) {
  const t = useTranslations('agentArea')
  const f = useFormatters()
  const [shown, setShown] = useState(PAGE)
  const active = customers.filter((c) => c.active).length
  return (
    <Section icon={<Users className="h-5 w-5" />} title={t('customers.title')}>
      <p className="mb-3 text-sm text-[var(--muted)]">{t('customers.summary', { total: customers.length, active })}</p>
      {customers.length === 0 ? (
        <p className="rounded-lg bg-[var(--gold-pale)]/40 p-4 text-sm text-[var(--ink)]">{t('customers.empty')}</p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--gold)]/15">
            {customers.slice(0, shown).map((c, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--ink)]">{c.name}</p>
                  <p className="text-xs text-[var(--muted)]">{t('customers.joined', { date: f.date(c.joinedAt) })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--ink)]">{c.plan ? t(`plan.${c.plan}`) : t('customers.noPlan')}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c.active ? t('customers.active') : t('customers.inactive')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {customers.length > shown && <ShowMore remaining={customers.length - shown} onClick={() => setShown((n) => n + PAGE)} />}
        </>
      )}
    </Section>
  )
}

// ── Provvigioni ─────────────────────────────────────────────────────────

function csvCell(v: string): string {
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function Commissions({ commissions, code }: { commissions: AgentOverview['commissions']; code: string }) {
  const t = useTranslations('agentArea')
  const f = useFormatters()
  const [filter, setFilter] = useState<StateFilter>('all')
  const [shown, setShown] = useState(PAGE)

  const list = filter === 'all' ? commissions : commissions.filter((c) => c.state === filter)
  const plan = (c: Commission) => (c.plan ? t(`plan.${c.plan}`) : '')
  const stateText = (c: Commission) =>
    c.state === 'pending' ? t('commissions.state.pendingUntil', { date: f.date(c.maturesAt) }) : t(`commissions.state.${c.state}`)

  // Estratto conto CSV: separatore ";" e BOM UTF-8 per Excel in italiano
  const downloadCsv = () => {
    const header = [
      t('commissions.col.date'),
      t('commissions.col.customer'),
      t('commissions.col.kind'),
      t('commissions.col.plan'),
      t('commissions.col.net'),
      t('commissions.col.pct'),
      t('commissions.col.commission'),
      t('commissions.col.state'),
      t('commissions.col.maturesAt'),
      t('commissions.col.note'),
    ]
    const rows = list.map((c) => [
      f.date(c.createdAt),
      c.customer,
      t(`commissions.kind.${c.kind}`),
      plan(c),
      f.plain(c.netCents),
      f.pct(c.pct),
      f.plain(c.commissionCents),
      t(`commissions.state.${c.state}`),
      f.date(c.maturesAt),
      c.note ?? '',
    ])
    const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `KUMANI-${code}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const filters: StateFilter[] = ['all', ...STATES]

  return (
    <Section
      icon={<Receipt className="h-5 w-5" />}
      title={t('commissions.title')}
      action={
        <button
          type="button"
          onClick={downloadCsv}
          disabled={list.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)] disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {t('commissions.csv')}
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('commissions.filterLabel')}>
        {filters.map((s) => {
          const count = s === 'all' ? commissions.length : commissions.filter((c) => c.state === s).length
          const on = filter === s
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setFilter(s)
                setShown(PAGE)
              }}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
                on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/40 text-[var(--ink)] hover:bg-[var(--gold-pale)]'
              }`}
            >
              {t(`commissions.filter.${s}`)} ({count})
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <p className="rounded-lg bg-[var(--gold-pale)]/40 p-4 text-sm text-[var(--ink)]">{t('commissions.empty')}</p>
      ) : (
        <>
          {/* Schede su mobile */}
          <ul className="space-y-3 md:hidden">
            {list.slice(0, shown).map((c) => (
              <li key={c.id} className="rounded-xl border border-[var(--gold)]/25 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--ink)]">{c.customer}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {f.date(c.createdAt)} · {t(`commissions.kind.${c.kind}`)}
                      {c.plan ? ` · ${plan(c)}` : ''}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-[var(--ink)]">{f.euro(c.commissionCents)}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t('commissions.col.net')}: {f.euro(c.netCents)} · {f.pct(c.pct)}
                </p>
                <div className="mt-2">
                  <StateBadge c={c} />
                </div>
                {c.note && <p className="mt-2 text-xs italic text-[var(--muted)]">{c.note}</p>}
              </li>
            ))}
          </ul>

          {/* Tabella da tablet in su */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--gold)]/30 text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="py-2 pr-3">{t('commissions.col.date')}</th>
                  <th className="py-2 pr-3">{t('commissions.col.customer')}</th>
                  <th className="py-2 pr-3">{t('commissions.col.kind')}</th>
                  <th className="py-2 pr-3">{t('commissions.col.plan')}</th>
                  <th className="py-2 pr-3 text-right">{t('commissions.col.net')}</th>
                  <th className="py-2 pr-3 text-right">{t('commissions.col.pct')}</th>
                  <th className="py-2 pr-3 text-right">{t('commissions.col.commission')}</th>
                  <th className="py-2">{t('commissions.col.state')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--gold)]/15">
                {list.slice(0, shown).map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-3">{f.date(c.createdAt)}</td>
                    <td className="py-2 pr-3">
                      <span className="font-semibold text-[var(--ink)]">{c.customer}</span>
                      {c.note && <span className="block text-xs italic text-[var(--muted)]">{c.note}</span>}
                    </td>
                    <td className="py-2 pr-3">{t(`commissions.kind.${c.kind}`)}</td>
                    <td className="py-2 pr-3">{plan(c)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right">{f.euro(c.netCents)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right">{f.pct(c.pct)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right font-bold text-[var(--ink)]">{f.euro(c.commissionCents)}</td>
                    <td className="py-2" title={stateText(c)}>
                      <StateBadge c={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {list.length > shown && <ShowMore remaining={list.length - shown} onClick={() => setShown((n) => n + PAGE)} />}
        </>
      )}
    </Section>
  )
}

// ── Pagamenti ricevuti ──────────────────────────────────────────────────

function Payouts({ payouts }: { payouts: AgentOverview['payouts'] }) {
  const t = useTranslations('agentArea')
  const f = useFormatters()
  return (
    <Section icon={<Wallet className="h-5 w-5" />} title={t('payouts.title')}>
      {payouts.length === 0 ? (
        <p className="rounded-lg bg-[var(--gold-pale)]/40 p-4 text-sm text-[var(--ink)]">{t('payouts.empty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--gold)]/15">
          {payouts.map((p, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--ink)]">{f.day(p.paidOn)}</p>
                <p className="break-all text-xs text-[var(--muted)]">
                  {t('payouts.reference')}: {p.reference || t('payouts.noReference')}
                </p>
              </div>
              <p className="text-lg font-bold text-[var(--ink)]">{f.euro(p.amountCents)}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

// ── Pagina ──────────────────────────────────────────────────────────────

export default function AgentArea({ overview }: { overview: AgentOverview }) {
  const t = useTranslations('agentArea')
  const { agent } = overview

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="bg-[var(--ink)] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={44} priority />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--gold-bright)]">{t('title')}</p>
              <p className="truncate text-lg font-bold">{agent.name}</p>
              <p className="truncate text-xs text-white/60">
                {t(`regime.${agent.taxRegime}`)}
                {agent.businessName ? ` · ${agent.businessName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LocalizedLink
              href="/marketplace/preferiti"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-bright)]"
            >
              <Store className="h-4 w-4" />
              {t('services')}
            </LocalizedLink>
            <AgentLogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <LinkCard agent={agent} />
        <Periods periods={overview.periods} />
        <Ranking ranking={overview.ranking} />
        <WalletCard wallet={overview.wallet} agent={agent} />
        <Commissions commissions={overview.commissions} code={agent.code} />
        <Customers customers={overview.customers} />
        <Payouts payouts={overview.payouts} />
      </main>
    </div>
  )
}

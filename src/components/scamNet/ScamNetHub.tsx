'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BellRing, Flag, ImagePlus, LoaderCircle, PhoneCall, Plus, ShieldAlert, ShieldCheck, TrendingUp, UserRound } from 'lucide-react'
import { addScamEvidence, checkPhone, myScamReports, scamAlerts, setScamAlerts, type MyScamReport, type ScamAlerts, type ScamMatch } from '@/app/actions/scamNet'
import type { PhoneInfo } from '@/lib/scamNetPhone'
import { GUARDIAN_LEVELS, type GuardianLevel, type ScamKind } from '@/lib/scamNet'
import { MatchCard, useTimeAgoShort } from './CommunityWarning'
import DossierButton, { type Dossier } from './DossierButton'
import ReportForm, { uploadEvidence } from './ReportForm'

export type HubTab = 'allerta' | 'segnala' | 'numero' | 'mie'
const TABS: { id: HubTab; icon: typeof ShieldAlert }[] = [
  { id: 'allerta', icon: TrendingUp },
  { id: 'segnala', icon: Flag },
  { id: 'numero', icon: PhoneCall },
  { id: 'mie', icon: UserRound },
]
const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm'
const loadingRow = (label: string) => (
  <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> {label}
  </p>
)

// ---------- Allerta della community ----------
function AlertsTab({ onReport }: { onReport: () => void }) {
  const t = useTranslations('scamNet')
  const locale = useLocale()
  const ago = useTimeAgoShort()
  const [data, setData] = useState<ScamAlerts | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    scamAlerts().then(setData)
  }, [])
  const nf = new Intl.NumberFormat(locale)
  if (!data) return loadingRow(t('loading'))
  const toggle = async () => {
    setSaving(true)
    if (await setScamAlerts(!data.alertsOn)) setData({ ...data, alertsOn: !data.alertsOn })
    setSaving(false)
  }
  const trend = (count: number, prev: number) => (prev === 0 ? t('alerts.new') : `${count >= prev ? '+' : ''}${Math.round(((count - prev) / prev) * 100)}%`)
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-2">
        {[
          { n: data.reports7, label: t('alerts.reports') },
          { n: data.hits7, label: t('alerts.hits') },
          { n: data.reporters7, label: t('alerts.reporters') },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-[var(--ink)] p-3 text-white">
            <p className="text-2xl font-extrabold tabular-nums">{nf.format(s.n)}</p>
            <p className="text-xs leading-tight text-white/75">{s.label}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-[var(--muted)]">{t('alerts.week')}</p>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('alerts.trendingTitle')}</h2>
        {data.categories.length === 0 ? (
          <p className={`${card} text-sm text-[var(--muted)]`}>{t('alerts.trendingEmpty')}</p>
        ) : (
          data.categories.map((c) => (
            <article key={c.category} className={`${card} flex items-start gap-3 p-4`}>
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-[#A12A2A]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-extrabold text-[var(--ink)]">{t(`categories.${c.category}`)}</p>
                  <span className="whitespace-nowrap text-xs font-extrabold text-[#A12A2A]">{trend(c.count, c.prev)}</span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{t(`categoryHints.${c.category}`)}</p>
                <p className="mt-1 text-xs font-bold text-[#7a5a14]">
                  {t('alerts.reportsCount', { count: c.count })} · {c.kinds.map((k) => t(`kinds.${k}`)).join(', ')}
                </p>
              </div>
            </article>
          ))
        )}
      </section>

      {data.recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('alerts.recentTitle')}</h2>
          <ul className={`${card} divide-y divide-[var(--gold)]/15 p-0`}>
            {data.recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-[var(--muted)]">
                    {t(`kinds.${r.kind}`)}
                    {r.category ? ` · ${t(`categories.${r.category}`)}` : ''}
                  </span>
                  <span className="block truncate font-bold text-[var(--ink)]">{r.value}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-[var(--muted)]">
                  <span className="block font-extrabold text-[#A12A2A]">{t('alerts.reportsCount', { count: r.reports })}</span>
                  {ago(r.at)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[var(--muted)]">{t('alerts.maskedNote')}</p>
        </section>
      )}

      <section className={`${card} flex items-center gap-3`}>
        <BellRing className="h-6 w-6 shrink-0 text-[var(--gold)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-[var(--ink)]">{t('alerts.weeklyTitle')}</p>
          <p className="text-sm text-[var(--muted)]">{t('alerts.weeklyText')}</p>
        </div>
        <button type="button" role="switch" aria-checked={data.alertsOn} aria-label={t('alerts.weeklyTitle')} disabled={saving} onClick={toggle} className={`relative h-8 w-14 shrink-0 rounded-full transition ${data.alertsOn ? 'bg-[#1d6b34]' : 'bg-gray-300'}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${data.alertsOn ? 'left-7' : 'left-1'}`} />
        </button>
      </section>

      <button type="button" onClick={onReport} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-lg font-bold text-[var(--gold-bright)]">
        <Plus className="h-5 w-5" aria-hidden="true" /> {t('reportCta')}
      </button>
    </div>
  )
}

// ---------- Chi mi ha chiamato? ----------
function PhoneTab({ initial, onReport }: { initial?: string; onReport: (value: string) => void }) {
  const t = useTranslations('scamNet')
  const locale = useLocale()
  const [value, setValue] = useState(initial ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ info: PhoneInfo; match: ScamMatch | null } | null>(null)
  const check = useCallback(
    async (raw: string) => {
      setBusy(true)
      setError(null)
      const r = await checkPhone(raw)
      setBusy(false)
      if (!r.success) {
        setResult(null)
        return setError(t('phone.invalid'))
      }
      setResult(r.data)
    },
    [t]
  )
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial) check(initial)
  }, [initial, check])
  const region = (code: string | null) => {
    if (!code) return null
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
    } catch {
      return code
    }
  }
  const type = result?.info.type
  const risky = type === 'PREMIUM_RATE' || type === 'SHARED_COST'
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) check(value)
        }}
        className={`${card} space-y-3`}
      >
        <label className="block text-sm font-semibold text-[var(--muted)]">
          {t('phone.label')}
          <input value={value} onChange={(e) => setValue(e.target.value.slice(0, 40))} inputMode="tel" placeholder="+39 351 000 0000" className="mt-1 block min-h-12 w-full rounded-xl border border-[var(--gold)]/35 px-3 text-lg font-semibold text-[var(--ink)]" />
        </label>
        <button type="submit" disabled={busy || !value.trim()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] font-bold text-[var(--gold-bright)] disabled:opacity-40">
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <PhoneCall className="h-5 w-5" aria-hidden="true" />} {t('phone.check')}
        </button>
        <p className="text-xs text-[var(--muted)]">{t('phone.hint')}</p>
      </form>
      {error && (
        <p className="rounded-xl bg-[#fdf2f2] p-3 text-sm font-semibold text-[#a12a2a]" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-3" aria-live="polite">
          {result.match ? (
            <MatchCard match={result.match} />
          ) : (
            <section className="flex gap-3 rounded-2xl bg-[#e6f4ea] p-4 text-[#1d6b34]">
              <ShieldCheck className="h-6 w-6 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-extrabold">{t('phone.clean')}</p>
                <p className="text-sm">{t('phone.cleanText')}</p>
              </div>
            </section>
          )}
          <section className={`${card} space-y-2`}>
            <p className="text-lg font-extrabold text-[var(--ink)]">{result.info.international}</p>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-[var(--muted)]">{t('phone.country')}</dt>
              <dd className="text-right font-semibold text-[var(--ink)]">{region(result.info.country) ?? '—'}</dd>
              <dt className="text-[var(--muted)]">{t('phone.type')}</dt>
              <dd className="text-right font-semibold text-[var(--ink)]">{t(`phoneTypes.${type ?? 'UNKNOWN'}`)}</dd>
            </dl>
            {risky && <p className="rounded-xl bg-[#fff4e5] p-3 text-sm font-semibold text-[#7a4a00]">{t('phone.premium')}</p>}
            {result.info.country && result.info.country !== 'IT' && <p className="rounded-xl bg-[#fff4e5] p-3 text-sm text-[#7a4a00]">{t('phone.foreign')}</p>}
            {!result.match && <p className="text-xs text-[var(--muted)]">{t('warning.spoof')}</p>}
          </section>
          <DossierButton
            match={result.match}
            build={(): Dossier => ({
              tool: t('phone.dossierTool'),
              subject: result.info.international,
              verdict: result.match
                ? { status: 'risk', text: t('phone.dossierReported', { n: result.match.reports }) }
                : risky
                  ? { status: 'warning', text: t('phone.premium') }
                  : { status: 'ok', text: t('phone.clean') },
              rows: [
                { label: `${t('phone.country')}: ${region(result.info.country) ?? '—'}`, status: result.info.country && result.info.country !== 'IT' ? 'warning' : 'info' },
                { label: `${t('phone.type')}: ${t(`phoneTypes.${type ?? 'UNKNOWN'}`)}`, status: risky ? 'warning' : 'info' },
                ...(result.info.country && result.info.country !== 'IT' ? [{ label: t('phone.foreign'), status: 'warning' as const }] : []),
                ...(!result.match ? [{ label: t('warning.spoof'), status: 'info' as const }] : []),
              ],
            })}
          />
          <button type="button" onClick={() => onReport(result.info.international)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 bg-white font-bold text-[var(--ink)]">
            <Flag className="h-5 w-5" aria-hidden="true" /> {t('phone.report')}
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- Le mie segnalazioni ----------
function EvidenceAdd({ report, onDone }: { report: MyScamReport; onDone: () => void }) {
  const t = useTranslations('scamNet')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState(false)
  const add = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(false)
    const path = await uploadEvidence(file)
    const ok = path ? await addScamEvidence(report.id, path, note) : false
    setBusy(false)
    if (!ok) return setError(true)
    onDone()
  }
  return (
    <div className="space-y-2 rounded-xl bg-[var(--background)] p-3">
      <label className="block text-xs font-semibold text-[var(--muted)]">
        {t('mine.addNote')}
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 600))} rows={2} className="mt-1 block w-full rounded-lg border border-[var(--gold)]/35 p-2 text-sm" />
      </label>
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)]">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />} {t('mine.addEvidence')}
        <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => add(e.target.files?.[0])} />
      </label>
      {error && <p className="text-xs font-semibold text-[#a12a2a]">{t('errors.evidenceUpload')}</p>}
    </div>
  )
}

const LEVEL_STYLE: Record<GuardianLevel, string> = { bronze: 'bg-[#C98A4B]', silver: 'bg-[#B8BEC7]', gold: 'bg-[var(--gold-bright)]' }
const STATUS_STYLE: Record<MyScamReport['status'], string> = {
  confirmed: 'bg-[#e6f4ea] text-[#1d6b34]',
  pending: 'bg-[#fbf1da] text-[#7a5a14]',
  needs_info: 'bg-[#fff4e5] text-[#7a4a00]',
  dismissed: 'bg-gray-100 text-gray-600',
}

function MineTab({ onReport }: { onReport: () => void }) {
  const t = useTranslations('scamNet')
  const ago = useTimeAgoShort()
  const [data, setData] = useState<Awaited<ReturnType<typeof myScamReports>> | undefined>(undefined)
  const load = useCallback(() => {
    myScamReports().then(setData)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  if (data === undefined) return loadingRow(t('loading'))
  if (!data) return null
  const next = GUARDIAN_LEVELS.find((l) => l.min === data.nextAt)
  const prevMin = data.level ? GUARDIAN_LEVELS.find((l) => l.level === data.level)!.min : 0
  const pct = next ? Math.round(((data.confirmed - prevMin) / (next.min - prevMin)) * 100) : 100
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl bg-[var(--ink)] p-5 text-white">
        <div className="flex items-center gap-4">
          <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[var(--ink)] ${data.level ? LEVEL_STYLE[data.level] : 'bg-white/15 text-white'}`}>
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </span>
          <div>
            <p className="text-2xl font-extrabold leading-tight">{data.level ? t(`levels.${data.level}`) : t('levels.none')}</p>
            <p className="mt-1 text-sm text-white/80">{t('mine.warned', { count: data.warned })}</p>
          </div>
        </div>
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-[var(--gold-bright)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-white/75">{next ? t('mine.progress', { confirmed: data.confirmed, missing: next.min - data.confirmed, next: t(`levels.${next.level}`) }) : t('mine.progressMax', { confirmed: data.confirmed })}</p>
        </div>
      </section>
      {data.reports.length === 0 ? (
        <div className={`${card} space-y-3 text-center`}>
          <p className="text-[var(--muted)]">{t('mine.empty')}</p>
          <button type="button" onClick={onReport} className="min-h-12 rounded-full bg-[var(--ink)] px-6 font-bold text-[var(--gold-bright)]">
            {t('reportCta')}
          </button>
        </div>
      ) : (
        data.reports.map((r) => (
          <article key={r.id} className={`${card} space-y-1.5 p-4`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--muted)]">
                {t(`kinds.${r.kind}`)} · {t(`categories.${r.category}`)} · {ago(r.createdAt)}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${STATUS_STYLE[r.status]}`}>{t(`status.${r.status}`)}</span>
            </div>
            <p className="break-all font-extrabold text-[var(--ink)]">{r.value}</p>
            <p className="text-sm text-[var(--muted)]">{t(`statusText.${r.status}`, { count: r.warned })}</p>
            {r.staffNote && r.status !== 'confirmed' && (
              <p className="text-sm text-[var(--ink)]">
                <strong>{t('mine.staffNote')}</strong> {r.staffNote}
              </p>
            )}
            {r.status === 'needs_info' && <EvidenceAdd report={r} onDone={load} />}
          </article>
        ))
      )}
      <p className="text-xs text-[var(--muted)]">{t('mine.anonymous')}</p>
    </div>
  )
}

// ---------- Contenitore ----------
export default function ScamNetHub({ initialTab, initialKind, initialValue, initialPhone }: { initialTab: HubTab; initialKind?: ScamKind; initialValue?: string; initialPhone?: string }) {
  const t = useTranslations('scamNet')
  const [tab, setTab] = useState<HubTab>(initialTab)
  const [prefill, setPrefill] = useState<{ kind?: ScamKind; value?: string; n: number }>({ kind: initialKind, value: initialValue, n: 0 })
  const go = (next: HubTab) => {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    url.searchParams.delete('kind')
    url.searchParams.delete('value')
    url.searchParams.delete('n')
    window.history.replaceState(null, '', url)
  }
  const reportPhone = (value: string) => {
    setPrefill((p) => ({ kind: 'phone', value, n: p.n + 1 }))
    go('segnala')
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 shadow-sm" role="tablist" aria-label={t('title')}>
        {TABS.map(({ id, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => go(id)} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-bold leading-tight sm:text-sm ${tab === id ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'text-[var(--ink)] hover:bg-[var(--background)]'}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
            {t(`tabs.${id === 'allerta' ? 'alerts' : id === 'segnala' ? 'report' : id === 'numero' ? 'phone' : 'mine'}`)}
          </button>
        ))}
      </div>
      {tab === 'allerta' && <AlertsTab onReport={() => go('segnala')} />}
      {tab === 'segnala' && <ReportForm key={prefill.n} initialKind={prefill.kind} initialValue={prefill.value} onDone={() => go('mie')} />}
      {tab === 'numero' && <PhoneTab initial={initialPhone} onReport={reportPhone} />}
      {tab === 'mie' && <MineTab onReport={() => go('segnala')} />}
    </div>
  )
}

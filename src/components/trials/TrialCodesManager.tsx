'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Copy, LoaderCircle, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { adminListTrialCodes, createTrialCode, deleteTrialCode, listMyTrialCodes, type TrialCodeRow } from '@/app/actions/trials'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { MAX_ACTIVE_TRIAL_CODES, TRIAL_DURATIONS, TRIAL_TOOLS } from '@/lib/trials'

// Codici di prova dei servizi: crea, manda (WhatsApp o link) e cancella.
// Usato dai Kumani (Base/Pro), dagli agenti e in Admin (tutti i codici).

const buildWhatsAppHref = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`

const STATUS_STYLE: Record<TrialCodeRow['status'], string> = {
  waiting: 'bg-amber-50 text-amber-800',
  active: 'bg-emerald-50 text-emerald-700',
  ended: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-500',
  deleted: 'bg-red-50 text-red-600',
}

export default function TrialCodesManager({ admin = false, siteUrl }: { admin?: boolean; siteUrl: string }) {
  const t = useTranslations('trials')
  const tm = useTranslations('marketplace')
  const locale = useLocale()
  const titles = new Map(getMarketplaceTools(tm).map((x) => [x.toolName, x.title]))
  const [rows, setRows] = useState<TrialCodeRow[] | null>(null)
  const [tool, setTool] = useState<string>(TRIAL_TOOLS.pro[2])
  const [duration, setDuration] = useState<number>(1440)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = async () => {
    if (admin) {
      const r = await adminListTrialCodes()
      setRows(r.rows)
    } else {
      const r = await listMyTrialCodes()
      setRows(r.rows)
    }
  }
  useEffect(() => {
    // Caricamento all'apertura
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const site = siteUrl.replace(/\/+$/, '')
  const linkOf = (code: string) => `${site}${locale === 'it' ? '' : `/${locale}`}/prova/${code}`
  const durationLabel = (m: number) => (m >= 1440 ? t('durationDays', { days: Math.round(m / 1440) }) : t('durationHours', { hours: Math.round(m / 60) }))
  const toolTitle = (x: string) => titles.get(x) ?? x
  const active = (rows ?? []).filter((r) => r.status === 'waiting').length

  const create = async () => {
    setBusy(true)
    setError(null)
    const r = await createTrialCode({ tool, duration })
    setBusy(false)
    if (!r.success) {
      setError(t(`err_${r.error}`, { max: MAX_ACTIVE_TRIAL_CODES }))
      return
    }
    setRows((prev) => [r.row, ...(prev ?? [])])
  }
  const remove = async (row: TrialCodeRow) => {
    if (!confirm(row.status === 'active' ? t('deleteActiveConfirm') : t('deleteConfirm'))) return
    const r = await deleteTrialCode(row.id)
    if (r.success) setRows((prev) => (prev ?? []).filter((x) => x.id !== row.id || admin).map((x) => (x.id === row.id ? { ...x, status: 'deleted' } : x)))
  }
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(linkOf(code))
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* copia non disponibile */
    }
  }
  const message = (row: TrialCodeRow) => t('shareMessage', { tool: toolTitle(row.tool), duration: durationLabel(row.durationMinutes), link: linkOf(row.code) })
  const day = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('createTitle')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('createHint', { max: MAX_ACTIVE_TRIAL_CODES })}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-800">{t('serviceLabel')}</span>
            <select value={tool} onChange={(e) => setTool(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900">
              <optgroup label={t('groupPro')}>
                {TRIAL_TOOLS.pro.map((x) => (
                  <option key={x} value={x}>
                    {toolTitle(x)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('groupBase')}>
                {TRIAL_TOOLS.base.map((x) => (
                  <option key={x} value={x}>
                    {toolTitle(x)}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-gray-800">{t('durationLabel')}</span>
            <div className="grid grid-cols-4 gap-1.5">
              {TRIAL_DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration(m)}
                  aria-pressed={duration === m}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-semibold ${duration === m ? 'border-[var(--gold)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 bg-white text-gray-700'}`}
                >
                  {durationLabel(m)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={create} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 font-bold text-[var(--ink)] disabled:opacity-60">
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} {t('createButton')}
          </button>
          {!admin && <span className="text-xs text-[var(--muted)]">{t('activeCount', { count: active, max: MAX_ACTIVE_TRIAL_CODES })}</span>}
        </div>
        <p className="text-xs leading-5 text-[var(--muted)]">{t('rulesNote')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--ink)]">{admin ? t('listTitleAdmin') : t('listTitle')}</h2>
        {rows === null ? (
          <p className="text-sm text-[var(--muted)]">…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-[var(--muted)]">{t('listEmpty')}</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-[var(--ink)]">
                    {toolTitle(row.tool)} · {durationLabel(row.durationMinutes)}
                  </p>
                  <p className="font-mono text-xs text-[var(--muted)]">{row.code}</p>
                  {admin && row.creator && <p className="text-xs text-[var(--muted)]">{t('createdBy', { name: row.creator })}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[row.status]}`}>{t(`status_${row.status}`)}</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                {row.status === 'waiting' && t('activateBy', { date: day(row.activateBy) })}
                {row.status === 'active' && row.accessUntil && t('activeUntil', { date: day(row.accessUntil) })}
                {row.status === 'ended' && row.redeemedAt && t('usedOn', { date: day(row.redeemedAt) })}
              </p>
              {(row.status === 'waiting' || row.status === 'active') && (
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  {row.status === 'waiting' && (
                    <>
                      <a href={buildWhatsAppHref(message(row))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700">
                        <MessageCircle className="h-4 w-4" /> {t('sendWhatsapp')}
                      </a>
                      <button type="button" onClick={() => copy(row.code)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50">
                        {copied === row.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === row.code ? t('copied') : t('copyLink')}
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => remove(row)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" /> {row.status === 'active' ? t('endNow') : t('delete')}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  )
}

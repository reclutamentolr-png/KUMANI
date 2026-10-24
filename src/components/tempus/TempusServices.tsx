'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Eye, EyeOff, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { deleteTempusService, saveTempusService } from '@/app/actions/tempus'
import { askConfirm } from '@/lib/confirm'
import { formatDuration, formatPrice, type TempusService, type TempusSettings } from '@/lib/tempus'
import { card, chip, field, label, primary, secondary } from './ui'

const DURATIONS = [15, 30, 45, 60, 90, 120]
const toCents = (text: string) => {
  const n = Number(text.replace(/\s/g, '').replace(',', '.'))
  return text.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}
const fromCents = (cents: number | null) => (cents == null ? '' : String(cents / 100).replace('.', ','))

type Draft = { id?: string; name: string; description: string; duration: string; price: string; active: boolean; sort: number }
const emptyDraft = (sort: number): Draft => ({ name: '', description: '', duration: '30', price: '', active: true, sort })

export default function TempusServices({ settings, services, onChange }: { settings: TempusSettings; services: TempusService[]; onChange: (s: TempusService[]) => void }) {
  const t = useTranslations('tempus')
  const locale = useLocale()
  const [draft, setDraft] = useState<Draft | null>(services.length ? null : emptyDraft(0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async (d: Draft) => {
    setBusy(true)
    setError('')
    const res = await saveTempusService({
      id: d.id,
      name: d.name,
      description: d.description,
      duration_min: Number(d.duration),
      price_cents: toCents(d.price),
      active: d.active,
      sort: d.sort,
    })
    setBusy(false)
    if (!res.success) return setError(t(`error_${res.message}`))
    const next = d.id ? services.map((s) => (s.id === d.id ? res.service : s)) : [...services, res.service]
    onChange(next.sort((a, b) => a.sort - b.sort))
    setDraft(null)
  }

  const quickSave = async (s: TempusService, patch: Partial<TempusService>) => {
    const res = await saveTempusService({ ...s, ...patch })
    if (res.success) return res.service
    return null
  }

  const toggle = async (s: TempusService) => {
    const updated = await quickSave(s, { active: !s.active })
    if (updated) onChange(services.map((x) => (x.id === s.id ? updated : x)))
  }

  // Sposta su o giù: si riscrive l'ordine di tutti (0, 1, 2…)
  const move = async (index: number, dir: -1 | 1) => {
    const list = [...services]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    const renumbered = list.map((s, i) => ({ ...s, sort: i }))
    onChange(renumbered)
    await Promise.all(renumbered.filter((s, i) => services[i]?.id !== s.id).map((s) => quickSave(s, { sort: s.sort })))
  }

  const remove = async (s: TempusService) => {
    if (!(await askConfirm(t('deleteServiceConfirm', { name: s.name })))) return
    if ((await deleteTempusService(s.id)).success) onChange(services.filter((x) => x.id !== s.id))
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('servicesTitle')}</h3>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{t('servicesText')}</p>
          </div>
          {!draft && (
            <button type="button" onClick={() => setDraft(emptyDraft(services.length))} className={primary}>
              <Plus className="h-5 w-5" /> {t('addService')}
            </button>
          )}
        </div>

        {draft && !draft.id && <ServiceForm draft={draft} setDraft={setDraft} onSave={save} onCancel={services.length ? () => setDraft(null) : undefined} busy={busy} error={error} />}

        {services.length > 0 && (
          <ul className="mt-4 space-y-2">
            {services.map((s, i) =>
              draft?.id === s.id ? (
                <li key={s.id}>
                  <ServiceForm draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} busy={busy} error={error} />
                </li>
              ) : (
                <li key={s.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${s.active ? 'border-[var(--gold)]/30 bg-[var(--paper)]' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[var(--ink)]">{s.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {formatDuration(s.duration_min)}
                      {s.price_cents != null ? ` · ${formatPrice(s.price_cents, locale)}` : ''}
                      {!s.active ? ` · ${t('hidden')}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-2 text-gray-500 hover:bg-white disabled:opacity-30" aria-label={t('moveUp')}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === services.length - 1} className="rounded-lg p-2 text-gray-500 hover:bg-white disabled:opacity-30" aria-label={t('moveDown')}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => toggle(s)} className="rounded-lg p-2 text-gray-500 hover:bg-white" aria-label={s.active ? t('hideService') : t('showService')}>
                      {s.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft({ id: s.id, name: s.name, description: s.description, duration: String(s.duration_min), price: fromCents(s.price_cents), active: s.active, sort: s.sort })}
                      className="rounded-lg p-2 text-gray-500 hover:bg-white"
                      aria-label={t('edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => remove(s)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-700" aria-label={t('delete')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
        {!settings.show_prices && services.some((s) => s.price_cents != null) && <p className="mt-3 text-xs text-[var(--muted)]">{t('pricesHiddenNote')}</p>}
      </div>
    </div>
  )
}

function ServiceForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  busy,
  error,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  onSave: (d: Draft) => void
  onCancel?: () => void
  busy: boolean
  error: string
}) {
  const t = useTranslations('tempus')
  const duration = Number(draft.duration)
  return (
    <div className="mt-4 rounded-2xl border-2 border-[var(--gold)]/40 bg-[var(--gold-pale)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>
          {t('serviceName')}
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 80) })} className={field} placeholder={t('serviceNamePlaceholder')} />
        </label>
        <div className="sm:col-span-2">
          <span className={label}>{t('duration')}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button key={d} type="button" onClick={() => setDraft({ ...draft, duration: String(d) })} className={chip(duration === d)}>
                {formatDuration(d)}
              </button>
            ))}
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              {t('otherMinutes')}
              <input type="number" min={5} max={600} step={5} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} className="w-24 rounded-xl border-2 border-gray-200 bg-white px-2 py-2 text-base font-bold text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none" />
            </label>
          </div>
        </div>
        <label className={label}>
          {t('priceOptional')}
          <input inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.,]/g, '').slice(0, 10) })} className={field} placeholder="30" />
        </label>
        <label className={`${label} sm:col-span-2`}>
          {t('serviceDescription')}
          <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value.slice(0, 300) })} rows={2} className={field} placeholder={t('serviceDescriptionPlaceholder')} />
        </label>
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onSave(draft)} disabled={busy || !draft.name.trim() || !(duration >= 5 && duration <= 600)} className={primary}>
          {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
          {t('saveService')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={secondary}>
            {t('close')}
          </button>
        )}
      </div>
    </div>
  )
}

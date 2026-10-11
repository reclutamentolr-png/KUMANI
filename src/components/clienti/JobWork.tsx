'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FileText, LoaderCircle, Pause, Play, Plus, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/resizeImage'
import { fileExtension } from '@/lib/casa'
import { askConfirm } from '@/lib/confirm'
import { limitTextOf } from '@/lib/limitText'
import { addJobCost, addTimeEntry, deleteJobCost, deleteJobFile, deleteTimeEntry, registerJobFile, setHourlyCost, startTimer, stopTimer } from '@/app/actions/clienti'
import {
  CLIENT_LIMITS,
  JOB_FILE_MAX_BYTES,
  JOB_FILE_TYPES,
  entryMinutes,
  formatClock,
  formatEur,
  formatHours,
  romeToday,
  type CostKind,
  type JobCost,
  type JobFile,
  type JobProduct,
  type TimeEntry,
} from '@/lib/clienti'
import { inputClass } from './ClientForm'

const JOB_PHOTO_MAX_SIDE = 1600
const JOB_PHOTO_QUALITY = 0.72

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm'
const labelClass = 'block text-sm font-semibold text-[var(--muted)]'
const secondaryBtn =
  'inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-white px-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-50'
const primaryBtn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-50'

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

// ——— Tempo sul lavoro: cronometro, ore a mano, costo orario ———
export function TimeCard({
  jobId,
  entries,
  onEntries,
  hourlyCost,
  onHourlyCost,
}: {
  jobId: string
  entries: TimeEntry[]
  onEntries: (entries: TimeEntry[]) => void
  hourlyCost: number | null
  onHourlyCost: (value: number | null) => void
}) {
  const t = useTranslations('clienti')
  const locale = useLocale()
  const running = entries.find((e) => !e.ended_at) ?? null
  const now = useNow(!!running)
  const totalMinutes = entries.reduce((s, e) => s + entryMinutes(e, now), 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const [day, setDay] = useState(romeToday())
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [rate, setRate] = useState(hourlyCost === null ? '' : String(hourlyCost).replace('.', ','))

  const toggle = async () => {
    setBusy(true)
    setError(null)
    if (running) {
      const result = await stopTimer()
      if (result.success && result.data) onEntries(entries.map((e) => (e.id === result.data!.id ? result.data! : e)))
      else if (!result.success) setError(t('errors.saveError'))
    } else {
      const result = await startTimer(jobId)
      if (result.success) onEntries([result.data.entry, ...entries])
      else setError(limitTextOf(result) ?? t('errors.saveError'))
    }
    setBusy(false)
  }

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await addTimeEntry(jobId, day, hours, note)
    setBusy(false)
    if (!result.success) {
      setError(limitTextOf(result) ?? t(`errors.${result.message === 'hoursInvalid' ? 'hoursInvalid' : 'saveError'}`))
      return
    }
    onEntries([...entries, result.data].sort((a, b) => b.started_at.localeCompare(a.started_at)))
    setHours('')
    setNote('')
    setManualOpen(false)
  }

  const removeEntry = async (entry: TimeEntry) => {
    if (!(await askConfirm(t('time.deleteConfirm')))) return
    const result = await deleteTimeEntry(entry.id)
    if (result.success) onEntries(entries.filter((e) => e.id !== entry.id))
    else setError(t('errors.saveError'))
  }

  const saveRate = async () => {
    const current = hourlyCost === null ? '' : String(hourlyCost).replace('.', ',')
    if (rate.trim() === current) return
    const result = await setHourlyCost(jobId, rate)
    if (result.success) onHourlyCost(result.data)
    else setError(t('errors.amountInvalid'))
  }

  const sessionDay = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' })
  const sessionTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })

  return (
    <section className="rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.2)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('time.title')}</p>
        <span className="text-sm text-white/70">{t('time.total', { hours: formatHours(totalMinutes, locale) })}</span>
      </div>
      <p className="mt-2 text-5xl font-extrabold tabular-nums tracking-wide" aria-live="off">
        {running ? formatClock(now - new Date(running.started_at).getTime()) : '0:00:00'}
      </p>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`mt-3 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold transition-opacity disabled:opacity-60 ${
          running ? 'bg-white text-[var(--ink)]' : 'bg-[var(--gold-bright)] text-[var(--ink)]'
        }`}
      >
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        {running ? t('time.stop') : t('time.start')}
      </button>
      <p className="mt-2 text-xs text-white/60">{t('time.hint')}</p>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm font-semibold text-white/75">
          {t('time.hourlyCost')}
          <input
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={saveRate}
            placeholder="0,00"
            className="mt-1 block min-h-11 w-32 rounded-xl border border-white/20 bg-white/10 px-3 text-base text-white outline-none placeholder:text-white/40 focus:border-[var(--gold-bright)]"
          />
        </label>
        <button type="button" onClick={() => setManualOpen((v) => !v)} className="min-h-11 rounded-xl border border-white/25 px-4 text-sm font-semibold text-white hover:bg-white/10">
          {t('time.addManual')}
        </button>
        {entries.length > 0 && (
          <button type="button" onClick={() => setShowSessions((v) => !v)} aria-expanded={showSessions} className="min-h-11 rounded-xl px-2 text-sm font-semibold text-[var(--gold-bright)] underline-offset-2 hover:underline">
            {showSessions ? t('time.hideSessions') : t('time.showSessions', { count: entries.length })}
          </button>
        )}
      </div>

      {manualOpen && (
        <form onSubmit={addManual} className="mt-4 grid gap-3 rounded-2xl bg-white p-4 text-[var(--ink)] sm:grid-cols-[auto_auto_1fr_auto] sm:items-end" noValidate>
          <label className={labelClass}>
            {t('time.day')}
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t('time.hours')}
            <input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1,5" className={`${inputClass} sm:w-24`} />
          </label>
          <label className={labelClass}>
            {t('time.note')}
            <input value={note} maxLength={CLIENT_LIMITS.timeNote} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </label>
          <button type="submit" disabled={busy || !hours.trim()} className={primaryBtn}>
            {t('time.save')}
          </button>
        </form>
      )}

      {showSessions && (
        <ul className="mt-4 divide-y divide-white/10">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block font-semibold">
                  {sessionDay(e.started_at)} · {e.ended_at ? t('time.hoursShort', { hours: formatHours(entryMinutes(e), locale) }) : t('time.running')}
                </span>
                <span className="block break-words text-white/60">
                  {e.note ?? `${sessionTime(e.started_at)}${e.ended_at ? ` – ${sessionTime(e.ended_at)}` : ''}`}
                </span>
              </span>
              {e.ended_at && (
                <button
                  type="button"
                  onClick={() => removeEntry(e)}
                  aria-label={t('time.delete')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ——— Margine: prezzo meno materiali, spese e ore × costo orario ———
export function MarginCard({
  price,
  costs,
  minutes,
  hourlyCost,
}: {
  price: number | null
  costs: JobCost[]
  minutes: number
  hourlyCost: number | null
}) {
  const t = useTranslations('clienti')
  const locale = useLocale()
  const materials = costs.filter((c) => c.kind === 'material').reduce((s, c) => s + c.quantity * c.unit_cost, 0)
  const expenses = costs.filter((c) => c.kind === 'expense').reduce((s, c) => s + c.quantity * c.unit_cost, 0)
  const labor = hourlyCost ? (minutes / 60) * hourlyCost : 0
  const margin = price === null ? null : price - materials - expenses - labor
  const pct = margin !== null && price ? Math.round((margin / price) * 100) : null
  const tone = pct === null ? 'text-[var(--ink)]' : pct >= 25 ? 'text-[#1d6b34]' : pct >= 10 ? 'text-[#8a6a1f]' : 'text-red-700'
  const row = (label: string, value: string) => (
    <p className="flex justify-between gap-3 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <b className="shrink-0 text-[var(--ink)]">{value}</b>
    </p>
  )

  return (
    <section className={card}>
      <h3 className="text-base font-extrabold text-[var(--ink)]">{t('margin.title')}</h3>
      <div className="mt-3 space-y-2">
        {row(t('margin.price'), price === null ? '—' : formatEur(price, locale))}
        {row(t('margin.materials'), `− ${formatEur(materials, locale)}`)}
        {row(t('margin.expenses'), `− ${formatEur(expenses, locale)}`)}
        {row(
          hourlyCost ? t('margin.labor', { hours: formatHours(minutes, locale), rate: formatEur(hourlyCost, locale) }) : t('margin.laborNoRate'),
          `− ${formatEur(labor, locale)}`
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-[var(--gold)]/15 pt-3">
        <span className="font-extrabold text-[var(--ink)]">{t('margin.left')}</span>
        <span className={`text-xl font-extrabold ${tone}`}>
          {margin === null ? '—' : formatEur(margin, locale)}
          {pct !== null ? ` · ${pct}%` : ''}
        </span>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">{price === null ? t('margin.noPrice') : t('margin.hint')}</p>
    </section>
  )
}

// ——— Costi: materiali (anche dal Magazzino) e altre spese ———
export function CostsCard({
  jobId,
  costs,
  onCosts,
  products,
}: {
  jobId: string
  costs: JobCost[]
  onCosts: (costs: JobCost[]) => void
  products: JobProduct[] | null
}) {
  const t = useTranslations('clienti')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<CostKind>('material')
  const [productId, setProductId] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [unload, setUnload] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const product = products?.find((p) => p.id === productId) ?? null

  const pickProduct = (id: string) => {
    setProductId(id)
    const p = products?.find((x) => x.id === id)
    if (p) {
      setDescription(p.name)
      setUnitCost(String(p.purchase_price).replace('.', ','))
    }
  }

  const reset = () => {
    setProductId('')
    setDescription('')
    setQuantity('1')
    setUnitCost('')
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await addJobCost(jobId, { kind, description, quantity, unitCost, productId: kind === 'material' ? productId : '', unload: kind === 'material' && !!productId && unload })
    setBusy(false)
    if (!result.success) {
      const known = ['descriptionRequired', 'quantityInvalid', 'amountInvalid', 'stockInsufficient', 'stockError']
      setError(limitTextOf(result) ?? t(`errors.${known.includes(result.message) ? result.message : 'saveError'}`))
      return
    }
    onCosts([...costs, result.data])
    reset()
    setOpen(false)
  }

  const remove = async (cost: JobCost) => {
    if (!(await askConfirm(cost.stock_unloaded ? t('costs.deleteConfirmStock', { name: cost.description }) : t('costs.deleteConfirm', { name: cost.description })))) return
    const result = await deleteJobCost(cost.id)
    if (result.success) onCosts(costs.filter((c) => c.id !== cost.id))
    else setError(t('errors.saveError'))
  }

  return (
    <section className={card}>
      <h3 className="text-base font-extrabold text-[var(--ink)]">{t('costs.title')}</h3>
      {costs.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{t('costs.none')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--gold)]/15">
          {costs.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold text-[var(--ink)]">{c.description}</span>
                <span className="block text-xs text-[var(--muted)]">
                  {t(`costs.kinds.${c.kind}`)}
                  {c.quantity !== 1 ? ` · ${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(c.quantity)} × ${formatEur(c.unit_cost, locale)}` : ''}
                  {c.stock_unloaded ? ` · ${t('costs.unloaded')}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="font-extrabold text-[var(--ink)]">{formatEur(c.quantity * c.unit_cost, locale)}</span>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  aria-label={t('costs.delete')}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl bg-[var(--background)] p-4" noValidate>
          <div className="flex gap-2" role="group" aria-label={t('costs.kindLabel')}>
            {(['material', 'expense'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`min-h-10 rounded-full px-4 text-sm font-bold ${kind === k ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--gold)]/35 bg-white text-[var(--ink)]'}`}
              >
                {t(`costs.kinds.${k}`)}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {kind === 'material' && products && products.length > 0 && (
              <label className={`${labelClass} sm:col-span-2`}>
                {t('costs.fromStock')}
                <select value={productId} onChange={(e) => pickProduct(e.target.value)} className={inputClass}>
                  <option value="">{t('costs.noProduct')}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {t('costs.inStock', { qty: new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(p.stock), unit: p.unit })}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={`${labelClass} sm:col-span-2`}>
              {t('costs.description')}
              <input
                value={description}
                maxLength={CLIENT_LIMITS.costDescription}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={kind === 'material' ? t('costs.materialPlaceholder') : t('costs.expensePlaceholder')}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t('costs.quantity')}
              {product ? ` (${product.unit})` : ''}
              <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t('costs.unitCost')}
              <input inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="0,00" className={inputClass} />
            </label>
            {kind === 'material' && product && (
              <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-[var(--ink)] sm:col-span-2">
                <input type="checkbox" checked={unload} onChange={(e) => setUnload(e.target.checked)} className="h-5 w-5 accent-[var(--ink)]" />
                {t('costs.unload')}
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t('costs.save')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>
              {t('cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            reset()
            setOpen(true)
          }}
          className={`mt-3 ${secondaryBtn}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('costs.add')}
        </button>
      )}
    </section>
  )
}

// ——— Foto e documenti (spazio privato, link che scadono) ———
export function FilesCard({ jobId, files, onFiles }: { jobId: string; files: JobFile[]; onFiles: (files: JobFile[]) => void }) {
  const t = useTranslations('clienti')
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const added: JobFile[] = []
    for (const original of Array.from(list).slice(0, 10)) {
      if (!JOB_FILE_TYPES.includes(original.type)) {
        setError(t('files.typeError'))
        continue
      }
      // Foto compresse al massimo prima del caricamento (lato lungo 1600 px,
      // JPEG al 72%): una foto del telefono da 3–5 MB scende a circa 150–300 KB.
      // I PDF restano come sono.
      const file = original.type.startsWith('image/') ? ((await resizeImageFile(original, JOB_PHOTO_MAX_SIDE, JOB_PHOTO_QUALITY, { keepIfUnderBytes: 200 * 1024 })) ?? original) : original
      if (file.size > JOB_FILE_MAX_BYTES) {
        setError(t('files.sizeError'))
        continue
      }
      if (!user) break
      const path = `${user.id}/${jobId}/${crypto.randomUUID()}.${fileExtension(file)}`
      const { error: upError } = await supabase.storage.from('job-files').upload(path, file, { contentType: file.type, upsert: false })
      if (upError) {
        setError(/row-level security/i.test(upError.message) ? t('files.limitError') : t('errors.saveError'))
        break
      }
      const result = await registerJobFile(jobId, { path, name: original.name, mime: file.type, size: file.size })
      if (!result.success) {
        setError(limitTextOf(result) ?? t('errors.saveError'))
        break
      }
      added.push(result.data)
    }
    if (added.length) onFiles([...files, ...added])
    setBusy(false)
    if (ref.current) ref.current.value = ''
  }

  const remove = async (file: JobFile) => {
    if (!(await askConfirm(t('files.deleteConfirm', { name: file.name })))) return
    const result = await deleteJobFile(file.id)
    if (result.success) onFiles(files.filter((f) => f.id !== file.id))
    else setError(t('errors.saveError'))
  }

  return (
    <section className={card}>
      <h3 className="text-base font-extrabold text-[var(--ink)]">{t('files.title')}</h3>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {files.map((f) => (
          <div key={f.id} className="relative">
            <a
              href={f.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border border-[var(--gold)]/25 bg-[var(--background)] text-center"
              title={f.name}
            >
              {f.mime.startsWith('image/') && f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <>
                  <FileText className="h-7 w-7 text-[var(--gold)]" aria-hidden="true" />
                  <span className="mt-1 line-clamp-2 break-all px-1 text-[11px] font-semibold text-[var(--ink)]">{f.name}</span>
                </>
              )}
            </a>
            <button
              type="button"
              onClick={() => remove(f)}
              aria-label={t('files.delete', { name: f.name })}
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-700 shadow"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--gold)]/50 bg-white text-sm font-bold text-[#8a6a1f] disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" aria-hidden="true" />}
          {t('files.add')}
        </button>
      </div>
      <input ref={ref} type="file" multiple accept={JOB_FILE_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => upload(e.target.files)} />
      <p className="mt-2 text-xs text-[var(--muted)]">{t('files.hint')}</p>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  )
}

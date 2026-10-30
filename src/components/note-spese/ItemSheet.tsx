'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Camera, ImagePlus, Info, LoaderCircle, Trash2, X } from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'
import { createClient } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/resizeImage'
import { askConfirm } from '@/lib/confirm'
import { limitTextOf } from '@/lib/limitText'
import { deleteItem, saveItem } from '@/app/actions/noteSpese'
import {
  EXPENSE_BUCKET,
  EXPENSE_CATEGORIES,
  EXPENSE_LIMITS,
  RECEIPT_MAX_BYTES,
  RECEIPT_MAX_SIDE,
  RECEIPT_QUALITY,
  RECEIPT_TYPES,
  centsToInput,
  formatCents,
  formatKm,
  formatRate,
  kmToInput,
  mileageCents,
  parseDecimal,
  receiptExtension,
  roundTo,
  type ExpenseCategory,
  type ExpenseItem,
  type ItemFormData,
} from '@/lib/noteSpese'
import { CategoryIcon, input, label, primary } from './shared'

type PhotoState =
  | { kind: 'none' }
  | { kind: 'saved'; url: string | null }
  | { kind: 'uploading'; preview: string }
  | { kind: 'ready'; preview: string; path: string }

// Finestra per aggiungere o modificare una voce: categoria a tocchi, importo
// subito pronto da scrivere, foto dello scontrino caricata mentre si scrive.
export default function ItemSheet({
  reportId,
  item,
  defaults,
  initialFile,
  reportKmRate,
  onSaved,
  onDeleted,
  onClose,
}: {
  reportId: string
  item: ExpenseItem | null
  defaults: { spentOn: string; category: ExpenseCategory }
  initialFile: File | null
  reportKmRate: number | null
  onSaved: (item: ExpenseItem, kmRate: number | null, isNew: boolean) => void
  onDeleted: (id: string) => void
  onClose: () => void
}) {
  const t = useTranslations('noteSpese')
  const locale = useLocale()
  const rateText = (rate: number | null) => (rate ? formatRate(rate, locale) : '')
  const [form, setForm] = useState<ItemFormData>(() =>
    item
      ? {
          spentOn: item.spent_on,
          category: item.category,
          description: item.description,
          amount: item.category === 'mileage' ? '' : centsToInput(item.amount_cents, locale),
          routeFrom: item.route_from ?? '',
          routeTo: item.route_to ?? '',
          km: item.km ? kmToInput(item.km, locale) : '',
          roundTrip: item.round_trip,
          kmRate: rateText(item.km_rate),
        }
      : {
          spentOn: defaults.spentOn,
          category: defaults.category,
          description: '',
          amount: '',
          routeFrom: '',
          routeTo: '',
          km: '',
          roundTrip: false,
          kmRate: rateText(reportKmRate),
        },
  )
  const [photo, setPhoto] = useState<PhotoState>(item?.receipt_path ? { kind: 'saved', url: item.receipt_url } : { kind: 'none' })
  const [removeReceipt, setRemoveReceipt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const uploadSeq = useRef(0)
  const previews = useRef<string[]>([])

  const set = <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => setForm((f) => ({ ...f, [key]: value }))
  const isMileage = form.category === 'mileage'

  // Anteprime create nel browser: liberate quando la finestra si chiude
  useEffect(() => {
    const list = previews.current
    return () => list.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const upload = async (original: File) => {
    setPhotoError(null)
    const seq = ++uploadSeq.current
    const preview = URL.createObjectURL(original)
    previews.current.push(preview)
    setPhoto({ kind: 'uploading', preview })
    const fail = (message: string) => {
      if (seq !== uploadSeq.current) return
      setPhotoError(message)
      setPhoto(item?.receipt_path && !removeReceipt ? { kind: 'saved', url: item.receipt_url } : { kind: 'none' })
    }
    // Rete caduta o errore imprevisto: la finestra non resta bloccata su «Caricamento»
    try {
      // Foto del telefono ridotta prima del caricamento (da 3–5 MB a circa 300 KB)
      const file = await resizeImageFile(original, RECEIPT_MAX_SIDE, RECEIPT_QUALITY, { keepIfUnderBytes: 400 * 1024 })
      if (!file || !RECEIPT_TYPES.includes(file.type)) return fail(t('photoTypeError'))
      if (file.size > RECEIPT_MAX_BYTES) return fail(t('photoSizeError'))
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return fail(t('photoError'))
      const path = `${user.id}/${reportId}/${crypto.randomUUID()}.${receiptExtension(file)}`
      const { error: upError } = await supabase.storage.from(EXPENSE_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
      if (upError) return fail(/row-level security/i.test(upError.message) ? t('photoLimitError') : t('photoError'))
      if (seq !== uploadSeq.current) return
      setPhoto({ kind: 'ready', preview, path })
    } catch (e) {
      console.error('[NoteSpese] upload', e)
      fail(t('photoError'))
    }
  }

  // Foto arrivata dal pulsante «Foto scontrino»: si carica subito
  const started = useRef(false)
  useEffect(() => {
    if (initialFile && !started.current) {
      started.current = true
      void upload(initialFile)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile])

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void upload(file)
  }

  const dropPhoto = () => {
    uploadSeq.current += 1
    if (item?.receipt_path) setRemoveReceipt(true)
    setPhoto({ kind: 'none' })
  }

  // Importo dei chilometri calcolato mentre si scrive
  const km = parseDecimal(form.km)
  const rate = parseDecimal(form.kmRate)
  const kmRounded = km ? roundTo(km, 1) : 0
  const rateRounded = rate ? roundTo(rate, 4) : 0
  const mileage = isMileage && kmRounded > 0 && rateRounded > 0 ? mileageCents(kmRounded, form.roundTrip, rateRounded) : null

  // Doppio tocco su «Salva»: una voce sola
  const submitting = useRef(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (photo.kind === 'uploading' || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError(null)
    const result = await saveItem(reportId, item?.id ?? null, form, photo.kind === 'ready' ? photo.path : null, removeReceipt).catch(() => null)
    submitting.current = false
    setBusy(false)
    if (!result) {
      setError(t('error_saveError'))
      return
    }
    if (!result.success) {
      setError(limitTextOf(result) ?? (t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError')))
      return
    }
    onSaved(result.data.item, result.data.kmRate, !item)
  }

  const remove = async () => {
    if (!item || !(await askConfirm(t('itemDeleteConfirm')))) return
    setBusy(true)
    const result = await deleteItem(item.id).catch(() => null)
    setBusy(false)
    if (result?.success) onDeleted(item.id)
    else setError(t('error_saveError'))
  }

  const shownPhoto = photo.kind === 'saved' ? photo.url : photo.kind === 'none' ? null : photo.preview

  return (
    <Sheet title={item ? t('itemEditTitle') : t('itemNewTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {/* Categoria a tocchi */}
        <div>
          <span className={label}>{t('fieldCategory')}</span>
          <div className="grid grid-cols-4 gap-2">
            {EXPENSE_CATEGORIES.map((c) => {
              const active = form.category === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    set('category', c)
                    if (c !== 'mileage') setTimeout(() => amountRef.current?.focus(), 0)
                  }}
                  aria-pressed={active}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-semibold leading-tight transition ${
                    active ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)] ring-2 ring-[var(--gold)]/40' : 'border-gray-200 bg-white text-gray-600 hover:border-[var(--gold)]/50'
                  }`}
                >
                  <CategoryIcon category={c} className={`h-5 w-5 ${active ? 'text-[var(--gold)]' : 'text-gray-500'}`} />
                  {t(`cat_${c}`)}
                </button>
              )
            })}
          </div>
        </div>

        {isMileage ? (
          <div className="space-y-3 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold-pale)]/40 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label} htmlFor="ns-from">
                  {t('fieldFrom')}
                </label>
                <input id="ns-from" className={input} value={form.routeFrom} maxLength={EXPENSE_LIMITS.place} onChange={(e) => set('routeFrom', e.target.value)} placeholder={t('fieldFromPlaceholder')} />
              </div>
              <div>
                <label className={label} htmlFor="ns-to">
                  {t('fieldTo')}
                </label>
                <input id="ns-to" className={input} value={form.routeTo} maxLength={EXPENSE_LIMITS.place} onChange={(e) => set('routeTo', e.target.value)} placeholder={t('fieldToPlaceholder')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label} htmlFor="ns-km">
                  {t('fieldKm')}
                </label>
                <input id="ns-km" className={input} inputMode="decimal" value={form.km} onChange={(e) => set('km', e.target.value)} placeholder="0" required />
              </div>
              <div>
                <label className={label} htmlFor="ns-rate">
                  {t('fieldKmRate')}
                </label>
                <input id="ns-rate" className={input} inputMode="decimal" value={form.kmRate} onChange={(e) => set('kmRate', e.target.value)} placeholder="0,00" required />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-[15px] font-semibold text-[var(--ink)]">
              <input type="checkbox" className="h-5 w-5 accent-[var(--gold)]" checked={form.roundTrip} onChange={(e) => set('roundTrip', e.target.checked)} />
              {t('fieldRoundTrip')}
            </label>
            <p className="flex gap-2 text-xs leading-relaxed text-[var(--muted)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" aria-hidden />
              {t('rateHelp')}
            </p>
            <div className="rounded-xl bg-[var(--ink)] px-3 py-2.5 text-white">
              {mileage !== null ? (
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="text-white/70">
                    {t('mileageCalc', { km: formatKm(kmRounded * (form.roundTrip ? 2 : 1), locale), rate: formatRate(rateRounded, locale) })}
                  </span>
                  <span className="text-lg font-bold text-[var(--gold-bright)]">{formatCents(mileage, locale)}</span>
                </p>
              ) : (
                <p className="text-sm text-white/70">{t('mileageEmpty')}</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <label className={label} htmlFor="ns-amount">
              {t('fieldAmount')}
            </label>
            <div className="relative">
              <input
                id="ns-amount"
                ref={amountRef}
                className={`${input} pr-10 text-2xl font-bold`}
                inputMode="decimal"
                autoFocus={!item}
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                placeholder="0,00"
                required
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">€</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className={label} htmlFor="ns-desc">
              {t('fieldDescription')}
            </label>
            <input
              id="ns-desc"
              className={input}
              value={form.description}
              maxLength={EXPENSE_LIMITS.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder={isMileage ? t('fieldDescriptionMileage') : t('fieldDescriptionPlaceholder')}
            />
          </div>
          <div>
            <label className={label} htmlFor="ns-date">
              {t('fieldDate')}
            </label>
            <input id="ns-date" type="date" className={`${input} w-[150px]`} value={form.spentOn} onChange={(e) => set('spentOn', e.target.value)} required />
          </div>
        </div>

        {/* Foto dello scontrino */}
        <div>
          <span className={label}>{t('fieldReceipt')}</span>
          {shownPhoto || photo.kind === 'saved' ? (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-2">
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {shownPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shownPhoto} alt={t('fieldReceipt')} className="h-full w-full object-cover" />
                )}
                {photo.kind === 'uploading' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <LoaderCircle className="h-6 w-6 animate-spin text-white" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-[var(--ink)]">{photo.kind === 'uploading' ? t('photoUploading') : t('photoReady')}</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  <button type="button" onClick={() => cameraRef.current?.click()} className="font-semibold text-[var(--gold)] underline-offset-2 hover:underline">
                    {t('photoChange')}
                  </button>
                  <button type="button" onClick={dropPhoto} className="inline-flex items-center gap-1 font-semibold text-red-600 underline-offset-2 hover:underline">
                    <X className="h-4 w-4" /> {t('photoRemove')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/40 px-3 py-3 text-sm font-bold text-[var(--ink)]"
              >
                <Camera className="h-5 w-5 text-[var(--gold)]" /> {t('photoTake')}
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-700"
              >
                <ImagePlus className="h-5 w-5" /> {t('photoGallery')}
              </button>
            </div>
          )}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          {photoError && <p className="mt-2 text-sm font-semibold text-red-600">{photoError}</p>}
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

        <div className="flex gap-2">
          <CancelButton className={cancelButtonLgClass} alwaysConfirm={photo.kind === 'ready'} />
          <button type="submit" className={primary} disabled={busy || photo.kind === 'uploading'}>
            {busy || photo.kind === 'uploading' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
            {photo.kind === 'uploading' ? t('photoUploading') : t('save')}
          </button>
        </div>
        {item && (
          <button type="button" onClick={remove} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> {t('itemDelete')}
          </button>
        )}
      </form>
    </Sheet>
  )
}

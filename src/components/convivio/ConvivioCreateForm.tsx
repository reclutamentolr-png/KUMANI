'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BadgeCheck, LoaderCircle, Search, Star, X } from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { createConvivio, searchSuppliers } from '@/app/actions/convivio'
import { CONVIVIO_CATEGORIES, type SupplierSearchResult } from '@/lib/convivio'

const input = 'w-full rounded-xl border border-[var(--gold)]/30 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

// Nuovo Convivio. mode 'leader': il capocordata sceglie un fornitore esterno
// (nome libero) o un fornitore KUMANI (che deve confermare). mode 'own':
// offerta di gruppo del fornitore Pro stesso (fornitore = chi pubblica).
export default function ConvivioCreateForm({
  mode,
  ownId,
  ownName,
  ownCategory,
  onClose,
  onCreated,
}: {
  mode: 'leader' | 'own'
  ownId?: string
  ownName?: string
  ownCategory?: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const t = useTranslations('convivio')
  const [form, setForm] = useState(() => ({
    title: '',
    category: ownCategory ?? 'food',
    supplier: '',
    unit: '',
    retail: '',
    price: '',
    min: '5',
    max: '',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    description: '',
    pickup: '',
  }))
  const [supplierMode, setSupplierMode] = useState<'external' | 'kumani'>('external')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SupplierSearchResult[]>([])
  const [chosen, setChosen] = useState<SupplierSearchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [{ minDate, maxDate }] = useState(() => ({
    minDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    maxDate: new Date(Date.now() + 59 * 86400000).toISOString().slice(0, 10),
  }))
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

  // Ricerca dei fornitori KUMANI (con un attimo di attesa mentre si scrive)
  useEffect(() => {
    if (mode !== 'leader' || supplierMode !== 'kumani') return
    const timer = setTimeout(() => {
      searchSuppliers(query).then(setResults)
    }, 300)
    return () => clearTimeout(timer)
  }, [mode, supplierMode, query])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const price = num(form.price)
    const min = Number(form.min)
    const max = num(form.max)
    if (price === null || Number.isNaN(price) || !(min >= 2) || (max !== null && max < min)) {
      setError(t('error_invalid'))
      return
    }
    if (mode === 'leader' && supplierMode === 'kumani' && !chosen) {
      setError(t('error_chooseSupplier'))
      return
    }
    setBusy(true)
    setError(null)
    const supplierId = mode === 'own' ? ownId : supplierMode === 'kumani' ? chosen?.id : null
    const result = await createConvivio({
      title: form.title,
      description: form.description,
      category: form.category,
      supplier: mode === 'own' ? (ownName ?? '') : supplierMode === 'kumani' ? (chosen?.business_name ?? '') : form.supplier,
      unit: form.unit,
      retail: num(form.retail),
      price,
      min,
      max,
      expiresAt: new Date(`${form.deadline}T23:59:00`).toISOString(),
      pickup: form.pickup,
      supplierId: supplierId ?? null,
    })
    setBusy(false)
    if (result.id) onCreated(result.id)
    else setError(t(`error_${result.error ?? 'saveError'}`))
  }

  return (
    <Sheet title={mode === 'own' ? t('createOfferTitle') : t('createTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={label}>{t('fieldTitle')}</label>
          <input className={input} value={form.title} maxLength={100} required autoFocus placeholder={t('fieldTitlePlaceholder')} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>

        <div>
          <label className={label}>{t('fieldCategory')}</label>
          <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CONVIVIO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category_${c}`)}
              </option>
            ))}
          </select>
        </div>

        {mode === 'own' ? (
          <p className="flex items-center gap-2 rounded-xl bg-[var(--gold-pale)]/60 px-3 py-2 text-sm text-[var(--ink)]">
            <BadgeCheck className="h-4 w-4 text-[var(--gold)]" /> {t('ownOfferSupplier', { name: ownName ?? '' })}
          </p>
        ) : (
          <div>
            <label className={label}>{t('fieldSupplier')}</label>
            <div className="mb-2 flex rounded-xl border border-[var(--gold)]/25 p-1">
              {(['external', 'kumani'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSupplierMode(m)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${supplierMode === m ? 'bg-[var(--ink)] text-white' : 'text-gray-600'}`}
                >
                  {m === 'external' ? t('supplierExternal') : t('supplierKumani')}
                </button>
              ))}
            </div>
            {supplierMode === 'external' ? (
              <input className={input} value={form.supplier} maxLength={120} required placeholder={t('fieldSupplierPlaceholder')} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            ) : chosen ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--gold)] bg-[var(--gold-pale)]/50 px-3 py-2.5">
                <span className="text-sm">
                  <span className="font-semibold text-[var(--ink)]">{chosen.business_name}</span> · {chosen.city}
                </span>
                <button type="button" onClick={() => setChosen(null)} className="text-gray-500" aria-label={t('cancel')}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input className={`${input} pl-9`} value={query} placeholder={t('supplierSearchPlaceholder')} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {results.length === 0 ? (
                    <li className="px-2 py-2 text-xs text-gray-500">{t('noSuppliersFound')}</li>
                  ) : (
                    results.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => setChosen(s)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--gold-pale)]/50">
                          <span className="block text-sm font-semibold text-[var(--ink)]">
                            {s.business_name}
                            {s.rating.count > 0 && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-normal text-amber-600">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {s.rating.avg} ({s.rating.count})
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {s.city} · {t(`category_${s.category}`)}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <p className="mt-1 text-xs text-gray-500">{t('supplierKumaniHint')}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>{t('fieldPrice')}</label>
            <input className={input} inputMode="decimal" value={form.price} required placeholder="32,00" onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div>
            <label className={label}>{t('fieldRetail')}</label>
            <input className={input} inputMode="decimal" value={form.retail} placeholder="48,00" onChange={(e) => setForm({ ...form, retail: e.target.value })} />
          </div>
          <div>
            <label className={label}>{t('fieldUnit')}</label>
            <input className={input} value={form.unit} maxLength={40} placeholder={t('fieldUnitPlaceholder')} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>{t('fieldMin')}</label>
            <input type="number" min={2} max={500} className={input} value={form.min} required onChange={(e) => setForm({ ...form, min: e.target.value })} />
          </div>
          <div>
            <label className={label}>{t('fieldMax')}</label>
            <input type="number" min={2} max={500} className={input} value={form.max} placeholder="—" onChange={(e) => setForm({ ...form, max: e.target.value })} />
          </div>
          <div>
            <label className={label}>{t('fieldDeadline')}</label>
            <input type="date" className={input} value={form.deadline} min={minDate} max={maxDate} required onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={label}>{t('fieldDescription')}</label>
          <textarea className={input} rows={3} maxLength={2000} value={form.description} placeholder={t('fieldDescriptionPlaceholder')} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className={label}>{t('fieldPickup')}</label>
          <textarea className={input} rows={2} maxLength={1000} value={form.pickup} required placeholder={t('fieldPickupPlaceholder')} onChange={(e) => setForm({ ...form, pickup: e.target.value })} />
          <p className="mt-1 text-xs text-gray-500">{mode === 'own' ? t('fieldPickupHintOwn') : t('fieldPickupHint')}</p>
        </div>
        {mode === 'leader' && supplierMode === 'kumani' && <p className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/60 px-3 py-2 text-xs text-[var(--ink)]">{t('supplierConfirmNote')}</p>}
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-50">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {mode === 'leader' && supplierMode === 'kumani' ? t('sendToSupplier') : t('publish')}
        </button>
      </form>
    </Sheet>
  )
}

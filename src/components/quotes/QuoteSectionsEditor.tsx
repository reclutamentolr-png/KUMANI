'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, BookmarkPlus, Check, ChevronDown, LibraryBig, Plus, Trash2, X } from 'lucide-react'
import { saveQuotePresets } from '@/app/actions/quotes'
import { LayersEditor, SectionImagePicker } from '@/components/quotes/QuoteSectionExtras'
import {
  MAX_QUOTE_PRESETS,
  MAX_QUOTE_SECTIONS,
  QUOTE_LAYER_COLORS,
  QUOTE_SECTION_KINDS,
  QUOTE_VAT_MODES,
  computeSectionsTotal,
  emptyQuoteSection,
  type QuoteFormData,
  type QuotePreset,
  type QuoteSection,
  type QuoteSectionKind,
} from '@/lib/quotes'
import { askConfirm } from '@/lib/confirm'

// Preventivo descrittivo: oggetto, lettera di apertura, sezioni (testo o
// elenco, con importo facoltativo), sezioni pronte, totale, chiusura e firma.

const input =
  'w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm bg-white'
const label = 'block text-sm font-medium text-gray-700 mb-1'
const KINDS: QuoteSectionKind[] = QUOTE_SECTION_KINDS
// Sezioni pronte di partenza (testo nelle 7 lingue), finché non se ne salvano di proprie
const STARTERS = ['oursCharges', 'yourCharges', 'technicalNote', 'conditions'] as const

type Props = {
  form: QuoteFormData
  setForm: React.Dispatch<React.SetStateAction<QuoteFormData>>
  initialPresets: QuotePreset[]
}

export default function QuoteSectionsEditor({ form, setForm, initialPresets }: Props) {
  const t = useTranslations('preventivi')
  const [presets, setPresets] = useState<QuotePreset[]>(initialPresets)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [savedIndex, setSavedIndex] = useState<number | null>(null)
  const [presetError, setPresetError] = useState(false)

  const sections = form.sections
  const setSections = (fn: (list: QuoteSection[]) => QuoteSection[]) => setForm((prev) => ({ ...prev, sections: fn(prev.sections) }))
  const update = (i: number, patch: Partial<QuoteSection>) => setSections((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const move = (i: number, dir: -1 | 1) =>
    setSections((list) => {
      const copy = [...list]
      const j = i + dir
      if (j < 0 || j >= copy.length) return list
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  const add = (section: QuoteSection) => {
    if (sections.length >= MAX_QUOTE_SECTIONS) return
    setSections((list) => [...list, section])
  }

  const starters: QuotePreset[] = STARTERS.map((k) => ({
    title: t(`preset_${k}_title`),
    kind: 'bullets',
    body: t(`preset_${k}_body`),
  }))
  const available = presets.length > 0 ? presets : starters

  const persist = async (next: QuotePreset[]) => {
    setPresetError(false)
    const r = await saveQuotePresets(next)
    if (r.success) setPresets(r.data)
    else setPresetError(true)
    return r.success
  }
  const saveAsPreset = async (i: number) => {
    const s = sections[i]
    if (!s.title.trim() && !s.body.trim() && !(s.layers?.length)) return
    const others = presets.filter((p) => p.title.trim().toLowerCase() !== s.title.trim().toLowerCase())
    if (others.length >= MAX_QUOTE_PRESETS) return setPresetError(true)
    if (await persist([...others, { title: s.title, kind: s.kind, body: s.body, ...(s.kind === 'layers' ? { layers: s.layers ?? [] } : {}) }])) {
      setSavedIndex(i)
      setTimeout(() => setSavedIndex(null), 2000)
    }
  }
  const removePreset = async (index: number) => {
    if (!(await askConfirm(t('presetDeleteConfirm')))) return
    await persist(presets.filter((_, j) => j !== index))
  }

  const total = computeSectionsTotal(sections)
  const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'EUR' })
  const vatSuffix = form.vatMode === 'plus' ? ` ${t('vatPlus')}` : form.vatMode === 'included' ? ` ${t('vatIncluded')}` : ''

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className={label}>{t('subjectField')}</label>
          <input className={input} maxLength={300} value={form.subject} placeholder={t('subjectPlaceholder')} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
        </div>
        <div>
          <label className={label}>{t('introField')}</label>
          <textarea className={input} rows={3} maxLength={3000} value={form.intro} onChange={(e) => setForm((p) => ({ ...p, intro: e.target.value }))} />
        </div>
      </div>

      <div className="border-t border-[var(--gold)]/15 pt-6">
        <h3 className="mb-1 font-bold text-[var(--ink)]">{t('sectionsTitle')}</h3>
        <p className="mb-4 text-xs text-gray-500">{t('sectionsHint')}</p>
        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="space-y-3 rounded-xl border-2 border-[var(--gold)]/20 bg-white p-4">
              <div className="flex items-start gap-2">
                <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-[var(--gold-bright)]">{i + 1}</span>
                <input className={`${input} font-semibold`} maxLength={160} value={s.title} placeholder={t('sectionTitlePlaceholder')} onChange={(e) => update(i, { title: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      update(i, {
                        kind: k,
                        ...(k === 'layers' && !(s.layers?.length)
                          ? { layers: [{ label: '', color: QUOTE_LAYER_COLORS[0] }, { label: '', color: QUOTE_LAYER_COLORS[1] }] }
                          : {}),
                      })
                    }
                    aria-pressed={s.kind === k}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold ${s.kind === k ? 'border-[var(--gold)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 text-gray-600'}`}
                  >
                    {t(`sectionKind_${k}`)}
                  </button>
                ))}
              </div>
              {s.kind === 'image' && <SectionImagePicker value={s.image} onChange={(path) => update(i, { image: path })} />}
              {s.kind === 'layers' && <LayersEditor layers={s.layers ?? []} onChange={(layers) => update(i, { layers })} />}
              <div>
                <textarea
                  className={input}
                  rows={s.kind === 'text' ? 4 : s.kind === 'image' || s.kind === 'layers' ? 2 : 5}
                  maxLength={6000}
                  value={s.body}
                  placeholder={s.kind === 'text' ? t('sectionTextPlaceholder') : s.kind === 'image' ? t('imageCaptionPlaceholder') : s.kind === 'layers' ? t('layersNotePlaceholder') : t('sectionListPlaceholder')}
                  onChange={(e) => update(i, { body: e.target.value })}
                />
                {(s.kind === 'numbered' || s.kind === 'bullets') && <p className="mt-1 text-xs text-gray-400">{t('sectionListHint')}</p>}
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="w-48">
                  <label className="mb-1 block text-xs font-medium text-gray-600">{t('sectionAmountField')}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={input}
                    value={s.amount ?? ''}
                    placeholder={t('sectionAmountPlaceholder')}
                    onChange={(e) => update(i, { amount: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-1">
                  {s.kind !== 'image' && (
                  <button type="button" onClick={() => saveAsPreset(i)} title={t('presetSave')} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--gold)] hover:bg-[var(--gold-pale)]">
                    {savedIndex === i ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />} {savedIndex === i ? t('presetSaved') : t('presetSave')}
                  </button>
                  )}
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('moveUp')} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label={t('moveDown')} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setSections((list) => list.filter((_, j) => j !== i))} aria-label={t('removeSection')} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button type="button" onClick={() => add(emptyQuoteSection())} className="flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline">
            <Plus className="h-4 w-4" /> {t('addSection')}
          </button>
          <button type="button" onClick={() => setPresetsOpen((o) => !o)} aria-expanded={presetsOpen} className="flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline">
            <LibraryBig className="h-4 w-4" /> {t('presetsOpen')} <ChevronDown className={`h-4 w-4 transition-transform ${presetsOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {presetsOpen && (
          <div className="mt-3 rounded-xl border-2 border-[var(--gold)]/25 bg-[var(--background)] p-3">
            <p className="mb-2 text-xs text-gray-500">{presets.length > 0 ? t('presetsHintSaved') : t('presetsHintStarters')}</p>
            <ul className="divide-y divide-[var(--gold)]/10">
              {available.map((p, i) => (
                <li key={`${p.title}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      add({ ...p, amount: null })
                      setPresetsOpen(false)
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-semibold text-[var(--ink)]">{p.title || '—'}</span>
                    <span className="block truncate text-xs text-gray-500">{p.body.split('\n')[0]}</span>
                  </button>
                  {presets.length > 0 && (
                    <button type="button" onClick={() => removePreset(i)} aria-label={t('presetDelete')} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {presetError && <p className="mt-2 text-sm text-red-600">{t('presetError', { max: MAX_QUOTE_PRESETS })}</p>}
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--gold)]/15 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <input type="checkbox" className="h-5 w-5 accent-[var(--gold)]" checked={form.showTotal} onChange={(e) => setForm((p) => ({ ...p, showTotal: e.target.checked }))} />
            {t('showTotalField')}
          </label>
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">{t('vatModeField')}</span>
            <div className="flex flex-wrap gap-1.5">
              {QUOTE_VAT_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, vatMode: m }))}
                  aria-pressed={form.vatMode === m}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold ${form.vatMode === m ? 'border-[var(--gold)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 text-gray-600'}`}
                >
                  {t(`vatMode_${m}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        {form.showTotal && (
          <div className="rounded-xl bg-[var(--gold-pale)] px-5 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-[var(--ink)]/70">{t('totalLabel')}</p>
            <p className="text-2xl font-bold text-[var(--ink)]">
              {money(total)}
              <span className="text-sm font-semibold">{vatSuffix}</span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-[var(--gold)]/15 pt-6">
        <div>
          <label className={label}>{t('closingField')}</label>
          <textarea className={input} rows={2} maxLength={1000} value={form.closing} onChange={(e) => setForm((p) => ({ ...p, closing: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" className="h-5 w-5 accent-[var(--gold)]" checked={form.signature} onChange={(e) => setForm((p) => ({ ...p, signature: e.target.checked }))} />
          {t('signatureField')}
        </label>
      </div>
    </div>
  )
}

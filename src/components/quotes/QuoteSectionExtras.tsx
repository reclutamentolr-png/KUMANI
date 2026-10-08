'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/resizeImage'
import { MAX_QUOTE_LAYERS, QUOTE_LAYER_COLORS, quoteImageUrl, type QuoteLayer } from '@/lib/quotes'

// Parti dell'editor delle sezioni «Immagine» e «Stratigrafia»

const input =
  'w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm bg-white'

export function SectionImagePicker({ value, onChange }: { value: string | null | undefined; onChange: (path: string | null) => void }) {
  const t = useTranslations('preventivi')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(false)
    try {
      const resized = await resizeImageFile(file, 1800, 0.85)
      if (!resized) throw new Error('resize')
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('auth')
      const ext = resized.type === 'image/png' ? 'png' : resized.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${user.id}/quote-images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('quote-logos-v2').upload(path, resized, { contentType: resized.type })
      if (uploadError) throw uploadError
      onChange(path)
    } catch (err) {
      console.error('[preventivo] immagine:', err)
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={quoteImageUrl(value)} alt="" className="max-h-64 w-full rounded-lg border border-gray-200 bg-gray-50 object-contain" />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-[var(--gold)]/30 px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 text-[var(--gold)]" />}
          {value ? t('imageChange') : t('imageChoose')}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-sm font-semibold text-red-600">
            {t('imageRemove')}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{t('imageError')}</p>}
      <p className="text-xs text-gray-400">{t('imageHint')}</p>
    </div>
  )
}

export function LayersEditor({ layers, onChange }: { layers: QuoteLayer[]; onChange: (layers: QuoteLayer[]) => void }) {
  const t = useTranslations('preventivi')
  const set = (i: number, patch: Partial<QuoteLayer>) => onChange(layers.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= layers.length) return
    const copy = [...layers]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    onChange(copy)
  }
  // Elenco mostrato dall'alto (ultimo strato) al basso (supporto), come nel disegno
  const order = layers.map((_, i) => i).reverse()
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{t('layersHint')}</p>
      {order.map((i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="color"
            value={layers[i].color}
            onChange={(e) => set(i, { color: e.target.value })}
            aria-label={t('layerColor')}
            className="h-9 w-10 shrink-0 cursor-pointer rounded border border-gray-300"
          />
          <input
            className={input}
            maxLength={160}
            value={layers[i].label}
            placeholder={i === 0 ? t('layerBasePlaceholder') : t('layerPlaceholder')}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          {i === 0 && <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600">{t('layerBase')}</span>}
          <button type="button" onClick={() => move(i, 1)} disabled={i === layers.length - 1} aria-label={t('moveUp')} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('moveDown')} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onChange(layers.filter((_, j) => j !== i))} aria-label={t('layerRemove')} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {layers.length < MAX_QUOTE_LAYERS && (
        <button
          type="button"
          onClick={() => onChange([...layers, { label: '', color: QUOTE_LAYER_COLORS[layers.length % QUOTE_LAYER_COLORS.length] }])}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline"
        >
          <Plus className="h-4 w-4" /> {t('layerAdd')}
        </button>
      )}
    </div>
  )
}

// Stratigrafia nella pagina del preventivo (il disegno vero è nel PDF)
export function LayersView({ layers }: { layers: QuoteLayer[] }) {
  const list = layers.filter((l) => l.label.trim())
  if (!list.length) return null
  const [base, ...upper] = list
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-3">
        {upper
          .map((l, i) => ({ l, i }))
          .reverse()
          .map(({ l, i }) => (
            <div key={i} className="h-2.5 border border-black/10" style={{ background: l.color, marginLeft: `${6 + i * (60 / Math.max(upper.length, 1))}%` }} />
          ))}
        <div className="flex h-10 items-center border border-black/15 px-3 text-xs font-bold" style={{ background: base.color }}>
          {base.label}
        </div>
      </div>
      <ol className="space-y-1 text-sm text-gray-700">
        {[...list].reverse().map((l, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-3 w-5 shrink-0 rounded-sm border border-black/15" style={{ background: l.color }} />
            {l.label}
          </li>
        ))}
      </ol>
    </div>
  )
}

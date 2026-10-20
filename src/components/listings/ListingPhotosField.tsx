'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ImagePlus, LoaderCircle, Star, X } from 'lucide-react'
import { uploadListingPhoto } from '@/app/actions/listings'
import { resizeImageFile } from '@/lib/resizeImage'

// Foto dell'annuncio (fino a `max`, scelto in Admin → Bacheca): ogni foto si
// comprime nel browser (WebP, lato lungo 1600 px) e poi si carica. La prima
// è la copertina (quella della scheda); con la freccia una foto passa prima.
export default function ListingPhotosField({ value, onChange, max }: { value: string[]; onChange: (urls: string[]) => void; max: number }) {
  const t = useTranslations('marketplace')
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const room = Math.max(0, max - value.length)

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    const chosen = [...files].slice(0, room)
    if (files.length > room) setError(t('listingPhotosMax', { max }))
    setBusy(chosen.length)
    let urls = [...value]
    for (const file of chosen) {
      const small = await resizeImageFile(file, 1600, 0.82, { webp: true, keepIfUnderBytes: 250 * 1024 })
      if (!small) {
        setError(t('listingPhotoError'))
        setBusy((n) => n - 1)
        continue
      }
      const data = new FormData()
      data.append('file', small)
      const r = await uploadListingPhoto(data)
      if (r.success) {
        urls = [...urls, r.url]
        onChange(urls)
      } else setError(t.has(r.message) ? t(r.message) : t('listingPhotoError'))
      setBusy((n) => n - 1)
    }
    if (input.current) input.current.value = ''
  }

  const remove = (i: number) => onChange(value.filter((_, k) => k !== i))
  const toFront = (i: number) => onChange([value[i], ...value.filter((_, k) => k !== i)])

  return (
    <div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => pick(e.target.files)} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {value.map((url, i) => (
          <div key={url} className={`relative aspect-square overflow-hidden rounded-xl border-2 ${i === 0 ? 'border-[var(--gold)]' : 'border-stone-200'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i === 0 ? (
              <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-[var(--ink)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--gold-bright)]">
                <Star className="h-2.5 w-2.5" /> {t('listingPhotoCover')}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => toFront(i)}
                aria-label={t('listingPhotoMakeCover')}
                title={t('listingPhotoMakeCover')}
                className="absolute bottom-1 left-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[var(--ink)] shadow"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t('listingPhotoRemove')}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-white shadow"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`busy-${i}`} className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/40">
            <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" />
          </div>
        ))}
        {room - busy > 0 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy > 0}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/40 p-1 text-center text-[11px] font-bold text-[var(--ink)] hover:border-[var(--gold)] disabled:opacity-60"
          >
            <ImagePlus className="h-6 w-6 text-[var(--gold)]" />
            {value.length ? t('listingPhotoAdd') : t('listingPhotoUpload')}
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-[var(--muted)]">{t('listingPhotosHint', { count: value.length, max })}</p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

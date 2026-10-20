'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ImagePlus, LoaderCircle, X } from 'lucide-react'
import { uploadListingPhoto } from '@/app/actions/listings'
import { resizeImageFile } from '@/lib/resizeImage'

// «Carica foto» dell'annuncio (al posto dell'indirizzo di un'immagine): la
// foto si comprime nel browser (WebP, lato lungo 1600 px, buona qualità) e
// poi si carica. Dal telefono si può scattare o scegliere dalla galleria.
export default function ListingPhotoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const t = useTranslations('marketplace')
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const small = await resizeImageFile(file, 1600, 0.82, { webp: true, keepIfUnderBytes: 250 * 1024 })
      if (!small) return setError(t('listingPhotoError'))
      const data = new FormData()
      data.append('file', small)
      const r = await uploadListingPhoto(data)
      if (!r.success) return setError(t.has(r.message) ? t(r.message) : t('listingPhotoError'))
      onChange(r.url)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-32 w-auto max-w-full rounded-xl border border-gray-200 object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('listingPhotoRemove')}
            className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)] text-white shadow"
          >
            <X className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="mt-2 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
            {busy ? t('listingPhotoUploading') : t('listingPhotoChange')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/40 px-4 py-6 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)] disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" /> : <ImagePlus className="h-6 w-6 text-[var(--gold)]" />}
          {busy ? t('listingPhotoUploading') : t('listingPhotoUpload')}
          <span className="text-xs font-normal text-[var(--muted)]">{t('listingPhotoHint')}</span>
        </button>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, LoaderCircle, Trash2 } from 'lucide-react'
import { removeProfilePhoto, uploadProfilePhoto } from '@/app/actions/profilePhoto'
import { profilePhotoUrl } from '@/lib/profilePhoto'

// Ritaglio quadrato al centro e lato di 512 px: la foto pesa poco e nel
// cerchio si vede sempre intera, senza deformarsi
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const size = Math.min(512, side)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('photo'))), 'image/jpeg', 0.85))
}

// Profilo: foto che prende il posto dell'iniziale del nome in alto
export default function ProfilePhotoSection({
  path,
  initial,
  onChange,
}: {
  path: string | null
  initial: string
  onChange: (path: string | null) => void
}) {
  const t = useTranslations('profilePhoto')
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const url = profilePhotoUrl(path)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(false)
    try {
      const form = new FormData()
      form.append('file', new File([await squarePhoto(file)], 'foto.jpg', { type: 'image/jpeg' }))
      const result = await uploadProfilePhoto(form)
      if (result.success) onChange(result.path)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(false)
    if (await removeProfilePhoto().catch(() => false)) onChange(null)
    else setError(true)
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--gold)]/30 px-4 py-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--gold)] text-2xl font-bold text-white">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={t('alt')} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">{initial}</span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <LoaderCircle className="h-6 w-6 animate-spin text-white" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--ink)]">{t('title')}</p>
        <p className="text-xs text-gray-500">{t('hint')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 text-xs font-semibold text-white hover:bg-[var(--ink-soft)] disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" /> {url ? t('change') : t('add')}
          </button>
          {url && (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t('remove')}
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs font-semibold text-red-600">{t('error')}</p>}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    </div>
  )
}

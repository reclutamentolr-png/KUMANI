'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { FileText, LoaderCircle, Paperclip, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/resizeImage'
import { CASA_FILE_MAX_BYTES, CASA_FILE_TYPES, fileExtension } from '@/lib/casa'
import { discardUpload } from '@/app/actions/casa'

export const input =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20'
export const label = 'mb-1 block text-sm font-semibold text-[var(--ink)]'
export const card = 'rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-[0_8px_24px_rgba(23,23,23,0.06)]'
export const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm hover:brightness-105 disabled:opacity-60'
export const ghostBtn = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50'

// Numero scritto all'italiana o all'inglese ("12,50" o "12.50"); vuoto → null
export function parseNumber(value: string): number | null {
  const clean = value.trim().replace(/\s/g, '').replace('€', '')
  if (!clean) return null
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

export function useFormat() {
  const locale = useLocale()
  return {
    eur: (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value),
    date: (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    size: (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`),
  }
}

// Esegue un'azione del server e ricarica la pagina; l'errore come testo
export function useAction() {
  const t = useTranslations('casa')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (action: () => Promise<{ success: boolean; message?: string }>, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        const key = `error_${(result as { message: string }).message}`
        setError(t.has(key) ? t(key) : t('error_saveError'))
        return
      }
      after?.()
      router.refresh()
    })
  }
  return { run, isPending, error, setError }
}

// Finestra sopra la pagina per aggiungere o modificare (dal basso sul telefono)
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = useTranslations('casa')
  // onClose cambia a ogni render: letto da un ref, l'effetto gira una volta
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [])
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg animate-[kumaniPop_160ms_ease-out] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--ink)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// Carica un file (PDF o foto) nella cartella della casa. Le foto grandi si
// rimpiccioliscono prima. Restituisce il percorso nello spazio privato.
export async function uploadCasaFile(homeId: string, file: File): Promise<{ path: string; name: string; type: string; size: number } | { error: 'fileType' | 'fileSize' | 'uploadError' }> {
  let upload: File = file
  if (!CASA_FILE_TYPES.includes(file.type)) return { error: 'fileType' }
  if (file.type.startsWith('image/')) {
    upload = (await resizeImageFile(file, 2000, 0.85).catch(() => null)) ?? file
  }
  if (upload.size > CASA_FILE_MAX_BYTES) return { error: 'fileSize' }
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'uploadError' }
  const path = `${user.id}/${homeId}/${crypto.randomUUID()}.${fileExtension(upload)}`
  const { error } = await supabase.storage.from('casa-files').upload(path, upload, { contentType: upload.type, upsert: false })
  if (error) {
    console.error('[Casa] upload failed:', error.message)
    return { error: 'uploadError' }
  }
  return { path, name: file.name, type: upload.type, size: upload.size }
}

// Campo file: carica subito e mostra il file scelto (o quello già salvato)
export function FileField({
  homeId,
  labelText,
  value,
  url,
  onChange,
}: {
  homeId: string
  labelText: string
  value: string | null
  url?: string | null
  onChange: (path: string | null, meta?: { name: string; type: string; size: number }) => void
}) {
  const t = useTranslations('casa')
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    const result = await uploadCasaFile(homeId, file)
    setBusy(false)
    if ('error' in result) {
      setError(t(`error_${result.error}`))
      return
    }
    setName(result.name)
    onChange(result.path, result)
  }
  return (
    <div>
      <span className={label}>{labelText}</span>
      {value ? (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[var(--paper)] px-3 py-2.5 text-sm">
          <Paperclip className="h-4 w-4 shrink-0 text-[var(--gold)]" />
          {url && !name ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)] underline">
              {t('fileSaved')}
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)]">{name ?? t('fileSaved')}</span>
          )}
          <button
            type="button"
            onClick={() => {
              // Caricato ora e poi tolto: via subito dallo spazio
              if (name && value) void discardUpload(homeId, value)
              setName(null)
              onChange(null)
            }}
            aria-label={t('removeFile')}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className={`${ghostBtn} w-full`}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {busy ? t('uploading') : t('chooseFile')}
        </button>
      )}
      <input ref={ref} type="file" accept={CASA_FILE_TYPES.join(',')} className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? undefined)} />
      <p className="mt-1 text-xs text-[var(--muted)]">{t('fileHint')}</p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

export function FileLink({ url, children }: { url: string | undefined; children: ReactNode }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-[var(--gold)]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
    >
      <FileText className="h-3.5 w-3.5 text-[var(--gold)]" /> {children}
    </a>
  )
}

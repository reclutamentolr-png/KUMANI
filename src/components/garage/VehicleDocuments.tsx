'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ExternalLink, FileText, IdCard, LoaderCircle, Plus, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react'
import { addVehicleDocument, deleteVehicleDocument } from '@/app/actions/garage'
import { createClient } from '@/lib/supabase/client'
import { prepareDocumentFile } from '@/lib/documentImage'
import { GARAGE_DOC_KINDS, type GarageDocKind, type GarageDocument } from '@/lib/garage'
import { askConfirm } from '@/lib/confirm'
import { limitTextOf } from '@/lib/limitText'

const card = 'rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-[0_8px_24px_rgba(23,23,23,0.06)]'
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024
const KIND_ICON: Record<GarageDocKind, LucideIcon> = { registration: IdCard, insurance: ShieldCheck, other: FileText }

const extension = (type: string) => ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[type] ?? 'jpg'

// Documenti del veicolo: libretto, assicurazione e altro, in foto (anche
// fronte e retro) o PDF. Visibili solo a chi li carica.
export default function VehicleDocuments({ vehicleId, documents, fileUrls }: { vehicleId: string; documents: GarageDocument[]; fileUrls: Record<string, string> }) {
  const t = useTranslations('garage')
  const locale = useLocale()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<GarageDocKind | null>(null)
  const [busy, setBusy] = useState<GarageDocKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = (kind: GarageDocKind) => {
    setPending(kind)
    setError(null)
    input.current?.click()
  }

  const upload = async (file: File | undefined) => {
    const kind = pending
    if (input.current) input.current.value = ''
    if (!file || !kind) return
    if (!FILE_TYPES.includes(file.type)) return setError(t('error_fileType'))
    // Foto ottimizzate per lo spazio ma buone anche da stampare
    const ready = await prepareDocumentFile(file)
    if (ready.size > MAX_BYTES) return setError(t('error_fileSize'))
    setBusy(kind)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setBusy(null)
      return setError(t('error_notLoggedIn'))
    }
    const path = `${user.id}/${vehicleId}/${crypto.randomUUID()}.${extension(ready.type)}`
    const { error: uploadError } = await supabase.storage.from('garage-files').upload(path, ready, { contentType: ready.type })
    if (uploadError) {
      setBusy(null)
      // Rifiutato dal tetto dei file per persona (impostato dall'Admin)
      return setError(/row-level security/i.test(uploadError.message) ? t('error_filesLimit') : t('error_uploadError'))
    }
    const result = await addVehicleDocument(vehicleId, { kind, filePath: path, fileName: file.name, mimeType: ready.type, sizeBytes: ready.size })
    setBusy(null)
    if (!result.success) return setError(limitTextOf(result) ?? (t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError')))
    router.refresh()
  }

  const remove = async (doc: GarageDocument) => {
    if (!(await askConfirm(t('deleteDocumentConfirm', { name: t(`doc_${doc.kind}`) })))) return
    const result = await deleteVehicleDocument(doc.id)
    if (!result.success) return setError(t('error_saveError'))
    router.refresh()
  }

  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <section className={card}>
      <h2 className="text-lg font-bold text-[var(--ink)]">{t('documentsTitle')}</h2>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{t('documentsHint')}</p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {GARAGE_DOC_KINDS.map((kind) => {
          const Icon = KIND_ICON[kind]
          return (
            <button
              key={kind}
              type="button"
              onClick={() => pick(kind)}
              disabled={busy !== null}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/40 px-3 py-3 text-sm font-bold text-[var(--ink)] hover:border-[var(--gold)] disabled:opacity-60"
            >
              {busy === kind ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <Icon className="h-4 w-4 text-[var(--gold)]" /> {t(`addDoc_${kind}`)}
            </button>
          )
        })}
      </div>
      <input ref={input} type="file" accept={FILE_TYPES.join(',')} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <p className="mt-2 text-xs text-[var(--muted)]">{t('documentsFileHint')}</p>
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}

      {documents.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
          {documents.map((doc) => {
            const Icon = KIND_ICON[doc.kind]
            const url = fileUrls[doc.file_path]
            const isImage = doc.mime_type?.startsWith('image/')
            return (
              <li key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
                {isImage && url ? (
                  // Anteprima della foto (link firmato, valido un'ora)
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-gray-200 object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--gold-pale)] text-[var(--gold)]">
                    <Icon className="h-5 w-5" />
                  </span>
                )}
                <a href={url} target="_blank" rel="noopener noreferrer" className="group min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-semibold text-[var(--ink)] group-hover:text-[var(--gold)]">
                    {t(`doc_${doc.kind}`)} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </span>
                  <span className="block truncate text-xs text-[var(--muted)]">{date(doc.created_at)}</span>
                </a>
                <button type="button" onClick={() => remove(doc)} aria-label={t('delete')} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

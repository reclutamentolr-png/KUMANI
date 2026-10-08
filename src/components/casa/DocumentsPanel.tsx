'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarClock, ExternalLink, FileText, Image as ImageIcon, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { deleteDocument, discardUpload, saveDocument } from '@/app/actions/casa'
import { DOCUMENT_KINDS, type CasaDocument, type DocumentForm } from '@/lib/casa'
import { askConfirm } from '@/lib/confirm'
import { FileField, Sheet, card, ghostBtn, input, label, primaryBtn, useAction, useFormat } from '@/components/casa/shared'

type Editing = { id?: string; form: DocumentForm }

const emptyForm = (): DocumentForm => ({ kind: 'lease', title: '', filePath: '', fileName: '', mimeType: '', sizeBytes: 0, expiresOn: '' })

export default function DocumentsPanel({
  homeId,
  documents,
  fileUrls,
  today,
}: {
  homeId: string
  documents: CasaDocument[]
  fileUrls: Record<string, string>
  today: string
}) {
  const t = useTranslations('casa')
  const f = useFormat()
  const { run, isPending, error, setError } = useAction()
  const [editing, setEditing] = useState<Editing | null>(null)

  const open = (doc?: CasaDocument) => {
    setError(null)
    setEditing(
      doc
        ? {
            id: doc.id,
            form: { kind: doc.kind, title: doc.title, filePath: doc.file_path, fileName: doc.file_name ?? '', mimeType: doc.mime_type ?? '', sizeBytes: doc.size_bytes ?? 0, expiresOn: doc.expires_on ?? '' },
          }
        : { form: emptyForm() }
    )
  }
  const set = <K extends keyof DocumentForm>(key: K, value: DocumentForm[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e))

  // Chiuso senza salvare: il file appena caricato non resta nello spazio
  const cancel = () => {
    if (editing && !editing.id && editing.form.filePath) void discardUpload(homeId, editing.form.filePath)
    setEditing(null)
  }
  const remove = async (doc: CasaDocument) => {
    if (!(await askConfirm(t('deleteDocumentConfirm', { name: doc.title })))) return
    run(() => deleteDocument(doc.id))
  }

  // Raggruppati per tipo, nell'ordine dell'elenco dei tipi
  const groups = DOCUMENT_KINDS.map((kind) => ({ kind, items: documents.filter((d) => d.kind === kind) })).filter((g) => g.items.length)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">{t('documentsIntro')}</p>
        <button type="button" onClick={() => open()} className={primaryBtn}>
          <Plus className="h-4 w-4" /> {t('addDocument')}
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-white px-6 py-8 text-center">
          <FileText className="mx-auto h-9 w-9 text-[var(--gold)]" />
          <p className="mt-2 font-bold text-[var(--ink)]">{t('documentsEmptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t('documentsEmptyText')}</p>
        </div>
      ) : (
        groups.map(({ kind, items }) => (
          <section key={kind} className={`${card} !p-0 overflow-hidden`}>
            <h3 className="border-b border-[var(--gold)]/20 bg-[var(--paper)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]">
              {t(`docKind_${kind}`)} <span className="font-normal text-[var(--muted)]">({items.length})</span>
            </h3>
            <ul className="divide-y divide-gray-100">
              {items.map((doc) => {
                const expired = !!doc.expires_on && doc.expires_on < today
                const isImage = doc.mime_type?.startsWith('image/')
                return (
                  <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--gold-pale)] text-[var(--gold)]">
                      {isImage ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={fileUrls[doc.file_path]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 truncate font-semibold text-[var(--ink)] hover:text-[var(--gold)]"
                      >
                        <span className="truncate">{doc.title}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                      <p className="text-xs text-[var(--muted)]">
                        {f.date(doc.created_at.slice(0, 10))}
                        {doc.size_bytes ? ` · ${f.size(doc.size_bytes)}` : ''}
                        {doc.expires_on && (
                          <span className={expired ? 'font-semibold text-red-600' : ''}>
                            {' · '}
                            <CalendarClock className="inline h-3 w-3" /> {expired ? t('docExpired', { date: f.date(doc.expires_on) }) : t('docExpires', { date: f.date(doc.expires_on) })}
                          </span>
                        )}
                      </p>
                    </div>
                    <button type="button" onClick={() => open(doc)} aria-label={t('edit')} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => remove(doc)} aria-label={t('delete')} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
      {error && !editing && <p className="text-sm text-red-600">{error}</p>}

      {editing && (
        <Sheet title={editing.id ? t('editDocument') : t('addDocument')} onClose={cancel}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(() => saveDocument(homeId, editing.form, editing.id), () => setEditing(null))
            }}
            className="space-y-4"
          >
            <div>
              <span className={label}>{t('docKind')}</span>
              <div className="flex flex-wrap gap-1.5">
                {DOCUMENT_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setEditing((x) => (x ? { ...x, form: { ...x.form, kind, title: x.form.title || t(`docKind_${kind}`) } } : x))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      editing.form.kind === kind ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'
                    }`}
                  >
                    {t(`docKind_${kind}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={label} htmlFor="doc-title">
                {t('docTitle')}
              </label>
              <input id="doc-title" className={input} value={editing.form.title} onChange={(e) => set('title', e.target.value)} maxLength={100} placeholder={t('docTitlePlaceholder')} required />
            </div>
            {!editing.id && (
              <FileField
                homeId={homeId}
                labelText={t('docFile')}
                value={editing.form.filePath || null}
                onChange={(path, meta) =>
                  setEditing((x) =>
                    x
                      ? {
                          ...x,
                          form: {
                            ...x.form,
                            filePath: path ?? '',
                            fileName: meta?.name ?? '',
                            mimeType: meta?.type ?? '',
                            sizeBytes: meta?.size ?? 0,
                            title: x.form.title || (meta?.name ? meta.name.replace(/\.[^.]+$/, '').slice(0, 100) : ''),
                          },
                        }
                      : x
                  )
                }
              />
            )}
            <div>
              <label className={label} htmlFor="doc-expires">
                {t('docExpiresOn')}
              </label>
              <input id="doc-expires" type="date" className={input} value={editing.form.expiresOn} onChange={(e) => set('expiresOn', e.target.value)} />
              <p className="mt-1 text-xs text-[var(--muted)]">{t('docExpiresHint')}</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={cancel} className={`${ghostBtn} flex-1`}>
                {t('cancel')}
              </button>
              <button type="submit" disabled={isPending || (!editing.id && !editing.form.filePath)} className={`${primaryBtn} flex-1`}>
                {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('save')}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  )
}

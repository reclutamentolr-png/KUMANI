'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, FileText, LoaderCircle, Pencil, Plus, Presentation, Trash2, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  adminConfirmDocUpload,
  adminCreateDocUploadUrl,
  adminDeleteDocFile,
  adminDeleteDocument,
  adminListDocuments,
  adminSaveDocument,
} from '@/app/actions/adminDocuments'
import { DOC_BUCKET, DOC_CATEGORIES, DOC_FORMATS, DOC_LOCALES, DOC_MIME, type DocCategory, type DocFormat, type DocLocale, type KumaniDoc, type Localized } from '@/lib/documents'
import { notify } from '@/lib/adminNotify'
import FlyersAdminSection from '@/components/admin/FlyersAdminSection'
import { askConfirm } from '@/lib/confirm'

// Admin → Documenti KUMANI: il materiale ufficiale che gli iscritti trovano in
// Documenti → Doc KUMANI. Ogni documento ha titolo e descrizione nelle 7
// lingue e un file PDF e/o PowerPoint per lingua.

const LANG_NAMES: Record<DocLocale, string> = { it: 'Italiano', en: 'Inglese', fr: 'Francese', es: 'Spagnolo', pt: 'Portoghese', de: 'Tedesco', ru: 'Russo' }
const CATEGORY_NAMES: Record<DocCategory, string> = { presentation: 'Presentazione', rules: 'Regole', guide: 'Guida', other: 'Altro' }
const FORMAT_NAMES: Record<DocFormat, string> = { pdf: 'PDF', pptx: 'PowerPoint' }

type Draft = { id?: string; title: Localized; description: Localized; category: DocCategory; sort_order: number; is_published: boolean }
const emptyDraft = (): Draft => ({ title: {}, description: {}, category: 'presentation', sort_order: 0, is_published: false })

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

export default function DocumentsAdminPanel() {
  const [docs, setDocs] = useState<KumaniDoc[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const apply = useCallback((r: Awaited<ReturnType<typeof adminListDocuments>>) => {
    if (!r.success) setError(r.error)
    else {
      setError(null)
      setDocs(r.documents)
    }
  }, [])
  const reload = () => adminListDocuments().then(apply)
  useEffect(() => {
    adminListDocuments().then(apply)
  }, [apply])

  const save = async () => {
    if (!draft) return
    setBusy('save')
    const r = await adminSaveDocument(draft)
    setBusy(null)
    if (!r.success) return notify('Errore: ' + r.error)
    notify('Documento salvato', 'success')
    setDraft(null)
    reload()
  }

  const togglePublished = async (d: KumaniDoc) => {
    setBusy('pub-' + d.id)
    const r = await adminSaveDocument({ id: d.id, title: d.title, description: d.description, category: d.category, sort_order: d.sort_order, is_published: !d.is_published })
    setBusy(null)
    if (!r.success) return notify('Errore: ' + r.error)
    reload()
  }

  const remove = async (d: KumaniDoc) => {
    if (!(await askConfirm(`Eliminare "${d.title.it}" e tutti i suoi file?`))) return
    setBusy('del-' + d.id)
    const r = await adminDeleteDocument(d.id)
    setBusy(null)
    if (!r.success) return notify('Errore: ' + r.error)
    reload()
  }

  const upload = async (d: KumaniDoc, locale: DocLocale, format: DocFormat, file: File) => {
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext !== format) return notify(`Scegli un file .${format}`)
    const key = `up-${d.id}-${locale}-${format}`
    setBusy(key)
    try {
      const url = await adminCreateDocUploadUrl({ documentId: d.id, locale, format, size: file.size })
      if (!url.success) return notify('Errore: ' + url.error)
      const { error: upErr } = await createClient().storage.from(DOC_BUCKET).uploadToSignedUrl(url.path, url.token, file, { contentType: DOC_MIME[format] })
      if (upErr) return notify('Caricamento non riuscito: ' + upErr.message)
      const ok = await adminConfirmDocUpload({ documentId: d.id, locale, format, path: url.path, fileName: file.name, size: file.size })
      if (!ok.success) return notify('Errore: ' + ok.error)
      notify(`${LANG_NAMES[locale]} · ${FORMAT_NAMES[format]} caricato`, 'success')
      reload()
    } finally {
      setBusy(null)
    }
  }

  const removeFile = async (fileId: string) => {
    if (!(await askConfirm('Eliminare questo file?'))) return
    setBusy('df-' + fileId)
    const r = await adminDeleteDocFile(fileId)
    setBusy(null)
    if (!r.success) return notify('Errore: ' + r.error)
    reload()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documenti KUMANI</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Il materiale ufficiale che gli iscritti scaricano da Documenti → Doc KUMANI: presentazione, regolamenti, guide. Ogni documento può avere un PDF e un PowerPoint per ciascuna lingua. Gli utenti vedono prima la loro lingua.
          </p>
        </div>
        <button type="button" onClick={() => setDraft(emptyDraft())} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
          <Plus className="h-4 w-4" /> Nuovo documento
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {draft && (
        <section className="space-y-4 rounded-xl border border-gray-300 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">{draft.id ? 'Modifica documento' : 'Nuovo documento'}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-gray-700">Tipo</span>
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as DocCategory })} className="w-full rounded-lg border border-gray-300 px-3 py-2">
                {DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_NAMES[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-gray-700">Ordine (più basso = prima)</span>
              <input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-gray-700">
              <input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} />
              Visibile agli iscritti
            </label>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            {DOC_LOCALES.map((l) => (
              <div key={l} className="grid gap-2 border-b border-gray-100 p-3 last:border-0 sm:grid-cols-[110px_1fr_1.4fr]">
                <span className="pt-2 text-sm font-semibold text-gray-700">
                  {LANG_NAMES[l]}
                  {l === 'it' && <span className="text-red-600"> *</span>}
                </span>
                <input
                  value={draft.title[l] ?? ''}
                  onChange={(e) => setDraft({ ...draft, title: { ...draft.title, [l]: e.target.value } })}
                  placeholder="Titolo"
                  maxLength={120}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  value={draft.description[l] ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: { ...draft.description, [l]: e.target.value } })}
                  placeholder="Descrizione breve (facoltativa)"
                  maxLength={400}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">Se manca una traduzione, gli utenti di quella lingua vedono il testo italiano.</p>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
              {busy === 'save' && <LoaderCircle className="h-4 w-4 animate-spin" />} Salva
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Annulla
            </button>
          </div>
        </section>
      )}

      {docs && docs.length === 0 && !draft && <p className="text-sm text-gray-500">Nessun documento. Crea il primo con “Nuovo documento”.</p>}

      {(docs ?? []).map((d) => (
        <section key={d.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {CATEGORY_NAMES[d.category]} · ordine {d.sort_order}
              </p>
              <h3 className="text-lg font-bold text-gray-900">{d.title.it}</h3>
              {d.description.it && <p className="text-sm text-gray-600">{d.description.it}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => togglePublished(d)}
                disabled={busy !== null}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${d.is_published ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-600'}`}
              >
                {d.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {d.is_published ? 'Visibile' : 'Nascosto'}
              </button>
              <button type="button" onClick={() => setDraft({ id: d.id, title: d.title, description: d.description, category: d.category, sort_order: d.sort_order, is_published: d.is_published })} className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50" aria-label="Modifica">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => remove(d)} disabled={busy !== null} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" aria-label="Elimina">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-1 pr-3 font-semibold">Lingua</th>
                  {DOC_FORMATS.map((f) => (
                    <th key={f} className="py-1 pr-3 font-semibold">
                      {FORMAT_NAMES[f]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DOC_LOCALES.map((l) => (
                  <tr key={l} className="border-t border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{LANG_NAMES[l]}</td>
                    {DOC_FORMATS.map((f) => {
                      const file = d.files.find((x) => x.locale === l && x.format === f)
                      const key = `up-${d.id}-${l}-${f}`
                      const Icon = f === 'pdf' ? FileText : Presentation
                      return (
                        <td key={f} className="py-2 pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {file ? (
                              <>
                                <a href={`/api/documenti/${file.id}`} className="inline-flex items-center gap-1 text-gray-800 hover:underline">
                                  <Icon className="h-4 w-4 text-gray-500" /> {mb(file.size_bytes)}
                                </a>
                                <button type="button" onClick={() => removeFile(file.id)} disabled={busy !== null} className="text-gray-400 hover:text-red-600" aria-label="Elimina file">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                            <label className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${busy !== null ? 'pointer-events-none opacity-50' : ''}`}>
                              {busy === key ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} {file ? 'Sostituisci' : 'Carica'}
                              <input
                                type="file"
                                accept={f === 'pdf' ? '.pdf,application/pdf' : '.pptx'}
                                className="hidden"
                                onChange={(e) => {
                                  const picked = e.target.files?.[0]
                                  e.target.value = ''
                                  if (picked) upload(d, l, f, picked)
                                }}
                              />
                            </label>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <FlyersAdminSection />
    </div>
  )
}

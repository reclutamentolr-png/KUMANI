'use client'

// Documento nuovo: vuoto oppure da un modello pronto (nella lingua del sito).
// Si crea subito sul server e si apre il documento.
import { useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ClipboardList, Camera, FilePlus2, FileSignature, LoaderCircle, Receipt, type LucideIcon } from 'lucide-react'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { limitTextOf } from '@/lib/limitText'
import { createComposableDocument } from '@/app/actions/documentoComponibile'
import { uid, type DocContent } from '@/lib/documentoComponibile'
import { TEMPLATE_IDS, templateDocument, templateInfo, type TemplateId } from '@/lib/documentoComponibileModelli'
import DocumentPreview from './DocumentPreview'

const ICONS: Record<TemplateId, LucideIcon> = {
  iscrizione: ClipboardList,
  liberatoria: Camera,
  preventivo: Receipt,
  delega: FileSignature,
}

export default function NuovoDocumento() {
  const t = useTranslations('documentoComponibile')
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [peek, setPeek] = useState<TemplateId | null>(null)
  const lock = useRef(false)

  const create = async (key: string, doc: DocContent) => {
    // Un solo documento anche con il doppio tocco
    if (lock.current) return
    lock.current = true
    setBusy(key)
    setError(null)
    let ok = false
    try {
      const res = await createComposableDocument(doc)
      if (!res.success) {
        setError(limitTextOf(res) ?? (t.has(`error_${res.message}`) ? t(`error_${res.message}`) : t('error_saveError')))
        return
      }
      ok = true
      router.replace(`/app/documento-componibile/${res.data.id}`)
    } catch {
      setError(t('error_saveError'))
    } finally {
      // Riuscito: il pulsante resta fermo mentre si apre il documento
      if (!ok) {
        lock.current = false
        setBusy(null)
      }
    }
  }

  const blankDoc = (): DocContent => ({
    title: t('untitled'),
    footer: '',
    blocks: [{ id: uid(), type: 'title', text: t('untitled') }],
  })

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void create('blank', blankDoc())}
        className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-[var(--gold)]/50 bg-white p-5 text-left shadow-sm transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]/40 disabled:opacity-60"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
          {busy === 'blank' ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <FilePlus2 className="h-6 w-6" />}
        </span>
        <span>
          <span className="block font-bold text-[var(--ink)]">{t('blankTitle')}</span>
          <span className="block text-sm text-[var(--muted)]">{t('blankText')}</span>
        </span>
      </button>

      <section>
        <h2 className="mb-3 text-lg font-bold text-[var(--ink)]">{t('templatesTitle')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {TEMPLATE_IDS.map((id) => {
            const info = templateInfo(id, locale)
            const Icon = ICONS[id]
            return (
              <li key={id} className="flex flex-col rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)]">
                    <Icon className="h-5 w-5 text-[var(--gold)]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-[var(--ink)]">{info.name}</span>
                    <span className="block text-sm text-[var(--muted)]">{info.description}</span>
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void create(id, templateDocument(id, locale))}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--ink)] px-3 py-2.5 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-60"
                  >
                    {busy === id && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('useTemplate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeek(peek === id ? null : id)}
                    aria-expanded={peek === id}
                    className="rounded-xl border border-[var(--gold)]/40 px-3 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
                  >
                    {peek === id ? t('hidePreview') : t('showPreview')}
                  </button>
                </div>
                {peek === id && (
                  <div className="mt-4">
                    <DocumentPreview doc={templateDocument(id, locale)} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-sm text-[var(--muted)]">{t('templatesNote')}</p>
      </section>
    </div>
  )
}

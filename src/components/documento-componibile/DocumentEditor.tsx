'use client'

// Documento componibile: si compone a blocchi (parti fisse e parti da
// compilare), si vede l'anteprima del foglio, si salva sul server e si scarica
// un PDF in cui le parti fisse restano bloccate e i campi si compilano con
// qualsiasi lettore PDF.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileSignature,
  FileText,
  Heading1,
  Heading2,
  ImagePlus,
  ListChecks,
  LoaderCircle,
  Lock,
  Minus,
  Pencil,
  PenLine,
  TextCursorInput,
  Trash2,
  Type,
  type LucideIcon,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { askConfirm } from '@/lib/confirm'
import { updateComposableDocument } from '@/app/actions/documentoComponibile'
import {
  DOC_LIMITS,
  FIELD_TYPES,
  FIXED_TYPES,
  canBeHalf,
  countFields,
  countImages,
  docBytes,
  isField,
  pdfIssues,
  uid,
  type BlockType,
  type DocBlock,
  type DocContent,
} from '@/lib/documentoComponibile'
import DocumentPreview from './DocumentPreview'

const ICONS: Record<BlockType, LucideIcon> = {
  title: Heading1,
  heading: Heading2,
  text: Type,
  image: ImagePlus,
  divider: Minus,
  signature: PenLine,
  input: TextCursorInput,
  textarea: FileText,
  date: Calendar,
  checkbox: CheckSquare,
  select: ListChecks,
}

const inputClass =
  'w-full rounded-lg border-2 border-[var(--gold)]/20 bg-white px-3 py-2 text-base outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 sm:text-sm'
const smallLabel = 'block text-xs font-semibold text-[var(--muted)]'

// Immagine ridotta nel browser (max 1200 px): JPEG 0.85, oppure PNG se ha
// parti trasparenti (un logo senza sfondo resta senza sfondo)
async function readImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const draw = (max: number, png: boolean) => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const ctx = canvas.getContext('2d')!
      if (!png) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      return { canvas, ctx }
    }
    let transparent = false
    if (file.type !== 'image/jpeg') {
      const { canvas, ctx } = draw(1200, true)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) {
          transparent = true
          break
        }
      }
      if (transparent) {
        // PNG troppo pesante: si prova più piccola, poi si rinuncia alla trasparenza
        for (const max of [1200, 900, 600]) {
          const png = draw(max, true).canvas.toDataURL('image/png')
          if (png.length <= DOC_LIMITS.imageChars * 0.6) return png
        }
      }
    }
    for (const [max, q] of [
      [1200, 0.85],
      [1000, 0.75],
      [700, 0.7],
    ] as const) {
      const jpg = draw(max, false).canvas.toDataURL('image/jpeg', q)
      if (jpg.length <= DOC_LIMITS.imageChars) return jpg
    }
    throw new Error('too big')
  } finally {
    URL.revokeObjectURL(url)
  }
}

const safeFileName = (title: string, fallback: string) => `${title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 80) || fallback}.pdf`

export default function DocumentEditor({ id, initial }: { id: string; initial: DocContent }) {
  const t = useTranslations('documentoComponibile')
  const router = useRouter()
  const [title, setTitle] = useState(initial.title)
  const [footer, setFooter] = useState(initial.footer)
  const [blocks, setBlocks] = useState<DocBlock[]>(initial.blocks)
  const [openId, setOpenId] = useState<string | null>(null)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [pdfBusy, setPdfBusy] = useState<'download' | 'open' | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageBusy, setImageBusy] = useState<string | null>(null)
  // Modifiche: un numero che sale a ogni cambio; «salvato» = numero dell'ultimo salvataggio
  const [rev, setRev] = useState(0)
  const [savedRev, setSavedRev] = useState(0)
  const savingRef = useRef(false)
  const savedTitle = useRef(initial.title)
  const leaving = useRef(false)
  const dirty = rev !== savedRev

  const doc: DocContent = useMemo(() => ({ title, footer, blocks }), [title, footer, blocks])
  const changed = () => {
    setRev((r) => r + 1)
    setError(null)
  }
  const setBlocksDirty = (fn: (list: DocBlock[]) => DocBlock[]) => {
    setBlocks(fn)
    changed()
  }

  // Peso del documento: le immagini si contano a parte (stringhe lunghe)
  const bytes = useMemo(() => {
    const imageChars = blocks.reduce((n, b) => n + (b.image?.length ?? 0), 0)
    return docBytes(blocks.map((b) => (b.image ? { ...b, image: '' } : b))) + imageChars
  }, [blocks])
  const images = countImages(blocks)
  const issues = useMemo(() => pdfIssues(doc), [doc])

  // Uscendo con modifiche non salvate il browser chiede conferma
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      if (!leaving.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Anche i collegamenti dentro il sito: si chiede qui prima di uscire
  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return
      e.preventDefault()
      e.stopPropagation()
      void askConfirm(t('leaveConfirm'), { tone: 'warning' }).then((ok) => {
        if (!ok) return
        leaving.current = true
        window.location.assign(url.href)
      })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [dirty, t])

  const save = async () => {
    // Il blocco con il ref ferma anche il doppio tocco veloce (prima che React ridisegni)
    if (savingRef.current) return
    if (!title.trim()) {
      setError(t('error_titleRequired'))
      return
    }
    if (blocks.length > DOC_LIMITS.blocks) {
      setError(t('error_tooManyBlocks', { max: DOC_LIMITS.blocks }))
      return
    }
    if (bytes > DOC_LIMITS.bytes) {
      setError(t('error_tooBig'))
      return
    }
    savingRef.current = true
    setSaving(true)
    setError(null)
    const savingRev = rev
    try {
      const res = await updateComposableDocument(id, doc)
      if (!res.success) {
        setError(t.has(`error_${res.message}`) ? t(`error_${res.message}`, { max: res.message === 'tooManyImages' ? DOC_LIMITS.images : DOC_LIMITS.blocks }) : t('error_saveError'))
        return
      }
      setSavedRev(savingRev)
      setSavedNote(true)
      setTimeout(() => setSavedNote(false), 2500)
      // Titolo nuovo anche nell'intestazione della pagina (solo se è cambiato:
      // ricaricare la pagina riporta tutto il documento, immagini comprese)
      if (doc.title.trim() !== savedTitle.current) {
        savedTitle.current = doc.title.trim()
        router.refresh()
      }
    } catch {
      setError(t('error_saveError'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  // Ctrl+S / Cmd+S salva
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const update = (bid: string, patch: Partial<DocBlock>) => setBlocksDirty((list) => list.map((b) => (b.id === bid ? { ...b, ...patch } : b)))
  const move = (bid: string, dir: -1 | 1) =>
    setBlocksDirty((list) => {
      const i = list.findIndex((b) => b.id === bid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const blank = (type: BlockType): DocBlock => {
    const b: DocBlock = { id: uid(), type }
    if (type === 'title') b.text = t('def_title')
    if (type === 'heading') b.text = t('def_heading')
    if (type === 'text') b.text = t('def_text')
    if (type === 'image') Object.assign(b, { width: 35, align: 'left' })
    if (type === 'signature') Object.assign(b, { label: t('def_signature'), align: 'right' })
    if (type === 'input') b.label = t('def_input')
    if (type === 'textarea') Object.assign(b, { label: t('def_textarea'), lines: 4 })
    if (type === 'date') b.label = t('def_date')
    if (type === 'checkbox') Object.assign(b, { label: t('def_checkbox'), text: t('def_checkboxText') })
    if (type === 'select') Object.assign(b, { label: t('def_select'), options: t('def_selectOptions') })
    return b
  }
  const add = (type: BlockType) => {
    if (blocks.length >= DOC_LIMITS.blocks) {
      setError(t('error_tooManyBlocks', { max: DOC_LIMITS.blocks }))
      return
    }
    if (type === 'image' && images >= DOC_LIMITS.images) {
      setError(t('error_tooManyImages', { max: DOC_LIMITS.images }))
      return
    }
    const b = blank(type)
    setBlocksDirty((list) => [...list, b])
    setOpenId(b.id)
    setError(null)
  }
  const duplicate = (b: DocBlock) => {
    if (blocks.length >= DOC_LIMITS.blocks) {
      setError(t('error_tooManyBlocks', { max: DOC_LIMITS.blocks }))
      return
    }
    if (b.type === 'image' && b.image && images >= DOC_LIMITS.images) {
      setError(t('error_tooManyImages', { max: DOC_LIMITS.images }))
      return
    }
    if (b.image && bytes + b.image.length > DOC_LIMITS.bytes) {
      setError(t('error_tooBig'))
      return
    }
    setBlocksDirty((list) => {
      const k = list.findIndex((x) => x.id === b.id)
      return [...list.slice(0, k + 1), { ...b, id: uid() }, ...list.slice(k + 1)]
    })
  }
  const remove = async (b: DocBlock) => {
    // Solo per i blocchi con dentro qualcosa si chiede conferma
    const hasContent = b.image || (b.type === 'text' && (b.text?.length ?? 0) > 40) || (b.type === 'select' && b.options)
    if (hasContent && !(await askConfirm(t('blockDeleteConfirm')))) return
    setBlocksDirty((list) => list.filter((x) => x.id !== b.id))
  }

  const pickImage = async (b: DocBlock, file: File) => {
    if (!b.image && images >= DOC_LIMITS.images) {
      setError(t('error_tooManyImages', { max: DOC_LIMITS.images }))
      return
    }
    setImageBusy(b.id)
    setError(null)
    try {
      const data = await readImage(file)
      if (bytes - (b.image?.length ?? 0) + data.length > DOC_LIMITS.bytes) {
        setError(t('error_imageTooBig'))
        return
      }
      update(b.id, { image: data })
    } catch {
      setError(t('error_imageRead'))
    } finally {
      setImageBusy(null)
    }
  }

  const makePdf = async (mode: 'download' | 'open') => {
    if (pdfBusy) return
    if (issues.length > 0 && !(await askConfirm(t('pdfIssuesConfirm', { n: issues.length }), { tone: 'warning', confirmLabel: t('pdfIssuesGo') }))) return
    // La finestra si apre subito (dopo un'attesa il browser la bloccherebbe)
    const win = mode === 'open' ? window.open('', '_blank') : null
    setPdfBusy(mode)
    setError(null)
    try {
      const { buildFillablePdf } = await import('@/lib/documentoComponibilePdf')
      const bytesPdf = await buildFillablePdf(doc, {
        page: (n, total) => t('pdfPage', { n, total }),
        dateHint: t('pdfDateHint'),
        signature: t('def_signature'),
        fallbackTitle: t('untitled'),
      })
      const url = URL.createObjectURL(new Blob([bytesPdf as BlobPart], { type: 'application/pdf' }))
      if (win) win.location.href = url
      else {
        const a = document.createElement('a')
        a.href = url
        a.download = safeFileName(title, t('fileName'))
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (e) {
      console.error(e)
      win?.close()
      setError(t('error_pdf'))
    } finally {
      setPdfBusy(null)
    }
  }

  const fieldsCount = countFields(blocks)
  const issueWhere = (i: (typeof issues)[number]) =>
    i.where === 'footer' ? t('footer') : i.where === 'title' ? t('docName') : t('issueBlock', { n: i.index + 1, type: t(`type_${i.type}`) })
  const short = (s: string) => (s.length > 70 ? `${s.slice(0, 70)}…` : s)

  const summaryOf = (b: DocBlock) =>
    b.type === 'image' ? (b.image ? t('imageChosen') : t('imageNone')) : b.type === 'divider' ? t('dividerSummary') : b.text || b.label || ''

  const editor = (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
        <label className={smallLabel}>
          {t('docName')}
          <input
            className={`${inputClass} mt-1`}
            value={title}
            maxLength={DOC_LIMITS.title}
            onChange={(e) => {
              setTitle(e.target.value)
              changed()
            }}
          />
        </label>
        <label className={smallLabel}>
          {t('footer')}
          <input
            className={`${inputClass} mt-1`}
            value={footer}
            maxLength={DOC_LIMITS.footer}
            placeholder={t('footerPlaceholder')}
            onChange={(e) => {
              setFooter(e.target.value)
              changed()
            }}
          />
        </label>
      </section>

      {blocks.length === 0 && <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-6 text-center text-sm text-[var(--muted)]">{t('emptyBlocks')}</p>}

      <ol className="space-y-2">
        {blocks.map((b, i) => {
          const fixed = FIXED_TYPES.includes(b.type)
          const Icon = ICONS[b.type]
          const open = openId === b.id
          const summary = summaryOf(b)
          return (
            <li key={b.id} className={`rounded-2xl border bg-white shadow-sm ${fixed ? 'border-gray-200' : 'border-[var(--gold)]/50'}`}>
              <div className="flex items-center gap-1.5 p-2.5 sm:gap-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${fixed ? 'bg-gray-100 text-gray-600' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <button type="button" onClick={() => setOpenId(open ? null : b.id)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
                  <span className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-bold uppercase tracking-wide">
                    {fixed ? (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <Lock className="h-3 w-3" /> {t('fixed')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--gold)]">
                        <Pencil className="h-3 w-3" /> {t('toFill')}
                      </span>
                    )}
                    <span className="text-gray-400">· {t(`type_${b.type}`)}</span>
                  </span>
                  <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                    {summary || t(`type_${b.type}`)}
                    {b.required && <span className="text-[var(--gold)]"> *</span>}
                  </span>
                </button>
                <button type="button" aria-label={t('moveUp')} title={t('moveUp')} disabled={i === 0} onClick={() => move(b.id, -1)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={t('moveDown')}
                  title={t('moveDown')}
                  disabled={i === blocks.length - 1}
                  onClick={() => move(b.id, 1)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button type="button" aria-label={open ? t('close') : t('edit')} onClick={() => setOpenId(open ? null : b.id)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                  <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {open && (
                <div className="space-y-3 border-t border-gray-100 p-3">
                  {(b.type === 'title' || b.type === 'heading') && (
                    <input className={inputClass} value={b.text ?? ''} maxLength={DOC_LIMITS.heading} onChange={(e) => update(b.id, { text: e.target.value })} aria-label={t(`type_${b.type}`)} />
                  )}
                  {b.type === 'text' && (
                    <textarea className={inputClass} rows={5} value={b.text ?? ''} maxLength={DOC_LIMITS.text} onChange={(e) => update(b.id, { text: e.target.value })} aria-label={t('type_text')} />
                  )}
                  {b.type === 'divider' && <p className="text-sm text-[var(--muted)]">{t('dividerHelp')}</p>}
                  {b.type === 'image' && (
                    <>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--gold)]/40 p-4 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)]">
                        {imageBusy === b.id ? <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" /> : <ImagePlus className="h-5 w-5 text-[var(--gold)]" />}
                        {b.image ? t('imageChange') : t('imagePick')}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={imageBusy !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (file) void pickImage(b, file)
                          }}
                        />
                      </label>
                      <label className={smallLabel}>
                        {t('imageWidth', { n: b.width ?? 40 })}
                        <input type="range" min={15} max={100} value={b.width ?? 40} onChange={(e) => update(b.id, { width: Number(e.target.value) })} className="mt-1 w-full accent-[var(--gold)]" />
                      </label>
                    </>
                  )}
                  {(b.type === 'image' || b.type === 'signature') && (
                    <div className="flex flex-wrap gap-1">
                      {(b.type === 'image' ? (['left', 'center', 'right'] as const) : (['left', 'right'] as const)).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => update(b.id, { align: a })}
                          className={`rounded-lg px-3 py-2 text-xs font-bold ${(b.align ?? (b.type === 'signature' ? 'right' : 'left')) === a ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {t(`align_${a}`)}
                        </button>
                      ))}
                    </div>
                  )}
                  {(isField(b) || b.type === 'signature') && (
                    <label className={smallLabel}>
                      {b.type === 'signature' ? t('signatureLabel') : t('fieldLabel')}
                      <input className={`${inputClass} mt-1`} value={b.label ?? ''} maxLength={DOC_LIMITS.label} onChange={(e) => update(b.id, { label: e.target.value })} />
                    </label>
                  )}
                  {b.type === 'checkbox' && (
                    <label className={smallLabel}>
                      {t('checkboxText')}
                      <textarea className={`${inputClass} mt-1`} rows={3} value={b.text ?? ''} maxLength={DOC_LIMITS.text} onChange={(e) => update(b.id, { text: e.target.value })} />
                    </label>
                  )}
                  {b.type === 'signature' && (
                    <label className={smallLabel}>
                      {t('signatureNote')}
                      <input className={`${inputClass} mt-1`} value={b.text ?? ''} maxLength={DOC_LIMITS.label} onChange={(e) => update(b.id, { text: e.target.value })} />
                    </label>
                  )}
                  {b.type === 'select' && (
                    <>
                      <label className={smallLabel}>
                        {t('selectOptions')}
                        <textarea className={`${inputClass} mt-1`} rows={4} value={b.options ?? ''} maxLength={DOC_LIMITS.options} onChange={(e) => update(b.id, { options: e.target.value })} />
                      </label>
                      <label className={smallLabel}>
                        {t('selectDefault')}
                        <select className={`${inputClass} mt-1`} value={b.value ?? ''} onChange={(e) => update(b.id, { value: e.target.value })}>
                          <option value="">{t('selectNone')}</option>
                          {[...new Set((b.options ?? '').split('\n').map((o) => o.trim()).filter(Boolean))].map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {(b.type === 'input' || b.type === 'textarea' || b.type === 'date') && (
                    <label className={smallLabel}>
                      {t('prefilled')}
                      {b.type === 'textarea' ? (
                        <textarea className={`${inputClass} mt-1`} rows={3} value={b.value ?? ''} maxLength={DOC_LIMITS.value} onChange={(e) => update(b.id, { value: e.target.value })} />
                      ) : (
                        <input className={`${inputClass} mt-1`} value={b.value ?? ''} maxLength={DOC_LIMITS.value} onChange={(e) => update(b.id, { value: e.target.value })} />
                      )}
                    </label>
                  )}
                  {(b.type === 'input' || b.type === 'textarea' || b.type === 'select' || b.type === 'date') && (
                    <label className={smallLabel}>
                      {t('hintLabel')}
                      <input
                        className={`${inputClass} mt-1`}
                        value={b.hint ?? ''}
                        maxLength={DOC_LIMITS.hint}
                        placeholder={b.type === 'date' ? t('pdfDateHint') : ''}
                        onChange={(e) => update(b.id, { hint: e.target.value })}
                      />
                    </label>
                  )}
                  {b.type === 'textarea' && (
                    <label className={smallLabel}>
                      {t('textareaLines', { n: b.lines ?? 4 })}
                      <input type="range" min={2} max={12} value={b.lines ?? 4} onChange={(e) => update(b.id, { lines: Number(e.target.value) })} className="mt-1 w-full accent-[var(--gold)]" />
                    </label>
                  )}
                  {isField(b) && (
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--ink)]">
                      {canBeHalf(b.type) && (
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={!!b.half} onChange={(e) => update(b.id, { half: e.target.checked })} className="h-4 w-4 accent-[var(--gold)]" /> {t('half')}
                        </label>
                      )}
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={!!b.required} onChange={(e) => update(b.id, { required: e.target.checked })} className="h-4 w-4 accent-[var(--gold)]" /> {t('required')}
                      </label>
                      {b.type === 'checkbox' && (
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={!!b.checked} onChange={(e) => update(b.id, { checked: e.target.checked })} className="h-4 w-4 accent-[var(--gold)]" /> {t('checked')}
                        </label>
                      )}
                    </div>
                  )}
                  {canBeHalf(b.type) && b.half && <p className="text-xs text-[var(--muted)]">{t('halfHelp')}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => duplicate(b)} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200">
                      <Copy className="h-3.5 w-3.5" /> {t('duplicate')}
                    </button>
                    <button type="button" onClick={() => void remove(b)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100">
                      <Trash2 className="h-3.5 w-3.5" /> {t('delete')}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
          <Lock className="h-3.5 w-3.5" /> {t('addFixed')}
        </p>
        <div className="flex flex-wrap gap-2">
          {FIXED_TYPES.map((type) => {
            const Icon = ICONS[type]
            return (
              <button key={type} type="button" onClick={() => add(type)} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200">
                <Icon className="h-4 w-4" /> {t(`type_${type}`)}
              </button>
            )
          })}
        </div>
        <p className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">
          <Pencil className="h-3.5 w-3.5" /> {t('addField')}
        </p>
        <div className="flex flex-wrap gap-2">
          {FIELD_TYPES.map((type) => {
            const Icon = ICONS[type]
            return (
              <button key={type} type="button" onClick={() => add(type)} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--gold-pale)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:brightness-95">
                <Icon className="h-4 w-4" /> {t(`type_${type}`)}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )

  return (
    <div className="space-y-4 pb-24">
      {/* PDF: scarica, prova, firma */}
      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={!!pdfBusy || blocks.length === 0}
            onClick={() => void makePdf('download')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 text-sm font-bold text-[var(--ink)] shadow-md disabled:opacity-50"
          >
            {pdfBusy === 'download' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t('pdfDownload')}
          </button>
          <button
            type="button"
            disabled={!!pdfBusy || blocks.length === 0}
            onClick={() => void makePdf('open')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-50"
          >
            {pdfBusy === 'open' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} {t('pdfOpen')}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">{t('stats', { blocks: blocks.length, fields: fieldsCount })}</p>
        <p className="mt-3 flex items-start gap-2 text-sm text-[var(--ink)]">
          <FileSignature className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
          <span>
            {t('signTip')}{' '}
            <Link href="/app/firma-pdf" className="font-semibold underline">
              {t('signLink')}
            </Link>
          </span>
        </p>
        {issues.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t('pdfIssuesTitle')}
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {issues.slice(0, 6).map((i, k) => (
                <li key={k} className="break-words">
                  <b>{issueWhere(i)}:</b> «{short(i.text)}» → «{short(i.replaced)}»
                </li>
              ))}
              {issues.length > 6 && <li>{t('pdfIssuesMore', { n: issues.length - 6 })}</li>}
            </ul>
          </div>
        )}
        {(images > 0 || bytes > DOC_LIMITS.bytes * 0.5) && (
          <p className={`mt-3 text-xs ${bytes > DOC_LIMITS.bytes ? 'font-semibold text-red-700' : 'text-[var(--muted)]'}`}>
            {t('weight', {
              used: (bytes / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
              max: (DOC_LIMITS.bytes / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
              images,
              maxImages: DOC_LIMITS.images,
            })}
          </p>
        )}
      </section>

      {/* Telefono: Componi / Anteprima */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--gold)]/25 bg-white p-1 lg:hidden" role="tablist">
        {(['edit', 'preview'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-lg py-2.5 text-sm font-bold ${view === v ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'text-[var(--muted)]'}`}
          >
            {v === 'edit' ? t('tabEdit') : t('tabPreview')}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className={view === 'edit' ? 'min-w-0' : 'hidden min-w-0 lg:block'}>{editor}</div>
        <div className={view === 'preview' ? 'min-w-0' : 'hidden min-w-0 lg:block'}>
          <div className="lg:sticky lg:top-20">
            <DocumentPreview doc={doc} />
          </div>
        </div>
      </div>

      {/* Salvataggio: barra sempre in fondo allo schermo. Pulsante a sinistra:
          a destra c'è il pulsante tondo della guida */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--gold)]/30 bg-white/95 py-3 pl-4 pr-20 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur print:hidden sm:pr-56">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--ink)] px-6 py-3 text-sm font-bold text-[var(--gold-bright)] shadow-md disabled:opacity-50"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} {t('save')}
          </button>
          <p className="min-w-0 flex-1 text-sm leading-tight" role="status">
            {error ? (
              <span className="font-semibold text-red-700">{error}</span>
            ) : saving ? (
              <span className="text-[var(--muted)]">{t('saving')}</span>
            ) : dirty ? (
              <span className="font-semibold text-amber-700">{t('unsaved')}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" /> {savedNote ? t('saved') : t('allSaved')}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

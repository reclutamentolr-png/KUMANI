'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarDays, Download, FileUp, LoaderCircle, Pencil, Share2, ShieldCheck, Signature, Trash2, Type, X } from 'lucide-react'
import { firmaPdfDone } from '@/app/actions/firmaPdf'
import {
  PDF_MAX_BYTES,
  PDF_MAX_PAGES,
  SIGNATURE_STORAGE_KEY,
  TEXT_MAX,
  formatDate,
  newFieldId,
  signPdf,
  textToPng,
  todayIso,
  type DateFormat,
  type FieldKind,
  type PdfField,
} from '@/lib/firmaPdf'
import SignatureDialog, { type SignatureResult } from './SignatureDialog'

type PdfJsDoc = {
  numPages: number
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number }
    render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }) => { promise: Promise<void> }
  }>
}
type LoadingTask = { promise: Promise<unknown>; destroy: () => Promise<void> }
type LoadedDoc = { name: string; bytes: ArrayBuffer; sizes: { w: number; h: number }[] }
type Placing = { kind: FieldKind; png: string; ratio: number; value?: string; format?: DateFormat }
type Dialog = { kind: FieldKind; editId?: string } | null

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
const TEXT_COLOR = '#111111'

const readSaved = (): SignatureResult | null => {
  try {
    const raw = localStorage.getItem(SIGNATURE_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as SignatureResult) : null
    return parsed?.png?.startsWith('data:image/png') && parsed.ratio > 0 ? parsed : null
  } catch {
    return null
  }
}

// Una pagina del PDF disegnata solo quando entra nello schermo
function PdfPage({ pdf, index, size, children, onPick, placing }: { pdf: PdfJsDoc; index: number; size: { w: number; h: number }; children: React.ReactNode; onPick: (x: number, y: number) => void; placing: boolean }) {
  const t = useTranslations('firmaPdf')
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let done = false
    const observer = new IntersectionObserver(
      async (entries) => {
        if (done || !entries.some((e) => e.isIntersecting)) return
        done = true
        observer.disconnect()
        const page = await pdf.getPage(index + 1)
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const scale = (wrap.clientWidth * dpr) / size.w
        const viewport = page.getViewport({ scale })
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        await page.render({ canvasContext: ctx, viewport, canvas }).promise
        setRendered(true)
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [pdf, index, size.w])

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-[var(--muted)]">{t('pageOf', { n: index + 1 })}</p>
      <div
        ref={wrapRef}
        data-page={index}
        className={`relative w-full overflow-hidden rounded-lg bg-white shadow-[0_6px_24px_rgba(23,23,23,0.12)] ${placing ? 'cursor-crosshair ring-2 ring-[var(--gold)]' : ''}`}
        style={{ aspectRatio: `${size.w} / ${size.h}` }}
        onClick={(e) => {
          if (!placing) return
          const rect = e.currentTarget.getBoundingClientRect()
          onPick((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={t('pageOf', { n: index + 1 })} />
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold)]" aria-hidden="true" />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// Dati e testo: piccola finestra con anteprima
function FieldDialog({ kind, initial, onClose, onDone }: { kind: 'date' | 'text'; initial?: { value?: string; format?: DateFormat }; onClose: () => void; onDone: (value: string, format: DateFormat) => void }) {
  const t = useTranslations('firmaPdf')
  const locale = useLocale()
  const [value, setValue] = useState(initial?.value ?? (kind === 'date' ? todayIso() : ''))
  const [format, setFormat] = useState<DateFormat>(initial?.format ?? 'numeric')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const ok = kind === 'date' ? /^\d{4}-\d{2}-\d{2}$/.test(value) : value.trim().length > 0
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-title"
        className="w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) onDone(kind === 'date' ? value : value.trim(), format)
        }}
      >
        <h2 id="field-title" className="text-xl font-extrabold text-[var(--ink)]">
          {kind === 'date' ? t('dateTitle') : t('textTitle')}
        </h2>
        {kind === 'date' ? (
          <>
            <input ref={inputRef} type="date" value={value} onChange={(e) => setValue(e.target.value)} className="block min-h-12 w-full rounded-xl border border-[var(--gold)]/35 px-3 text-base" aria-label={t('dateTitle')} />
            <div className="grid gap-2 sm:grid-cols-2">
              {(['numeric', 'long'] as const).map((f) => (
                <label key={f} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold ${format === f ? 'border-[var(--gold)] bg-[var(--gold-pale)]/40' : 'border-[var(--background)]'}`}>
                  <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} className="accent-[var(--ink)]" />
                  {ok ? formatDate(value, f, locale) : ''}
                </label>
              ))}
            </div>
          </>
        ) : (
          <label className="block text-sm font-semibold text-[var(--muted)]">
            {t('textLabel')}
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, TEXT_MAX))}
              placeholder={t('textPlaceholder')}
              className="mt-1 block min-h-12 w-full rounded-xl border border-[var(--gold)]/35 px-3 text-base text-[var(--ink)]"
            />
          </label>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-full border border-[var(--ink)]/20 font-bold text-[var(--ink)]">
            {t('cancel')}
          </button>
          <button type="submit" disabled={!ok} className="min-h-12 flex-1 rounded-full bg-[var(--ink)] font-bold text-[var(--gold-bright)] disabled:opacity-40">
            {t('add')}
          </button>
        </div>
      </form>
    </div>
  )
}

// FIRMA PDF: carica, firma, scarica. Tutto nel browser.
export default function FirmaPdfApp({ signatureFonts, textFont, defaultName }: { signatureFonts: { family: string; label: string }[]; textFont: string; defaultName: string }) {
  const t = useTranslations('firmaPdf')
  const locale = useLocale()
  const [doc, setDoc] = useState<LoadedDoc | null>(null)
  const [pdf, setPdf] = useState<PdfJsDoc | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<PdfField[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [placing, setPlacing] = useState<Placing | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [saved, setSaved] = useState<SignatureResult | null>(null)
  const [saving, setSaving] = useState<'download' | 'share' | null>(null)
  const [doneMsg, setDoneMsg] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  // Documento aperto in PDF.js: si chiude quando se ne apre un altro o si esce
  const taskRef = useRef<LoadingTask | null>(null)
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: PdfField; rect: DOMRect } | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(readSaved())
    try {
      const probe = new File([new Uint8Array([37])], 'a.pdf', { type: 'application/pdf' })
      setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }) && /Android|iPhone|iPad/i.test(navigator.userAgent))
    } catch {
      setCanShare(false)
    }
  }, [])

  // Avviso se si esce con un documento firmato a metà
  useEffect(() => {
    if (!fields.length) return
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [fields.length])

  useEffect(() => () => void taskRef.current?.destroy().catch(() => {}), [])

  const openFile = async (file: File | undefined) => {
    setError(null)
    setDoneMsg(false)
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setError(t('errType'))
    if (file.size > PDF_MAX_BYTES) return setError(t('errSize'))
    setLoading(true)
    try {
      const bytes = await file.arrayBuffer()
      // Un PDF protetto da password non si può modificare
      const { PDFDocument, EncryptedPDFError } = await import('pdf-lib')
      try {
        await PDFDocument.load(bytes.slice(0))
      } catch (e) {
        setError(e instanceof EncryptedPDFError ? t('errEncrypted') : t('errRead'))
        setLoading(false)
        return
      }
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }) as unknown as LoadingTask
      const loaded = (await task.promise) as PdfJsDoc
      if (loaded.numPages > PDF_MAX_PAGES) {
        await task.destroy().catch(() => {})
        setError(t('errPages', { max: PDF_MAX_PAGES }))
        setLoading(false)
        return
      }
      const sizes: { w: number; h: number }[] = []
      for (let i = 1; i <= loaded.numPages; i++) {
        const vp = (await loaded.getPage(i)).getViewport({ scale: 1 })
        sizes.push({ w: vp.width, h: vp.height })
      }
      const previous = taskRef.current
      taskRef.current = task
      previous?.destroy().catch(() => {})
      setFields([])
      setSelected(null)
      setPlacing(null)
      setPdf(loaded)
      setDoc({ name: file.name.replace(/\.pdf$/i, ''), bytes, sizes })
    } catch (e) {
      console.error('[firma-pdf] apertura:', e)
      setError(t('errRead'))
    } finally {
      setLoading(false)
    }
  }

  // Nuovo contenuto pronto: si sceglie il punto (o si sostituisce quello in modifica)
  const ready = (content: Placing, editId?: string) => {
    setDialog(null)
    if (editId) {
      setFields((list) => list.map((f) => (f.id === editId ? { ...f, png: content.png, ratio: content.ratio, value: content.value, format: content.format } : f)))
      return
    }
    setPlacing(content)
    setSelected(null)
  }

  const onSignature = (result: SignatureResult, remember: boolean) => {
    try {
      if (remember) localStorage.setItem(SIGNATURE_STORAGE_KEY, JSON.stringify(result))
      else localStorage.removeItem(SIGNATURE_STORAGE_KEY)
    } catch {
      // memoria del browser non disponibile: la firma vale solo per ora
    }
    setSaved(remember ? result : null)
    ready({ kind: 'signature', ...result }, dialog?.editId)
  }

  const onFieldValue = async (kind: 'date' | 'text', value: string, format: DateFormat) => {
    const label = kind === 'date' ? formatDate(value, format, locale) : value
    const result = await textToPng(label, textFont, TEXT_COLOR, 72)
    if (result) ready({ kind, ...result, value, format }, dialog?.editId)
  }

  const place = (page: number, px: number, py: number) => {
    if (!placing || !doc) return
    const size = doc.sizes[page]
    const pageRatio = size.w / size.h
    // Larghezza di partenza: firma ~30% della pagina, testo alto circa una riga
    let w = placing.kind === 'signature' ? 0.3 : (0.024 / pageRatio) / placing.ratio
    w = Math.min(w, 0.9)
    const hFrac = w * placing.ratio * pageRatio
    if (placing.kind === 'signature' && hFrac > 0.12) w = 0.12 / (placing.ratio * pageRatio)
    const h = w * placing.ratio * pageRatio
    const field: PdfField = {
      id: newFieldId(),
      page,
      kind: placing.kind,
      x: Math.min(Math.max(px - w / 2, 0), 1 - w),
      y: Math.min(Math.max(py - h / 2, 0), 1 - h),
      w,
      ratio: placing.ratio,
      png: placing.png,
      value: placing.value,
      format: placing.format,
    }
    setFields((list) => [...list, field])
    setSelected(field.id)
    setPlacing(null)
  }

  const fieldHeight = (f: PdfField) => {
    const size = doc?.sizes[f.page]
    return size ? f.w * f.ratio * (size.w / size.h) : 0
  }

  const startDrag = (e: React.PointerEvent, field: PdfField, mode: 'move' | 'resize') => {
    if (placing) return
    e.stopPropagation()
    const pageEl = (e.currentTarget as HTMLElement).closest('[data-page]') as HTMLElement | null
    if (!pageEl) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setSelected(field.id)
    dragRef.current = { id: field.id, mode, startX: e.clientX, startY: e.clientY, orig: field, rect: pageEl.getBoundingClientRect() }
  }
  const moveDrag = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = (e.clientX - drag.startX) / drag.rect.width
    const dy = (e.clientY - drag.startY) / drag.rect.height
    setFields((list) =>
      list.map((f) => {
        if (f.id !== drag.id) return f
        if (drag.mode === 'move') {
          const h = fieldHeight(f)
          return { ...f, x: Math.min(Math.max(drag.orig.x + dx, 0), 1 - f.w), y: Math.min(Math.max(drag.orig.y + dy, 0), 1 - h) }
        }
        const size = doc?.sizes[f.page]
        const pageRatio = size ? size.w / size.h : 1
        const maxW = Math.min(1 - f.x, (1 - f.y) / (f.ratio * pageRatio))
        return { ...f, w: Math.min(Math.max(drag.orig.w + dx, 0.04), maxW) }
      }),
    )
  }
  const endDrag = () => {
    dragRef.current = null
  }

  const remove = useCallback((id: string) => {
    setFields((list) => list.filter((f) => f.id !== id))
    setSelected(null)
  }, [])

  // Tastiera: Canc elimina, frecce spostano il campo scelto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected || dialog || (e.target as HTMLElement)?.closest('input, textarea')) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        remove(selected)
        return
      }
      const step = e.shiftKey ? 0.02 : 0.004
      const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
      if (!move) return
      e.preventDefault()
      setFields((list) => list.map((f) => (f.id === selected ? { ...f, x: Math.min(Math.max(f.x + move[0], 0), 1 - f.w), y: Math.max(f.y + move[1], 0) } : f)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, dialog, remove])

  const build = async () => {
    if (!doc) return null
    const bytes = await signPdf(doc.bytes.slice(0), fields)
    return new File([bytes as BlobPart], `${doc.name}-${t('signedSuffix')}.pdf`, { type: 'application/pdf' })
  }

  const download = async () => {
    setSaving('download')
    try {
      const file = await build()
      if (!file) return
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setDoneMsg(true)
      firmaPdfDone().catch(() => {})
    } catch (e) {
      console.error('[firma-pdf] salvataggio:', e)
      setError(t('errSave'))
    } finally {
      setSaving(null)
    }
  }

  const share = async () => {
    setSaving('share')
    try {
      const file = await build()
      if (!file) return
      await navigator.share({ files: [file], title: file.name })
      setDoneMsg(true)
      firmaPdfDone().catch(() => {})
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setError(t('errSave'))
    } finally {
      setSaving(null)
    }
  }

  // «Annulla»: chiude il documento e si torna alla scelta del PDF
  const closeDocument = () => {
    taskRef.current?.destroy().catch(() => {})
    taskRef.current = null
    setConfirmClose(false)
    setFields([])
    setSelected(null)
    setPlacing(null)
    setDialog(null)
    setError(null)
    setDoneMsg(false)
    setPdf(null)
    setDoc(null)
  }
  const askClose = () => {
    if (fields.length && !doneMsg) setConfirmClose(true)
    else closeDocument()
  }

  const tools: { kind: FieldKind; icon: typeof Signature; label: string }[] = [
    { kind: 'signature', icon: Signature, label: t('toolSign') },
    { kind: 'date', icon: CalendarDays, label: t('toolDate') },
    { kind: 'text', icon: Type, label: t('toolText') },
  ]
  const editing = dialog?.editId ? fields.find((f) => f.id === dialog.editId) : undefined

  if (!doc || !pdf) {
    return (
      <div className="space-y-5">
        <label
          className="flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[var(--gold)]/50 bg-white p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            openFile(e.dataTransfer.files?.[0])
          }}
        >
          {loading ? (
            <LoaderCircle className="h-10 w-10 animate-spin text-[var(--gold)]" aria-label={t('loading')} />
          ) : (
            <>
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                <FileUp className="h-8 w-8" aria-hidden="true" />
              </span>
              <span className="text-xl font-extrabold text-[var(--ink)]">{t('pick')}</span>
              <span className="text-sm text-[var(--muted)]">{t('pickHint', { max: Math.round(PDF_MAX_BYTES / 1024 / 1024) })}</span>
            </>
          )}
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => openFile(e.target.files?.[0])} disabled={loading} />
        </label>
        {error && (
          <p className="rounded-2xl bg-[#fdf2f2] p-3 text-sm font-semibold text-[#a12a2a]" role="alert">
            {error}
          </p>
        )}
        <InfoCards />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-36">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 truncate text-base font-extrabold text-[var(--ink)]">
          {doc.name}.pdf <span className="font-semibold text-[var(--muted)]">· {t('pages', { count: doc.sizes.length })}</span>
        </p>
        <div className="flex items-center gap-3">
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 text-sm font-bold text-[#7a5a14] hover:underline">
            <FileUp className="h-4 w-4" aria-hidden="true" /> {t('changeFile')}
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => openFile(e.target.files?.[0])} />
          </label>
          <button type="button" onClick={askClose} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#a12a2a]/30 bg-white px-3 text-sm font-bold text-[#a12a2a] hover:bg-[#fdf2f2]">
            <X className="h-4 w-4" aria-hidden="true" /> {t('cancelDoc')}
          </button>
        </div>
      </div>
      {confirmClose && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#a12a2a]/25 bg-[#fdf2f2] p-4" role="alertdialog" aria-labelledby="close-doc">
          <p id="close-doc" className="min-w-0 flex-1 text-sm font-semibold text-[#a12a2a]">
            {t('cancelConfirm')}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={closeDocument} className="min-h-10 rounded-full bg-[#a12a2a] px-4 text-sm font-bold text-white">
              {t('cancelYes')}
            </button>
            <button type="button" onClick={() => setConfirmClose(false)} className="min-h-10 rounded-full border border-[var(--ink)]/20 bg-white px-4 text-sm font-bold text-[var(--ink)]">
              {t('cancelNo')}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="rounded-2xl bg-[#fdf2f2] p-3 text-sm font-semibold text-[#a12a2a]" role="alert">
          {error}
        </p>
      )}
      {doneMsg && (
        <p className="rounded-2xl bg-[#e6f4ea] p-3 text-sm font-semibold text-[#1d6b34]" role="status">
          {t('doneMsg')}
        </p>
      )}

      <div className="mx-auto max-w-3xl space-y-5" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={() => !placing && setSelected(null)}>
        {doc.sizes.map((size, index) => (
          <PdfPage key={index} pdf={pdf} index={index} size={size} placing={!!placing} onPick={(x, y) => place(index, x, y)}>
            {fields
              .filter((f) => f.page === index)
              .map((f) => {
                const isSel = selected === f.id
                const h = f.w * f.ratio * (size.w / size.h)
                return (
                  <div
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    aria-label={t(`fieldAria.${f.kind}`)}
                    aria-pressed={isSel}
                    onPointerDown={(e) => startDrag(e, f, 'move')}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => setSelected(f.id)}
                    className={`absolute touch-none select-none ${isSel ? 'outline outline-2 outline-offset-2 outline-[var(--gold)]' : 'hover:outline hover:outline-1 hover:outline-[var(--gold)]/60'} ${placing ? 'pointer-events-none' : 'cursor-move'}`}
                    style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${h * 100}%` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.png} alt="" draggable={false} className="pointer-events-none h-full w-full" />
                    {isSel && (
                      <>
                        <div className="absolute -top-11 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-[var(--ink)] p-1 shadow-lg">
                          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setDialog({ kind: f.kind, editId: f.id }) }} className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/15" aria-label={t('edit')}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); remove(f.id) }} className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/15" aria-label={t('remove')}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <span
                          onPointerDown={(e) => startDrag(e, f, 'resize')}
                          className="absolute -bottom-3 -right-3 h-6 w-6 cursor-nwse-resize rounded-full border-2 border-white bg-[var(--gold)] shadow"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </div>
                )
              })}
          </PdfPage>
        ))}
      </div>

      {/* Barra in basso: strumenti e salvataggio */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--gold)]/25 bg-white/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(23,23,23,0.08)] backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-2">
          {placing ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--gold-pale)] px-4 py-3" role="status">
              <span className="text-sm font-bold text-[var(--ink)]">{t('placeHint')}</span>
              <button type="button" onClick={() => setPlacing(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white" aria-label={t('cancel')}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {tools.map(({ kind, icon: Icon, label }) => (
                <button key={kind} type="button" onClick={() => setDialog({ kind })} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border border-[var(--gold)]/30 bg-white text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
                  <Icon className="h-5 w-5 text-[var(--gold)]" aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={!fields.length || !!saving} onClick={download} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 font-bold text-[var(--gold-bright)] disabled:opacity-40">
              {saving === 'download' ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />} {t('download')}
            </button>
            {canShare && (
              <button type="button" disabled={!fields.length || !!saving} onClick={share} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 bg-white px-4 font-bold text-[var(--ink)] disabled:opacity-40" aria-label={t('share')}>
                {saving === 'share' ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Share2 className="h-5 w-5" aria-hidden="true" />}
              </button>
            )}
          </div>
          {!fields.length && !placing && <p className="text-center text-xs text-[var(--muted)]">{t('addFirst')}</p>}
        </div>
      </div>

      <InfoCards />

      {dialog?.kind === 'signature' && <SignatureDialog fonts={signatureFonts} defaultName={defaultName} saved={dialog.editId ? null : saved} onClose={() => setDialog(null)} onDone={onSignature} />}
      {(dialog?.kind === 'date' || dialog?.kind === 'text') && (
        <FieldDialog kind={dialog.kind} initial={editing ? { value: editing.value, format: editing.format } : undefined} onClose={() => setDialog(null)} onDone={(value, format) => onFieldValue(dialog.kind as 'date' | 'text', value, format)} />
      )}
    </div>
  )
}

function InfoCards() {
  const t = useTranslations('firmaPdf')
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <div className={`${card} flex gap-3`}>
        <ShieldCheck className="h-6 w-6 shrink-0 text-[#1d6b34]" aria-hidden="true" />
        <div>
          <h2 className="text-base font-extrabold text-[var(--ink)]">{t('privacyTitle')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('privacyText')}</p>
        </div>
      </div>
      <div className={card}>
        <h2 className="text-base font-extrabold text-[var(--ink)]">{t('legalTitle')}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('legalText')}</p>
      </div>
    </section>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Camera, CheckSquare, Download, FileUp, ImageUp, LoaderCircle, Pencil, RotateCw, Share2, ShieldCheck, Square, Trash2, X } from 'lucide-react'
import { scannerDone } from '@/app/actions/scanner'
import { askConfirm } from '@/lib/confirm'
import { canvasOf, rotate90, thumbnail, toBlob } from '@/lib/scanner/image'
import { MAX_PAGES, PDF_MAX_BYTES, buildPdf, newId, openPdfJs, renderPdfPage, type Page, type SourcePdf } from '@/lib/scanner/pdf'
import ScanEditor, { type EditResult, type EditState } from './ScanEditor'
import CameraDialog, { needsCameraDialog } from '@/components/camera/CameraDialog'

// SCANNER E PDF (piano Pro): fotografa i documenti e mettili in un PDF con le
// pagine di altri PDF; poi riordina, ruota, togli, scegli le pagine e
// alleggerisci il file. Tutto nel browser: nulla viene caricato sui server.

type Queued = { file: Blob; replaceId?: string; initial?: EditState }

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
const btn = 'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50'
const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-30'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const save = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export default function ScannerApp() {
  const t = useTranslations('scanner')
  const [pages, setPages] = useState<Page[]>([])
  const [queue, setQueue] = useState<Queued[]>([])
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [light, setLight] = useState(false)
  const [busy, setBusy] = useState<{ kind: 'pdf' | 'export'; done?: number; total?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)
  const [camera, setCamera] = useState(false)
  const sources = useRef(new Map<string, SourcePdf>())
  const cameraRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const probe = new File([new Uint8Array([37])], 'a.pdf', { type: 'application/pdf' })
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }) && /Android|iPhone|iPad/i.test(navigator.userAgent))
    } catch {
      setCanShare(false)
    }
    const all = sources.current
    return () => {
      for (const s of all.values()) void s.js.destroy().catch(() => {})
    }
  }, [])

  // Avviso se si esce con delle pagine non salvate
  useEffect(() => {
    if (!pages.length) return
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [pages.length])

  const room = MAX_PAGES - pages.length

  const addPhotos = (files: FileList | File[] | null) => {
    setError(null)
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name))
    if (!list.length) return
    if (list.length > room) setError(t('errTooMany', { max: MAX_PAGES }))
    setQueue((q) => [...q, ...list.slice(0, Math.max(0, room - q.length)).map((file) => ({ file }))])
  }

  const addPdfs = async (files: FileList | null) => {
    setError(null)
    const list = Array.from(files ?? [])
    if (!list.length) return
    setBusy({ kind: 'pdf' })
    const { PDFDocument, EncryptedPDFError } = await import('pdf-lib')
    let left = room
    for (const file of list) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError(t('errPdfType'))
        continue
      }
      if (file.size > PDF_MAX_BYTES) {
        setError(t('errPdfSize'))
        continue
      }
      try {
        const bytes = await file.arrayBuffer()
        try {
          await PDFDocument.load(bytes.slice(0))
        } catch (e) {
          setError(e instanceof EncryptedPDFError ? t('errPdfLocked') : t('errPdfRead'))
          continue
        }
        const js = await openPdfJs(bytes)
        const id = newId()
        sources.current.set(id, { id, name: file.name, bytes, js })
        if (!name) setName(file.name.replace(/\.pdf$/i, ''))
        const count = Math.min(js.numPages, left)
        if (count < js.numPages) setError(t('errTooMany', { max: MAX_PAGES }))
        for (let i = 0; i < count; i++) {
          const c = await renderPdfPage(js, i, 0, 360)
          const page: Page = { id: newId(), kind: 'pdf', source: id, index: i, turns: 0, thumb: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height }
          setPages((p) => [...p, page])
          setBusy({ kind: 'pdf', done: i + 1, total: count })
        }
        left -= count
      } catch (e) {
        console.error('[scanner] pdf:', e)
        setError(t('errPdfRead'))
      }
    }
    setBusy(null)
  }

  const onEdited = (r: EditResult) => {
    const job = queue[0]
    const id = job.replaceId ?? newId()
    const page: Page = { id, kind: 'image', jpeg: r.jpeg, w: r.w, h: r.h, thumb: r.thumb, origin: { file: job.file, edit: r.edit } }
    setPages((p) => (job.replaceId ? p.map((x) => (x.id === id ? page : x)) : [...p, page]))
    setQueue((q) => q.slice(1))
  }

  const move = (i: number, d: -1 | 1) =>
    setPages((p) => {
      const j = i + d
      if (j < 0 || j >= p.length) return p
      const copy = [...p]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  const rotate = async (page: Page) => {
    if (page.kind === 'pdf') return setPages((p) => p.map((x) => (x.id === page.id ? { ...page, turns: (page.turns + 1) % 4 } : x)))
    const bitmap = await createImageBitmap(page.jpeg)
    const c = canvasOf(bitmap.width, bitmap.height)
    c.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()
    const r = rotate90(c, 1)
    const jpeg = await toBlob(r, 0.9)
    const origin = page.origin && { ...page.origin, edit: { ...page.origin.edit, turns: page.origin.edit.turns + 1 } }
    setPages((p) => p.map((x) => (x.id === page.id ? { ...page, jpeg, w: r.width, h: r.height, thumb: thumbnail(r), origin } : x)))
  }

  const remove = (id: string) => {
    setPages((p) => p.filter((x) => x.id !== id))
    setSelected((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
  }

  const clearAll = async () => {
    if (!(await askConfirm(t('clearConfirm')))) return
    setPages([])
    setSelected(new Set())
    setSelecting(false)
    for (const s of sources.current.values()) void s.js.destroy().catch(() => {})
    sources.current.clear()
  }

  const fileName = () => `${(name.trim() || `${t('defaultName')}-${today()}`).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)}.pdf`

  const exportPdf = async (onlySelected: boolean, share: boolean) => {
    const list = onlySelected ? pages.filter((p) => selected.has(p.id)) : pages
    if (!list.length) return
    setError(null)
    setBusy({ kind: 'export', done: 0, total: list.length })
    try {
      const bytes = await buildPdf(list, sources.current, { light, title: name.trim() || t('defaultName') }, (done) => setBusy({ kind: 'export', done, total: list.length }))
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
      const fname = fileName()
      if (share) {
        try {
          await navigator.share({ files: [new File([blob], fname, { type: 'application/pdf' })], title: fname })
        } catch {
          // condivisione annullata
        }
      } else save(blob, fname)
      void scannerDone()
    } catch (e) {
      console.error('[scanner] export:', e)
      setError(t('errExport'))
    } finally {
      setBusy(null)
    }
  }

  const inputs = (
    <>
      {camera && (
        <CameraDialog
          facing="environment"
          onClose={() => setCamera(false)}
          onPhoto={(file) => {
            setCamera(false)
            addPhotos([file])
          }}
        />
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (addPhotos(e.target.files), (e.target.value = ''))} />
      <input ref={photosRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => (addPhotos(e.target.files), (e.target.value = ''))} />
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => void addPdfs(e.target.files).finally(() => (e.target.value = ''))} />
    </>
  )

  const addButtons = (
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!!busy || room <= 0} onClick={() => (needsCameraDialog() ? setCamera(true) : cameraRef.current?.click())} className={`${btn} bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]`}>
        <Camera className="h-5 w-5" /> {t('scan')}
      </button>
      <button type="button" disabled={!!busy || room <= 0} onClick={() => photosRef.current?.click()} className={`${btn} border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]`}>
        <ImageUp className="h-5 w-5" /> {t('addPhotos')}
      </button>
      <button type="button" disabled={!!busy || room <= 0} onClick={() => pdfRef.current?.click()} className={`${btn} border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]`}>
        <FileUp className="h-5 w-5" /> {t('addPdf')}
      </button>
    </div>
  )

  const status = busy && (
    <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {busy.kind === 'pdf' ? t('loadingPdf', { done: busy.done ?? 0, total: busy.total ?? 0 }) : t('exporting', { done: busy.done ?? 0, total: busy.total ?? 0 })}
    </p>
  )

  const errorBox = error && (
    <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      {error}
    </p>
  )

  const editor = queue[0] && <ScanEditor key={queue.length + (queue[0].replaceId ?? '')} file={queue[0].file} initial={queue[0].initial} queued={queue.length - 1} onDone={onEdited} onCancel={() => setQueue((q) => q.slice(1))} />

  if (!pages.length) {
    return (
      <div className="space-y-6">
        {inputs}
        {editor}
        <div className={card}>
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('startTitle')}</h3>
          <p className="mt-2 text-sm text-[var(--ink)]/75">{t('startText')}</p>
          <div className="mt-5">{addButtons}</div>
          {status}
          {errorBox}
        </div>
        <p className="flex items-start gap-2 text-sm text-[var(--muted)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('privacyNote')}
        </p>
      </div>
    )
  }

  const chosen = pages.filter((p) => selected.has(p.id)).length

  return (
    <div className="space-y-6">
      {inputs}
      {editor}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('pagesTitle', { count: pages.length })}</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => (setSelecting((v) => !v), setSelected(new Set()))} className={`${btn} border border-[var(--gold)]/40 py-2 text-[var(--ink)]`}>
              {selecting ? <X className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />} {selecting ? t('selectDone') : t('select')}
            </button>
            <button type="button" onClick={() => void clearAll()} className={`${btn} py-2 text-red-700 hover:bg-red-50`}>
              <Trash2 className="h-4 w-4" /> {t('clearAll')}
            </button>
          </div>
        </div>
        {selecting && <p className="mt-2 text-sm text-[var(--muted)]">{t('selectHint')}</p>}

        <ol className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {pages.map((p, i) => {
            const isSel = selected.has(p.id)
            const toggle = () =>
              setSelected((s) => {
                const n = new Set(s)
                if (n.has(p.id)) n.delete(p.id)
                else n.add(p.id)
                return n
              })
            return (
              <li key={p.id} className={`flex flex-col rounded-2xl border bg-[var(--background)] p-2 ${isSel ? 'border-[var(--gold)] ring-2 ring-[var(--gold)]' : 'border-[var(--gold)]/25'}`}>
                <button type="button" onClick={selecting ? toggle : undefined} className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-white ${selecting ? 'cursor-pointer' : 'cursor-default'}`} aria-label={t('pageN', { n: i + 1 })} aria-pressed={selecting ? isSel : undefined} tabIndex={selecting ? 0 : -1}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt="" className="max-h-full max-w-full object-contain shadow-sm transition-transform" style={p.kind === 'pdf' && p.turns ? { transform: `rotate(${p.turns * 90}deg)` } : undefined} />
                  {selecting && <span className="absolute right-2 top-2 rounded-md bg-white/90 p-0.5 text-[var(--ink)]">{isSel ? <CheckSquare className="h-5 w-5 text-[var(--gold)]" /> : <Square className="h-5 w-5" />}</span>}
                </button>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-0.5">
                  <span className="mr-auto w-full text-center text-xs font-bold text-[var(--muted)] sm:w-auto sm:pl-1 sm:text-left">{i + 1}</span>
                  <div className="flex flex-wrap justify-center">
                    <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('moveUp')}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" className={iconBtn} disabled={i === pages.length - 1} onClick={() => move(i, 1)} aria-label={t('moveDown')}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" className={iconBtn} onClick={() => void rotate(p)} aria-label={t('rotate')}>
                      <RotateCw className="h-4 w-4" />
                    </button>
                    {p.kind === 'image' && p.origin && (
                      <button type="button" className={iconBtn} onClick={() => setQueue((q) => [...q, { file: p.origin!.file, replaceId: p.id, initial: p.origin!.edit as EditState }])} aria-label={t('edit')}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" className={`${iconBtn} text-red-700`} onClick={() => remove(p.id)} aria-label={t('remove')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="mt-5">{addButtons}</div>
        {status}
        {errorBox}
      </div>

      <div className={card}>
        <h3 className="font-bold text-[var(--ink)]">{t('saveTitle')}</h3>
        <label className="mt-4 block text-sm font-semibold text-[var(--ink)]" htmlFor="sc-name">
          {t('fileName')}
        </label>
        <input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={`${t('defaultName')}-${today()}`} className="mt-1 w-full rounded-xl border border-[var(--gold)]/30 px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--gold)]" />
        <div className="mt-4 inline-flex rounded-2xl border border-[var(--gold)]/30 p-1" role="group" aria-label={t('qualityLabel')}>
          {[false, true].map((v) => (
            <button key={String(v)} type="button" aria-pressed={light === v} onClick={() => setLight(v)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${light === v ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink)]'}`}>
              {v ? t('qualityLight') : t('qualityNormal')}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">{light ? t('qualityLightHint') : t('qualityNormalHint')}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {selecting ? (
            <>
              <button type="button" disabled={!!busy || !chosen} onClick={() => void exportPdf(true, false)} className={`${btn} bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]`}>
                <Download className="h-5 w-5" /> {t('downloadSelected', { count: chosen })}
              </button>
              {canShare && (
                <button type="button" disabled={!!busy || !chosen} onClick={() => void exportPdf(true, true)} className={`${btn} border border-[var(--gold)]/40 bg-white text-[var(--ink)]`}>
                  <Share2 className="h-5 w-5" /> {t('share')}
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" disabled={!!busy} onClick={() => void exportPdf(false, false)} className={`${btn} bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]`}>
                <Download className="h-5 w-5" /> {t('download')}
              </button>
              {canShare && (
                <button type="button" disabled={!!busy} onClick={() => void exportPdf(false, true)} className={`${btn} border border-[var(--gold)]/40 bg-white text-[var(--ink)]`}>
                  <Share2 className="h-5 w-5" /> {t('share')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <p className="flex items-start gap-2 text-sm text-[var(--muted)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('privacyNote')}
      </p>
    </div>
  )
}

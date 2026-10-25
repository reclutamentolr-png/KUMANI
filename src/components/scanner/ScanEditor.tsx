'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Check, Expand, LoaderCircle, RotateCcw, RotateCw, ScanLine, X } from 'lucide-react'
import { PAGE_MAX, SCAN_FILTERS, applyFilter, detectQuad, fullQuad, loadImage, rotate90, thumbnail, toBlob, warp, type Quad, type ScanFilter } from '@/lib/scanner/image'

// Una foto alla volta: prima gli angoli del foglio, poi filtro e rotazione

export type EditState = { quad: Quad; filter: ScanFilter; turns: number }
export type EditResult = { jpeg: Blob; w: number; h: number; thumb: string; edit: EditState }

const btn = 'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50'
const next = () => new Promise((r) => setTimeout(r, 30))

export default function ScanEditor({ file, initial, queued, onDone, onCancel }: { file: Blob; initial?: EditState; queued: number; onDone: (r: EditResult) => void; onCancel: () => void }) {
  const t = useTranslations('scanner')
  const [source, setSource] = useState<HTMLCanvasElement | null>(null)
  const [quad, setQuad] = useState<Quad | null>(initial?.quad ?? null)
  const [stage, setStage] = useState<'crop' | 'filter'>('crop')
  const [filter, setFilter] = useState<ScanFilter>(initial?.filter ?? 'color')
  const [turns, setTurns] = useState(initial?.turns ?? 0)
  const [flat, setFlat] = useState<HTMLCanvasElement | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState(false)
  const [autoFound, setAutoFound] = useState(true)
  const imgRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    loadImage(file)
      .then((c) => {
        if (!alive) return
        setSource(c)
        if (!initial) {
          const found = detectQuad(c)
          setAutoFound(!!found)
          setQuad(found ?? fullQuad(c.width, c.height))
        }
        setBusy(false)
      })
      .catch(() => alive && (setError(true), setBusy(false)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // Foto di partenza disegnata nel riquadro
  useEffect(() => {
    const c = imgRef.current
    if (!c || !source || stage !== 'crop') return
    const k = Math.min(1, 1400 / Math.max(source.width, source.height))
    c.width = Math.round(source.width * k)
    c.height = Math.round(source.height * k)
    c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height)
  }, [source, stage])

  // Anteprima del foglio raddrizzato con filtro e rotazione
  useEffect(() => {
    const c = previewRef.current
    if (!c || !flat || stage !== 'filter') return
    const shown = rotate90(applyFilter(flat, filter), turns)
    c.width = shown.width
    c.height = shown.height
    c.getContext('2d')!.drawImage(shown, 0, 0)
  }, [flat, filter, turns, stage])

  const toSource = useCallback(
    (clientX: number, clientY: number) => {
      const box = boxRef.current?.getBoundingClientRect()
      if (!box || !source) return null
      return { x: Math.min(source.width, Math.max(0, ((clientX - box.left) / box.width) * source.width)), y: Math.min(source.height, Math.max(0, ((clientY - box.top) / box.height) * source.height)) }
    },
    [source],
  )

  const onMove = (e: React.PointerEvent) => {
    if (drag.current === null || !quad) return
    const p = toSource(e.clientX, e.clientY)
    if (!p) return
    const i = drag.current
    setQuad((q) => (q ? (q.map((v, k) => (k === i ? p : v)) as Quad) : q))
  }

  const goFilter = async () => {
    if (!source || !quad) return
    setBusy(true)
    await next()
    setFlat(warp(source, quad, 1100))
    setStage('filter')
    setBusy(false)
  }

  const save = async () => {
    if (!source || !quad) return
    setBusy(true)
    await next()
    try {
      const page = rotate90(applyFilter(warp(source, quad, PAGE_MAX), filter), turns)
      const jpeg = await toBlob(page, filter === 'bw' ? 0.8 : 0.85)
      onDone({ jpeg, w: page.width, h: page.height, thumb: thumbnail(page), edit: { quad, filter, turns } })
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  const handles = quad && source ? quad.map((p) => ({ x: (p.x / source.width) * 100, y: (p.y / source.height) * 100 })) : []

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--ink)] text-white" role="dialog" aria-modal="true" aria-label={t('editorTitle')}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <button type="button" onClick={stage === 'filter' ? () => setStage('crop') : onCancel} className="flex items-center gap-2 text-sm font-semibold hover:text-[var(--gold-bright)]">
          {stage === 'filter' ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
          {stage === 'filter' ? t('back') : t('cancel')}
        </button>
        <p className="text-sm font-semibold">
          {stage === 'crop' ? t('stepCorners') : t('stepFilter')}
          {queued > 0 && <span className="ml-2 text-white/60">{t('queued', { count: queued })}</span>}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{t('errImage')}</p>
        ) : !source ? (
          <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold-bright)]" />
        ) : stage === 'crop' ? (
          <div
            ref={boxRef}
            className="relative inline-block touch-none select-none"
            onPointerMove={onMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            <canvas ref={imgRef} className="block h-auto max-h-[calc(100dvh-230px)] w-auto max-w-full rounded-lg" />
            <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <polygon points={handles.map((h) => `${h.x},${h.y}`).join(' ')} fill="rgba(199,154,59,0.18)" stroke="#e8c26b" strokeWidth="0.6" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
            </svg>
            {handles.map((h, i) => (
              <button
                key={i}
                type="button"
                aria-label={t('corner', { n: i + 1 })}
                className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-[3px] border-[#e8c26b] bg-white/25 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
                onPointerDown={(e) => {
                  drag.current = i
                  boxRef.current?.setPointerCapture(e.pointerId)
                }}
              />
            ))}
          </div>
        ) : (
          <canvas ref={previewRef} className="block h-auto max-h-[calc(100dvh-250px)] w-auto max-w-full rounded-lg bg-white shadow-2xl" />
        )}
      </div>

      <div className="space-y-3 border-t border-white/10 px-4 py-4">
        {stage === 'crop' ? (
          <>
            <p className="text-center text-xs text-white/70">{autoFound ? t('cornersHint') : t('cornersNotFound')}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" disabled={busy || !source} onClick={() => source && setQuad(fullQuad(source.width, source.height))} className={`${btn} border border-white/25 text-white hover:border-[var(--gold-bright)]`}>
                <Expand className="h-4 w-4" /> {t('wholePhoto')}
              </button>
              <button
                type="button"
                disabled={busy || !source}
                onClick={() => {
                  if (!source) return
                  const found = detectQuad(source)
                  setAutoFound(!!found)
                  setQuad(found ?? fullQuad(source.width, source.height))
                }}
                className={`${btn} border border-white/25 text-white hover:border-[var(--gold-bright)]`}
              >
                <ScanLine className="h-4 w-4" /> {t('autoCorners')}
              </button>
              <button type="button" disabled={busy || !source} onClick={() => void goFilter()} className={`${btn} bg-[var(--gold)] text-[var(--ink)] hover:bg-[var(--gold-bright)]`}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t('next')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t('filterLabel')}>
              {SCAN_FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${filter === f ? 'bg-white text-[var(--ink)]' : 'border border-white/25 text-white'}`}>
                  {t(`filter_${f}`)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" aria-label={t('rotateLeft')} onClick={() => setTurns((v) => v - 1)} className={`${btn} border border-white/25 px-3 text-white`}>
                <RotateCcw className="h-5 w-5" />
              </button>
              <button type="button" aria-label={t('rotateRight')} onClick={() => setTurns((v) => v + 1)} className={`${btn} border border-white/25 px-3 text-white`}>
                <RotateCw className="h-5 w-5" />
              </button>
              <button type="button" disabled={busy} onClick={() => void save()} className={`${btn} bg-[var(--gold)] text-[var(--ink)] hover:bg-[var(--gold-bright)]`}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t('savePage')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

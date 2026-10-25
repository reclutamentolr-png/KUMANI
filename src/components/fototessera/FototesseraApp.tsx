'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Grid3x3, ImageUp, LoaderCircle, RotateCcw, RotateCw, Share2, ShieldCheck, TriangleAlert, Undo2, CircleCheck, X } from 'lucide-react'
import { fototesseraDone } from '@/app/actions/fototessera'
import { DEFAULT_ADJUST, HEAD_MM, PHOTO_DPI, PHOTO_MM, PHOTO_PX, PHOTO_PX_PER_MM, SHEET, fitFace, headLines, placement, setJpegDpi, sheetSlots, type Adjust, type Fit } from '@/lib/fototessera/geometry'
import { analyze, busyBackground, cutout, cutoutMatte, loadMatte, loadVision, matte, type Warning } from '@/lib/fototessera/vision'
import CameraDialog, { needsCameraDialog } from '@/components/camera/CameraDialog'

// FOTOTESSERA (piano Plus): dalla foto del telefono alla fototessera 35×45 mm
// con sfondo bianco, testa della misura giusta e foglio 10×15 da stampare.
// Tutto nel browser: la foto non lascia il dispositivo.

const MAX_SIDE = 1600
const PREVIEW_PX_PER_MM = 8
const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
const btn = 'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50'
const small = 'flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--gold)]/30 bg-white text-[var(--ink)] hover:border-[var(--gold)]'

type Ready = { source: HTMLCanvasElement; cut: HTMLCanvasElement | null; fit: Fit; tilt: number; warnings: Warning[] }
type Phase = { kind: 'start' } | { kind: 'busy'; step: 'loading' | 'analyzing' | 'matting' } | { kind: 'error'; key: string } | { kind: 'ready' }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Disegna la fototessera a pxPerMm pixel per millimetro
function drawPhoto(ctx: CanvasRenderingContext2D, r: Ready, adj: Adjust, white: boolean, pxPerMm: number) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  const p = placement(r.fit, adj, pxPerMm)
  ctx.translate(p.x, p.y)
  ctx.rotate(p.angle)
  ctx.scale(p.scale, p.scale)
  ctx.translate(-p.pivot.x, -p.pivot.y)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(white && r.cut ? r.cut : r.source, 0, 0)
  ctx.restore()
}

// La foto di partenza copre tutta la fototessera? (con lo sfondo bianco basta il basso)
function coversEdges(r: Ready, adj: Adjust, white: boolean) {
  const p = placement(r.fit, adj, 1)
  const cos = Math.cos(-p.angle)
  const sin = Math.sin(-p.angle)
  const corners = white ? [[0, PHOTO_MM.h], [PHOTO_MM.w, PHOTO_MM.h]] : [[0, 0], [PHOTO_MM.w, 0], [0, PHOTO_MM.h], [PHOTO_MM.w, PHOTO_MM.h]]
  return corners.every(([x, y]) => {
    const dx = (x - p.x) / p.scale
    const dy = (y - p.y) / p.scale
    const sx = p.pivot.x + dx * cos - dy * sin
    const sy = p.pivot.y + dx * sin + dy * cos
    return sx >= -2 && sy >= -2 && sx <= r.source.width + 2 && sy <= r.source.height + 2
  })
}

const toJpeg = (canvas: HTMLCanvasElement, dpi: number) =>
  new Promise<Blob | null>((resolve) =>
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve(null)
      const bytes = setJpegDpi(new Uint8Array(await blob.arrayBuffer()), dpi)
      resolve(new Blob([bytes as BlobPart], { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.95),
  )

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

export default function FototesseraApp() {
  const t = useTranslations('fototessera')
  const [phase, setPhase] = useState<Phase>({ kind: 'start' })
  const [ready, setReady] = useState<Ready | null>(null)
  const [adj, setAdj] = useState<Adjust>(DEFAULT_ADJUST)
  const [white, setWhite] = useState(true)
  const [guides, setGuides] = useState(true)
  const [canShare, setCanShare] = useState(false)
  const [busySave, setBusySave] = useState(false)
  const [camera, setCamera] = useState(false)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const takeRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const probe = new File([new Uint8Array([255, 216])], 'a.jpg', { type: 'image/jpeg' })
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] }) && /Android|iPhone|iPad/i.test(navigator.userAgent))
    } catch {
      setCanShare(false)
    }
  }, [])

  // Anteprima con le linee guida
  const paint = useCallback(() => {
    const canvas = previewRef.current
    if (!canvas || !ready) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ppm = PREVIEW_PX_PER_MM * dpr
    canvas.width = Math.round(PHOTO_MM.w * ppm)
    canvas.height = Math.round(PHOTO_MM.h * ppm)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawPhoto(ctx, ready, adj, white, ppm)
    if (!guides) return
    const lines = headLines(adj)
    ctx.save()
    ctx.strokeStyle = 'rgba(199,154,59,0.95)'
    ctx.lineWidth = 1.5 * dpr
    ctx.setLineDash([6 * dpr, 4 * dpr])
    for (const mm of [lines.crown, lines.chin]) {
      ctx.beginPath()
      ctx.moveTo(0, mm * ppm)
      ctx.lineTo(canvas.width, mm * ppm)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(199,154,59,0.45)'
    ctx.beginPath()
    ctx.moveTo(canvas.width / 2, 0)
    ctx.lineTo(canvas.width / 2, canvas.height)
    ctx.stroke()
    ctx.restore()
  }, [ready, adj, white, guides])

  useEffect(() => {
    paint()
  }, [paint])

  const openFile = async (file: File | undefined) => {
    if (!file) return
    setPhase({ kind: 'busy', step: 'loading' })
    try {
      // Scontorno fine in parallelo: se non si carica resta quello di MediaPipe
      void loadMatte().catch(() => {})
      await loadVision()
    } catch (e) {
      console.error('[fototessera] modelli:', e)
      return setPhase({ kind: 'error', key: 'errLoad' })
    }
    setPhase({ kind: 'busy', step: 'analyzing' })
    let source: HTMLCanvasElement
    try {
      const bitmap = await createImageBitmap(file)
      const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
      source = document.createElement('canvas')
      source.width = Math.round(bitmap.width * k)
      source.height = Math.round(bitmap.height * k)
      source.getContext('2d')!.drawImage(bitmap, 0, 0, source.width, source.height)
      bitmap.close()
    } catch {
      return setPhase({ kind: 'error', key: 'errRead' })
    }
    try {
      const result = await analyze(source)
      if (!result.ok) return setPhase({ kind: 'error', key: result.reason === 'noFace' ? 'errNoFace' : 'errManyFaces' })
      const fit = fitFace(result.face)
      setPhase({ kind: 'busy', step: 'matting' })
      const alpha = await matte(source)
      const warnings = [...result.warnings]
      if (alpha && busyBackground(source, alpha)) warnings.push('background')
      const cut = alpha ? cutoutMatte(source, alpha) : result.mask ? cutout(source, result.mask) : null
      setReady({ source, cut, fit, tilt: result.tilt, warnings })
      setAdj(DEFAULT_ADJUST)
      setWhite(!!cut)
      setPhase({ kind: 'ready' })
    } catch (e) {
      console.error('[fototessera] analisi:', e)
      setPhase({ kind: 'error', key: 'errRead' })
    }
  }

  const nudge = (patch: Partial<Adjust>) => setAdj((a) => ({ headMm: clamp(patch.headMm ?? a.headMm, HEAD_MM.min, HEAD_MM.max), dxMm: clamp(a.dxMm + (patch.dxMm ?? 0), -6, 6), dyMm: clamp(a.dyMm + (patch.dyMm ?? 0), -4, 4), turnDeg: clamp(a.turnDeg + (patch.turnDeg ?? 0), -10, 10) }))

  const renderAt = (pxPerMm: number) => {
    const c = document.createElement('canvas')
    c.width = Math.round(PHOTO_MM.w * pxPerMm)
    c.height = Math.round(PHOTO_MM.h * pxPerMm)
    drawPhoto(c.getContext('2d')!, ready!, adj, white, pxPerMm)
    return c
  }

  const photoBlob = () => {
    const c = renderAt(PHOTO_PX_PER_MM)
    return toJpeg(c, PHOTO_DPI)
  }

  const downloadPhoto = async () => {
    if (!ready) return
    setBusySave(true)
    const blob = await photoBlob()
    setBusySave(false)
    if (!blob) return
    save(blob, `fototessera-35x45-${PHOTO_PX.w}x${PHOTO_PX.h}.jpg`)
    void fototesseraDone()
  }

  const downloadSheet = async () => {
    if (!ready) return
    setBusySave(true)
    const one = renderAt(SHEET.pxPerMm)
    const sheet = document.createElement('canvas')
    sheet.width = SHEET.w
    sheet.height = SHEET.h
    const ctx = sheet.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, SHEET.w, SHEET.h)
    ctx.strokeStyle = '#b8b8b8'
    ctx.lineWidth = 1
    for (const s of sheetSlots()) {
      ctx.drawImage(one, s.x, s.y, s.w, s.h)
      ctx.strokeRect(s.x - 0.5, s.y - 0.5, s.w + 1, s.h + 1)
    }
    const blob = await toJpeg(sheet, Math.round((SHEET.pxPerMm * 25.4) as number))
    setBusySave(false)
    if (!blob) return
    save(blob, 'fototessera-foglio-10x15.jpg')
    void fototesseraDone()
  }

  const share = async () => {
    if (!ready) return
    const blob = await photoBlob()
    if (!blob) return
    try {
      await navigator.share({ files: [new File([blob], 'fototessera-35x45.jpg', { type: 'image/jpeg' })], title: t('shareTitle') })
      void fototesseraDone()
    } catch {
      // condivisione annullata
    }
  }

  const reset = () => {
    setReady(null)
    setAdj(DEFAULT_ADJUST)
    setPhase({ kind: 'start' })
  }

  const takePhoto = () => (needsCameraDialog() ? setCamera(true) : takeRef.current?.click())

  const fileInputs = (
    <>
      {camera && (
        <CameraDialog
          onClose={() => setCamera(false)}
          onPhoto={(file) => {
            setCamera(false)
            void openFile(file)
          }}
        />
      )}
      <input ref={takeRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void openFile(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      <input ref={pickRef} type="file" accept="image/*" className="hidden" onChange={(e) => void openFile(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
    </>
  )

  if (phase.kind !== 'ready' || !ready) {
    const busy = phase.kind === 'busy'
    return (
      <div className="space-y-6">
        {fileInputs}
        <div className={card}>
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('tipsTitle')}</h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--ink)]/80">
            {(['tip1', 'tip2', 'tip3', 'tip4', 'tip5'] as const).map((k) => (
              <li key={k} className="flex gap-2">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
                {t(k)}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={takePhoto} className={`${btn} bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]`}>
              <Camera className="h-5 w-5" /> {t('take')}
            </button>
            <button type="button" disabled={busy} onClick={() => pickRef.current?.click()} className={`${btn} border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]`}>
              <ImageUp className="h-5 w-5" /> {t('choose')}
            </button>
          </div>
          {busy && (
            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin" /> {t(phase.step)}
            </p>
          )}
          {phase.kind === 'error' && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{t(phase.key)}</p>}
        </div>
        <p className="flex items-start gap-2 text-sm text-[var(--muted)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('privacyNote')}
        </p>
      </div>
    )
  }

  const warnings: string[] = [...ready.warnings]
  if (!coversEdges(ready, adj, white)) warnings.push('edges')
  if (!ready.cut) warnings.push('noMask')

  return (
    <div className="space-y-6">
      {fileInputs}
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className={`${card} flex flex-col items-center`}>
          <canvas ref={previewRef} className="rounded-sm border border-gray-300 shadow-sm" style={{ width: PHOTO_MM.w * PREVIEW_PX_PER_MM, height: PHOTO_MM.h * PREVIEW_PX_PER_MM }} aria-label={t('previewLabel')} role="img" />
          <p className="mt-2 text-xs text-[var(--muted)]">{t('size')}</p>
          <button type="button" onClick={reset} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
            <X className="h-4 w-4" /> {t('discard')}
          </button>
          <label className="mt-2 flex items-center gap-2 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
            {t('guides')}
          </label>
        </div>

        <div className="space-y-6">
          <div className={card}>
            <h3 className="font-bold text-[var(--ink)]">{t('adjustTitle')}</h3>
            <label className="mt-4 block text-sm font-semibold text-[var(--ink)]" htmlFor="ft-head">
              {t('headSize', { mm: adj.headMm.toFixed(1).replace('.0', '') })}
            </label>
            <input id="ft-head" type="range" min={HEAD_MM.min} max={HEAD_MM.max} step={0.5} value={adj.headMm} onChange={(e) => nudge({ headMm: Number(e.target.value) })} className="mt-2 w-full accent-[var(--gold)]" />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" className={small} aria-label={t('up')} onClick={() => nudge({ dyMm: -0.5 })}>
                <ChevronUp className="h-5 w-5" />
              </button>
              <button type="button" className={small} aria-label={t('down')} onClick={() => nudge({ dyMm: 0.5 })}>
                <ChevronDown className="h-5 w-5" />
              </button>
              <button type="button" className={small} aria-label={t('left')} onClick={() => nudge({ dxMm: -0.5 })}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" className={small} aria-label={t('right')} onClick={() => nudge({ dxMm: 0.5 })}>
                <ChevronRight className="h-5 w-5" />
              </button>
              <button type="button" className={small} aria-label={t('rotateLeft')} onClick={() => nudge({ turnDeg: -0.5 })}>
                <RotateCcw className="h-5 w-5" />
              </button>
              <button type="button" className={small} aria-label={t('rotateRight')} onClick={() => nudge({ turnDeg: 0.5 })}>
                <RotateCw className="h-5 w-5" />
              </button>
              <button type="button" className={`${small} w-auto px-3 text-sm font-semibold`} onClick={() => setAdj(DEFAULT_ADJUST)}>
                <Undo2 className="mr-1 h-4 w-4" /> {t('reset')}
              </button>
            </div>
            {ready.cut && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-[var(--ink)]">{t('background')}</p>
                <div className="mt-2 inline-flex rounded-2xl border border-[var(--gold)]/30 p-1">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" aria-pressed={white === v} onClick={() => setWhite(v)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${white === v ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink)]'}`}>
                      {v ? t('bgWhite') : t('bgOriginal')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={card}>
            <h3 className="font-bold text-[var(--ink)]">{t('checksTitle')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex gap-2 text-emerald-800">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> {t('checkOk')}
              </li>
              {Math.abs(ready.tilt) >= 1 && (
                <li className="flex gap-2 text-emerald-800">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> {t('checkStraight', { deg: Math.round(Math.abs(ready.tilt)) })}
                </li>
              )}
              {warnings.map((w) => (
                <li key={w} className="flex gap-2 text-amber-800">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {t(`warn_${w}`)}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[var(--muted)]">{t('disclaimer')}</p>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busySave} onClick={() => void downloadPhoto()} className={`${btn} bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]`}>
            <Download className="h-5 w-5" /> {t('download')}
          </button>
          <button type="button" disabled={busySave} onClick={() => void downloadSheet()} className={`${btn} border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]`}>
            <Grid3x3 className="h-5 w-5" /> {t('downloadSheet')}
          </button>
          {canShare && (
            <button type="button" onClick={() => void share()} className={`${btn} border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]`}>
              <Share2 className="h-5 w-5" /> {t('share')}
            </button>
          )}
          <button type="button" onClick={reset} className={`${btn} text-[var(--ink)] hover:text-[var(--gold)]`}>
            <Camera className="h-5 w-5" /> {t('newPhoto')}
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">{t('sheetHint')}</p>
      </div>
      <p className="flex items-start gap-2 text-sm text-[var(--muted)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('privacyNote')}
      </p>
    </div>
  )
}

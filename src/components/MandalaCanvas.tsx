'use client'

import { completeMandala } from '@/app/actions/mandala'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Eraser, Paintbrush, Share2, Trash2, Undo2 } from 'lucide-react'

const SEGMENT_OPTIONS = [6, 8, 12, 16] as const
const PALETTE = ['#c79a3b', '#e7c56a', '#4f46e5', '#7c3aed', '#dc2626', '#fdf8ee'] as const
const CANVAS_SIZE = 900
const MAX_HISTORY = 10

const BACKGROUND_COLOR: Record<'dark' | 'ivory', string> = {
  dark: '#171717',
  ivory: '#fffdf7',
}

type Tool = 'pen' | 'eraser'

// Canvas ad area unica (nessuna libreria — Canvas API nativa, come descritto
// nel documento di design): ogni tratto disegnato dal dito viene replicato
// radialmente attorno al centro (N segmenti) con un effetto specchio
// aggiuntivo, trasformando qualsiasi gesto in un mandala simmetrico. Tutto
// avviene client-side, nessuna chiamata di rete né persistenza — lo stato
// vive solo nel canvas finché la pagina resta aperta.
export default function MandalaCanvas({ referralUrl }: { referralUrl: string }) {
  const t = useTranslations('mandala')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<ImageData[]>([])

  const [segments, setSegments] = useState<number>(8)
  const [background, setBackground] = useState<'dark' | 'ivory'>('dark')
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState<string>(PALETTE[0])
  const [thickness, setThickness] = useState(6)
  const [canUndo, setCanUndo] = useState(false)
  const [shareSupported, setShareSupported] = useState(false)
  const [shareError, setShareError] = useState(false)

  const fillBackground = useCallback((ctx: CanvasRenderingContext2D, bg: 'dark' | 'ivory') => {
    ctx.fillStyle = BACKGROUND_COLOR[bg]
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Al massimo 2: oltre la tela pesa troppo in memoria per «Annulla»
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = CANVAS_SIZE * dpr
    canvas.height = CANVAS_SIZE * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    fillBackground(ctx, 'dark')
    ctxRef.current = ctx
    setShareSupported(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [fillBackground])

  const pushHistory = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    // Tutta la tela in pixel reali (sugli schermi retina è più grande di CANVAS_SIZE)
    historyRef.current.push(ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height))
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
    setCanUndo(historyRef.current.length > 0)
  }, [])

  const handleBackgroundChange = (bg: 'dark' | 'ivory') => {
    const ctx = ctxRef.current
    if (!ctx) return
    pushHistory()
    setBackground(bg)
    fillBackground(ctx, bg)
  }

  const handleClear = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    pushHistory()
    fillBackground(ctx, background)
  }

  const handleUndo = () => {
    const ctx = ctxRef.current
    const previous = historyRef.current.pop()
    if (!ctx || !previous) return
    ctx.putImageData(previous, 0, 0)
    setCanUndo(historyRef.current.length > 0)
  }

  // Un tratto (prevPoint -> point, entrambi relativi al centro) viene
  // ridisegnato una volta per ogni segmento radiale, più una copia
  // specchiata sull'asse verticale prima della rotazione — l'"effetto
  // specchio" descritto nel documento di design.
  const drawSymmetric = useCallback(
    (prev: { x: number; y: number }, point: { x: number; y: number }) => {
      const ctx = ctxRef.current
      if (!ctx) return
      const center = CANVAS_SIZE / 2
      const relPrevX = prev.x - center
      const relPrevY = prev.y - center
      const relX = point.x - center
      const relY = point.y - center
      const angleStep = (Math.PI * 2) / segments

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = thickness
      // La gomma ridipinge con il colore di fondo (niente buchi trasparenti)
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = tool === 'eraser' ? BACKGROUND_COLOR[background] : color

      for (let i = 0; i < segments; i++) {
        const angle = i * angleStep
        ctx.save()
        ctx.translate(center, center)
        ctx.rotate(angle)

        ctx.beginPath()
        ctx.moveTo(relPrevX, relPrevY)
        ctx.lineTo(relX, relY)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(-relPrevX, relPrevY)
        ctx.lineTo(-relX, relY)
        ctx.stroke()

        ctx.restore()
      }
    },
    [segments, thickness, tool, color, background]
  )

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pushHistory()
    drawingRef.current = true
    lastPointRef.current = getPoint(e)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastPointRef.current) return
    const point = getPoint(e)
    drawSymmetric(lastPointRef.current, point)
    lastPointRef.current = point
  }

  const stopDrawing = () => {
    drawingRef.current = false
    lastPointRef.current = null
  }

  // Copia il disegno su un canvas offscreen e aggiunge un watermark
  // discreto in basso a destra prima di esportare/condividere — ogni
  // screenshot condiviso resta riconoscibile come KUMANI.
  const exportWithWatermark = (): HTMLCanvasElement | null => {
    const source = canvasRef.current
    if (!source) return null
    const out = document.createElement('canvas')
    out.width = CANVAS_SIZE
    out.height = CANVAS_SIZE
    const outCtx = out.getContext('2d')
    if (!outCtx) return null
    outCtx.drawImage(source, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
    outCtx.font = '600 20px sans-serif'
    outCtx.textAlign = 'right'
    outCtx.fillStyle = 'rgba(231, 197, 106, 0.85)'
    outCtx.fillText('KUMANI', CANVAS_SIZE - 24, CANVAS_SIZE - 24)
    return out
  }

  const handleDownload = () => {
    const out = exportWithWatermark()
    if (!out) return
    const link = document.createElement('a')
    link.download = 'mandala-kumani.png'
    link.href = out.toDataURL('image/png')
    link.click()
    completeMandala()
  }

  const handleShare = async () => {
    setShareError(false)
    const out = exportWithWatermark()
    if (!out) return
    out.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], 'mandala-kumani.png', { type: 'image/png' })
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: `${t('shareText')}\n${referralUrl}` })
          completeMandala()
        } else {
          setShareError(true)
        }
      } catch {
        // L'utente ha annullato la condivisione: nessun errore da mostrare.
      }
    }, 'image/png')
  }

  return (
    <div>
      <div
        className="mx-auto aspect-square w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--gold)]/30 shadow-lg"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
          aria-label={t('canvasLabel')}
        />
      </div>

      <div className="mx-auto mt-6 max-w-xl space-y-5 rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('segmentsLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {SEGMENT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSegments(n)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  segments === n
                    ? 'border-transparent bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]'
                    : 'border-[var(--gold)]/30 text-[var(--ink)] hover:bg-[var(--gold)]/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('backgroundLabel')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleBackgroundChange('dark')}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  background === 'dark' ? 'border-[var(--gold)] bg-[var(--ink)] text-white' : 'border-[var(--gold)]/30 text-[var(--ink)] hover:bg-[var(--gold)]/10'
                }`}
              >
                {t('backgroundDark')}
              </button>
              <button
                type="button"
                onClick={() => handleBackgroundChange('ivory')}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  background === 'ivory' ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-[var(--gold)]/30 text-[var(--ink)] hover:bg-[var(--gold)]/10'
                }`}
              >
                {t('backgroundIvory')}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('toolLabel')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTool('pen')}
                aria-label={t('toolPen')}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                  tool === 'pen' ? 'border-transparent bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]' : 'border-[var(--gold)]/30 text-[var(--ink)] hover:bg-[var(--gold)]/10'
                }`}
              >
                <Paintbrush className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                aria-label={t('toolEraser')}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                  tool === 'eraser' ? 'border-transparent bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]' : 'border-[var(--gold)]/30 text-[var(--ink)] hover:bg-[var(--gold)]/10'
                }`}
              >
                <Eraser className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-[140px]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('thicknessLabel')}</p>
            <input
              type="range"
              min={1}
              max={24}
              value={thickness}
              onChange={(e) => setThickness(parseInt(e.target.value, 10))}
              className="w-full accent-[var(--gold)]"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('colorLabel')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${color === c ? 'scale-110 border-[var(--ink)]' : 'border-white/60'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label={t('colorCustom')}
              className="h-8 w-8 cursor-pointer rounded-full border-2 border-[var(--gold)]/30 bg-transparent p-0"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--gold)]/15 pt-4">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--gold)]/30 px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--gold)]/10 disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" /> {t('undo')}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--gold)]/30 px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--gold)]/10"
          >
            <Trash2 className="h-4 w-4" /> {t('clear')}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--gold)]/30 px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--gold)]/10"
          >
            <Download className="h-4 w-4" /> {t('download')}
          </button>
          {shareSupported && (
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-3 py-2 text-sm font-bold text-[var(--ink)] hover:brightness-105"
            >
              <Share2 className="h-4 w-4" /> {t('share')}
            </button>
          )}
        </div>
        {shareError && <p className="text-xs text-[var(--muted)]">{t('shareUnavailable')}</p>}
      </div>
    </div>
  )
}

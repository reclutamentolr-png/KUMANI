'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Broom, Brush, Eraser, FlipHorizontal2, PaintBucket, Rainbow, Share2, Sparkles, Stamp, Undo2, Check } from 'lucide-react'
import { ERASER, paletteFor } from '@/lib/kids/catalog'
import type { KidProfile } from '@/lib/kids/storage'
import { KidsButton, KidsIconButton } from './ColorStage'
import { melody, tone } from './kidsAudio'
import type { KidsActions } from './actions'

// «Disegno libero con pennelli magici»: si disegna a dito su un foglio bianco
// con pennello, arcobaleno, stelline, timbri e gomma, anche a specchio (2 o 4
// copie, per farfalle e mandala). Ogni tratto è salvato come dati: «Annulla»
// ridisegna tutto senza il tratto, e il foglio in corso resta nel telefono.

const W = 800
const H = 880
const SIZES = [10, 20, 36]
const STAMPS = ['cuore', 'stella', 'fiore', 'sole', 'faccina'] as const
type StampShape = (typeof STAMPS)[number]
type Tool = 'pennello' | 'arcobaleno' | 'stelline' | 'timbro' | 'gomma' | 'sfondo'
type Mirror = 0 | 1 | 2
type Star = { x: number; y: number; r: number; rot: number; color: string }
type Op =
  | { kind: 'stroke'; tool: 'pennello' | 'arcobaleno' | 'gomma'; color: string; size: number; mirror: Mirror; hue: number; pts: number[] }
  | { kind: 'stars'; mirror: Mirror; stars: Star[] }
  | { kind: 'stamp'; shape: StampShape; color: string; size: number; mirror: Mirror; x: number; y: number }
  | { kind: 'fill'; color: string }

const rand = () => Math.random()
const INK = '#2B2D52'
const STAR_COLORS = ['#FFC93C', '#FF6A3D', '#7CC3EE', '#F49CBB', '#5DB14E', '#8E5CC4']
const MAX_SAVED_BYTES = 300_000

// Copie a specchio di un punto
const mirrors = (mirror: Mirror) =>
  mirror === 0
    ? [(x: number, y: number) => [x, y]]
    : mirror === 1
      ? [(x: number, y: number) => [x, y], (x: number, y: number) => [W - x, y]]
      : [(x: number, y: number) => [x, y], (x: number, y: number) => [W - x, y], (x: number, y: number) => [x, H - y], (x: number, y: number) => [W - x, H - y]]

function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + rr * Math.sin(a), y - rr * Math.cos(a))
  }
  ctx.closePath()
}

function drawStamp(ctx: CanvasRenderingContext2D, shape: StampShape, x: number, y: number, s: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.lineWidth = 5
  ctx.strokeStyle = INK
  ctx.fillStyle = color
  ctx.lineJoin = 'round'
  if (shape === 'cuore') {
    ctx.beginPath()
    ctx.moveTo(0, s * 0.35)
    ctx.bezierCurveTo(-s * 1.1, -s * 0.3, -s * 0.45, -s * 1.05, 0, -s * 0.45)
    ctx.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.3, 0, s * 0.35)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (shape === 'stella') {
    starPath(ctx, 0, 0, s, 0)
    ctx.fill()
    ctx.stroke()
  } else if (shape === 'fiore') {
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5
      ctx.beginPath()
      ctx.arc(Math.sin(a) * s * 0.55, -Math.cos(a) * s * 0.55, s * 0.42, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.fillStyle = '#FFC93C'
    ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (shape === 'sole') {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      ctx.beginPath()
      ctx.moveTo(Math.sin(a - 0.2) * s * 0.62, -Math.cos(a - 0.2) * s * 0.62)
      ctx.lineTo(Math.sin(a) * s, -Math.cos(a) * s)
      ctx.lineTo(Math.sin(a + 0.2) * s * 0.62, -Math.cos(a + 0.2) * s * 0.62)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.arc(-s * 0.28, -s * 0.18, s * 0.1, 0, Math.PI * 2)
    ctx.arc(s * 0.28, -s * 0.18, s * 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, s * 0.05, s * 0.4, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }
  ctx.restore()
}

function drawSegment(ctx: CanvasRenderingContext2D, op: Extract<Op, { kind: 'stroke' }>, i: number) {
  const pts = op.pts
  const x0 = pts[i - 2]
  const y0 = pts[i - 1]
  const x1 = pts[i]
  const y1 = pts[i + 1]
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = op.size
  ctx.strokeStyle = op.tool === 'arcobaleno' ? `hsl(${(op.hue + i * 2) % 360} 85% 55%)` : op.color
  for (const m of mirrors(op.mirror)) {
    const [ax, ay] = m(x0, y0)
    const [bx, by] = m(x1, y1)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }
}

function drawStars(ctx: CanvasRenderingContext2D, mirror: Mirror, stars: Star[]) {
  ctx.lineWidth = 3
  ctx.strokeStyle = INK
  for (const s of stars)
    for (const m of mirrors(mirror)) {
      const [x, y] = m(s.x, s.y)
      ctx.fillStyle = s.color
      starPath(ctx, x, y, s.r, s.rot)
      ctx.fill()
      ctx.stroke()
    }
}

function drawOp(ctx: CanvasRenderingContext2D, op: Op) {
  if (op.kind === 'fill') {
    ctx.fillStyle = op.color
    ctx.fillRect(0, 0, W, H)
  } else if (op.kind === 'stroke') {
    if (op.pts.length === 2) {
      // Un tocco solo: un punto
      ctx.fillStyle = op.tool === 'arcobaleno' ? `hsl(${op.hue} 85% 55%)` : op.color
      for (const m of mirrors(op.mirror)) {
        const [x, y] = m(op.pts[0], op.pts[1])
        ctx.beginPath()
        ctx.arc(x, y, op.size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    for (let i = 2; i < op.pts.length; i += 2) drawSegment(ctx, op, i)
  } else if (op.kind === 'stars') {
    drawStars(ctx, op.mirror, op.stars)
  } else {
    for (const m of mirrors(op.mirror)) {
      const [x, y] = m(op.x, op.y)
      drawStamp(ctx, op.shape, x, y, op.size, op.color)
    }
  }
}

export default function FreeDrawGame({
  profile,
  sound,
  onProfileChange,
  actions,
}: {
  profile: KidProfile
  sound: boolean
  onProfileChange: (profile: KidProfile) => void
  actions: KidsActions
}) {
  const t = useTranslations('kids')
  const palette = useMemo(() => paletteFor(Math.max(profile.age, 5)), [profile.age])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ops, setOps] = useState<Op[]>(() => (Array.isArray(profile.sketch) ? (profile.sketch as Op[]) : []))
  // «Pulisci» svuota il foglio; finché non si disegna di nuovo «Annulla» lo riporta indietro
  const [cleared, setCleared] = useState<Op[] | null>(null)
  const [tool, setTool] = useState<Tool>('pennello')
  const [colorIndex, setColorIndex] = useState(0)
  const [size, setSize] = useState(1)
  const [mirror, setMirror] = useState<Mirror>(0)
  const [stamp, setStamp] = useState<StampShape>('cuore')
  const live = useRef<Op | null>(null)
  const lastStar = useRef<[number, number] | null>(null)
  const color = palette[colorIndex]?.hex ?? '#E8473B'

  const redraw = useCallback((list: Op[]) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, W, H)
    list.forEach((op) => drawOp(ctx, op))
  }, [])
  useEffect(() => redraw(ops), [ops, redraw])

  // Il foglio in corso resta nel telefono (se non è troppo grande)
  useEffect(() => {
    const timer = setTimeout(() => {
      const json = JSON.stringify(ops)
      if (json.length < MAX_SAVED_BYTES && JSON.stringify(profile.sketch ?? []) !== json) onProfileChange({ ...profile, sketch: ops })
    }, 600)
    return () => clearTimeout(timer)
  }, [ops, profile, onProfileChange])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return [Math.round(((e.clientX - box.left) / box.width) * W), Math.round(((e.clientY - box.top) / box.height) * H)] as const
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setCleared(null)
    const [x, y] = point(e)
    if (tool === 'sfondo') {
      // Lo sfondo va sotto a tutto (uno solo)
      const fill: Op = { kind: 'fill', color }
      setOps((o) => [fill, ...o.filter((op) => op.kind !== 'fill')])
      if (sound) melody([0, 4], 90)
      return
    }
    if (tool === 'timbro') {
      const op: Op = { kind: 'stamp', shape: stamp, color, size: SIZES[size] * 1.6 + 14, mirror, x, y }
      drawOp(ctx, op)
      setOps((o) => [...o, op])
      if (sound) tone(STAMPS.indexOf(stamp) * 2, 0.08)
      return
    }
    if (tool === 'stelline') {
      live.current = { kind: 'stars', mirror, stars: [] }
      lastStar.current = null
      addStar(x, y)
      return
    }
    const op: Op = { kind: 'stroke', tool, color: tool === 'gomma' ? ERASER : color, size: tool === 'gomma' ? SIZES[size] * 1.8 : SIZES[size], mirror, hue: Math.floor(rand() * 360), pts: [x, y] }
    live.current = op
    drawOp(ctx, op)
  }

  const addStar = (x: number, y: number) => {
    const op = live.current
    const ctx = canvasRef.current?.getContext('2d')
    if (!op || op.kind !== 'stars' || !ctx) return
    const last = lastStar.current
    if (last && Math.hypot(x - last[0], y - last[1]) < 22 + SIZES[size]) return
    lastStar.current = [x, y]
    const star: Star = { x: x + (rand() - 0.5) * 16, y: y + (rand() - 0.5) * 16, r: 8 + SIZES[size] * 0.6 + rand() * 6, rot: rand() * Math.PI, color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)] }
    op.stars.push(star)
    drawStars(ctx, op.mirror, [star])
    if (sound) tone(Math.floor(rand() * 8), 0.04, 0.2)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const op = live.current
    if (!op) return
    const [x, y] = point(e)
    if (op.kind === 'stars') return addStar(x, y)
    if (op.kind !== 'stroke') return
    const n = op.pts.length
    if (Math.hypot(x - op.pts[n - 2], y - op.pts[n - 1]) < 3) return
    op.pts.push(x, y)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawSegment(ctx, op, op.pts.length - 2)
  }

  const up = () => {
    const op = live.current
    live.current = null
    if (op) setOps((o) => [...o, op])
  }

  // Ultimo disegno salvato nell'album (stesso elenco di tratti = già salvato)
  const savedOps = useRef<Op[] | null>(null)

  const undo = () => {
    if (!ops.length && cleared) {
      setOps(cleared)
      setCleared(null)
      return
    }
    setOps((o) => o.slice(0, -1))
  }
  const fresh = () => {
    if (!ops.length) return
    setCleared(ops)
    setOps([])
    if (sound) melody([7, 4, 0], 90)
  }

  const finish = async (share: boolean) => {
    const canvas = canvasRef.current
    if (!canvas || !ops.length) return actions.toast(t('drawEmpty'))
    // Stesso disegno già messo nell'album: niente copia doppia e niente stella in più
    if (!share && savedOps.current === ops) return actions.toast(t('savedToAlbum'))
    try {
      const png = await actions.makeCanvasPng(canvas, t('drawings.disegno'))
      if (share) actions.openShare({ drawingId: 'disegno', title: t('drawings.disegno'), png })
      else {
        savedOps.current = ops
        await actions.saveToAlbum({ drawingId: 'disegno', png })
        onProfileChange({ ...profile, stars: profile.stars + 1, sketch: ops })
        if (sound) melody([0, 2, 4, 7, 11], 110)
      }
    } catch {
      actions.toast(t('exportError'))
    }
  }

  const tools: { id: Tool; icon: typeof Brush }[] = [
    { id: 'pennello', icon: Brush },
    { id: 'arcobaleno', icon: Rainbow },
    { id: 'stelline', icon: Sparkles },
    { id: 'timbro', icon: Stamp },
    { id: 'gomma', icon: Eraser },
    { id: 'sfondo', icon: PaintBucket },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-[140px] flex-1 items-center justify-center [container-type:size]">
        <div className="relative mx-auto aspect-[400/440] w-[min(calc(100cqw-6px),calc((100cqh-6px)*0.909))] overflow-hidden rounded-[22px] border-[3px] border-[#2B2D52] bg-white shadow-[5px_5px_0_#2B2D52]">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            className="block h-full w-full touch-none"
            aria-label={t('drawings.disegno')}
          />
          {mirror > 0 && (
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute inset-y-0 left-1/2 border-l-2 border-dashed border-[#2B2D52]/20" />
              {mirror === 2 && <div className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-[#2B2D52]/20" />}
            </div>
          )}
        </div>
      </div>

      {/* Pennelli magici */}
      <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t('drawTools')}>
        {tools.map(({ id, icon: Icon }) => (
          <KidsIconButton key={id} label={t(`drawTool.${id}`)} active={tool === id} onClick={() => setTool(id)}>
            <Icon className="h-6 w-6" />
          </KidsIconButton>
        ))}
        <KidsIconButton label={t(`drawMirror.${mirror}`)} active={mirror > 0} onClick={() => setMirror((m) => ((m + 1) % 3) as Mirror)}>
          <span className="relative">
            <FlipHorizontal2 className="h-6 w-6" />
            {mirror > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-[#2B2D52] px-1 text-[10px] font-extrabold text-white">{mirror === 1 ? 2 : 4}</span>}
          </span>
        </KidsIconButton>
      </div>

      {/* Timbri */}
      {tool === 'timbro' && (
        <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t('drawStamps')}>
          {STAMPS.map((s) => (
            <KidsIconButton key={s} label={t(`stamps.${s}`)} active={stamp === s} onClick={() => setStamp(s)}>
              <StampIcon shape={s} color={color} />
            </KidsIconButton>
          ))}
        </div>
      )}

      {/* Colori e dimensioni */}
      <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t('colorsLabel')}>
        {palette.map((c, i) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              setColorIndex(i)
              if (tool === 'gomma') setTool('pennello')
              if (sound) tone(i, 0.06)
            }}
            aria-label={t(`colors.${c.key}`)}
            aria-pressed={colorIndex === i}
            className={`h-10 w-10 rounded-full border-[3px] border-[#2B2D52] transition-transform sm:h-11 sm:w-11 ${colorIndex === i ? 'scale-110 ring-4 ring-[#2B2D52] ring-offset-2' : ''}`}
            style={{ background: c.hex }}
          />
        ))}
        <div className="flex items-center gap-1 rounded-full border-[3px] border-[#2B2D52] bg-white px-2 py-1" role="group" aria-label={t('drawSize')}>
          {SIZES.map((s, i) => (
            <button key={s} type="button" onClick={() => setSize(i)} aria-label={t(`drawSizes.${i}`)} aria-pressed={size === i} className={`flex h-9 w-9 items-center justify-center rounded-full ${size === i ? 'bg-[#FFC93C]' : ''}`}>
              <span className="rounded-full bg-[#2B2D52]" style={{ width: 6 + i * 6, height: 6 + i * 6 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Azioni */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <KidsButton onClick={undo} disabled={!ops.length && !cleared}>
          <Undo2 className="h-5 w-5" /> {t('undo')}
        </KidsButton>
        <KidsButton onClick={fresh} disabled={!ops.length}>
          <Broom className="h-5 w-5" /> {t('clean')}
        </KidsButton>
        <KidsButton onClick={() => void finish(false)} accent>
          <Check className="h-5 w-5" /> {t('drawDone')}
        </KidsButton>
        <KidsButton onClick={() => void finish(true)} label={t('saveShare')} disabled={!ops.length}>
          <Share2 className="h-5 w-5" />
        </KidsButton>
      </div>
    </div>
  )
}

// Anteprima del timbro sul pulsante
function StampIcon({ shape, color }: { shape: StampShape; color: string }) {
  return (
    <canvas
      width={44}
      height={44}
      className="h-8 w-8"
      ref={(el) => {
        const ctx = el?.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, 44, 44)
        ctx.save()
        ctx.scale(0.5, 0.5)
        drawStamp(ctx, shape, 44, 44, 34, color)
        ctx.restore()
      }}
    />
  )
}

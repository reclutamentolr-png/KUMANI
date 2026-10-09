'use client'

import { useEffect, useRef } from 'react'

// Effetto all'apertura del regalo: coriandoli, cuori, neve o stelle su un
// canvas sopra la pagina, per qualche secondo. Niente effetto per chi ha
// chiesto meno movimento nelle impostazioni del telefono.
type Kind = 'confetti' | 'hearts' | 'snow' | 'stars'

type P = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; color: string; life: number }

const COLORS: Record<Kind, string[]> = {
  confetti: ['#f5c542', '#e0567f', '#3b8be0', '#2fa36b', '#8b6cf0', '#ffffff'],
  hearts: ['#e0567f', '#ff8fab', '#ffffff', '#c9184a'],
  snow: ['#ffffff', '#e8f4ff', '#cfe8ff'],
  stars: ['#f5c542', '#ffe08a', '#ffffff'],
}

function heart(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  ctx.moveTo(0, r * 0.35)
  ctx.bezierCurveTo(-r, -r * 0.4, -r * 0.5, -r * 1.1, 0, -r * 0.45)
  ctx.bezierCurveTo(r * 0.5, -r * 1.1, r, -r * 0.4, 0, r * 0.35)
  ctx.fill()
}

function star(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

export default function Celebration({ kind, trigger }: { kind: Kind; trigger: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!trigger) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      el.width = window.innerWidth * dpr
      el.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const w = window.innerWidth
    const h = window.innerHeight
    const colors = COLORS[kind]
    const count = kind === 'snow' ? 90 : 140
    const parts: P[] = Array.from({ length: count }, () => {
      const fromTop = kind === 'snow'
      return {
        x: fromTop ? Math.random() * w : w / 2 + (Math.random() - 0.5) * 60,
        y: fromTop ? -20 - Math.random() * h * 0.5 : h * 0.45,
        vx: fromTop ? (Math.random() - 0.5) * 0.6 : (Math.random() - 0.5) * 12,
        vy: fromTop ? 1 + Math.random() * 1.5 : -6 - Math.random() * 9,
        r: kind === 'snow' ? 2 + Math.random() * 3 : kind === 'confetti' ? 4 + Math.random() * 4 : 6 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.25,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      }
    })
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        if (kind === 'snow') {
          p.x += p.vx + Math.sin(t * 2 + p.r) * 0.4
          p.y += p.vy
        } else {
          p.vy += 0.25
          p.vx *= 0.985
          p.x += p.vx
          p.y += p.vy
        }
        p.rot += p.vr
        p.life = Math.max(0, 1 - t / 4.5)
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        if (kind === 'hearts') heart(ctx, p.r)
        else if (kind === 'stars') star(ctx, p.r)
        else if (kind === 'snow') {
          ctx.beginPath()
          ctx.arc(0, 0, p.r, 0, Math.PI * 2)
          ctx.fill()
        } else ctx.fillRect(-p.r / 2, -p.r, p.r, p.r * 2)
        ctx.restore()
      }
      if (t < 4.6) frame = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, w, h)
    }
    frame = requestAnimationFrame(tick)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [kind, trigger])

  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-50 h-full w-full" />
}

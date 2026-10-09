'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'
import type { RevealStyle } from '@/lib/surprise'

// Il momento dell'apertura: scatola che si apre, busta con la lettera che
// esce, oppure carta da grattare col dito. Con «meno movimento» si apre
// subito, senza animazione.

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function GiftBox({ accent, Icon, onOpen }: { accent: string; Icon: LucideIcon; onOpen: () => void }) {
  const t = useTranslations('surprise')
  const [opening, setOpening] = useState(false)
  const open = () => {
    if (opening) return
    if (reduced()) return onOpen()
    setOpening(true)
    setTimeout(onOpen, 750)
  }
  return (
    <button type="button" onClick={open} className="group mx-auto flex cursor-pointer flex-col items-center focus:outline-none" aria-label={t('openGift')}>
      <span className="relative block h-48 w-48">
        {/* Bagliore */}
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full blur-2xl transition-opacity duration-700 ${opening ? 'opacity-90' : 'opacity-40 group-hover:opacity-60'}`}
          style={{ background: accent }}
        />
        {/* Scatola */}
        <span className="absolute inset-x-4 bottom-0 top-16 rounded-2xl shadow-2xl" style={{ background: `linear-gradient(160deg, ${accent}, ${accent}aa)` }}>
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-6 -translate-x-1/2 bg-white/80" />
          <span aria-hidden className="absolute inset-0 flex items-center justify-center">
            <Icon className={`h-12 w-12 text-white drop-shadow transition-all duration-500 ${opening ? 'scale-125 opacity-0' : ''}`} />
          </span>
        </span>
        {/* Coperchio */}
        <span
          aria-hidden
          className="absolute inset-x-1 top-9 h-10 rounded-xl shadow-lg transition-all duration-700 ease-out motion-safe:group-hover:-translate-y-1"
          style={{
            background: `linear-gradient(160deg, ${accent}, ${accent}cc)`,
            transform: opening ? 'translateY(-90px) rotate(-22deg)' : undefined,
            opacity: opening ? 0 : 1,
          }}
        >
          <span className="absolute inset-y-0 left-1/2 w-6 -translate-x-1/2 bg-white/90" />
          <span className="absolute -top-7 left-1/2 h-8 w-16 -translate-x-1/2 rounded-full border-[6px] border-white/90 border-b-transparent" />
        </span>
      </span>
      <span className="mt-8 min-h-12 rounded-full bg-white px-8 py-3 text-lg font-bold shadow-lg transition-transform group-active:scale-95" style={{ color: accent }}>
        {t('openGift')}
      </span>
    </button>
  )
}

function Envelope({ accent, name, onOpen }: { accent: string; name: string; onOpen: () => void }) {
  const t = useTranslations('surprise')
  const [opening, setOpening] = useState(false)
  const open = () => {
    if (opening) return
    if (reduced()) return onOpen()
    setOpening(true)
    setTimeout(onOpen, 1200)
  }
  return (
    <button type="button" onClick={open} className="group mx-auto flex cursor-pointer flex-col items-center focus:outline-none" aria-label={t('openLetter')}>
      <span className="relative block h-44 w-72" style={{ perspective: '800px' }}>
        {/* Lettera che esce */}
        <span
          aria-hidden
          className="absolute inset-x-5 top-4 bottom-4 rounded-lg bg-[#fffdf7] p-4 text-center shadow transition-transform duration-700 ease-out"
          style={{ transform: opening ? 'translateY(-70%)' : 'translateY(0)', transitionDelay: opening ? '450ms' : '0ms' }}
        >
          <span className="font-[family-name:var(--font-letter)] text-2xl italic" style={{ color: accent }}>
            {name}
          </span>
        </span>
        {/* Busta */}
        <span aria-hidden className="absolute inset-0 rounded-xl shadow-2xl" style={{ background: `linear-gradient(160deg, ${accent}, ${accent}bb)` }} />
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl"
          style={{ background: `linear-gradient(20deg, transparent 49.5%, ${accent}ee 50%), linear-gradient(-20deg, transparent 49.5%, ${accent}ee 50%)` }}
        />
        {/* Linguetta */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1/2 origin-top transition-transform duration-500 ease-in-out"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            background: `linear-gradient(180deg, ${accent}, ${accent}dd)`,
            transform: opening ? 'rotateX(180deg)' : 'rotateX(0)',
            zIndex: opening ? 0 : 2,
          }}
        />
        {/* Sigillo */}
        <span
          aria-hidden
          className={`absolute left-1/2 top-1/2 z-10 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70 bg-white/30 shadow transition-opacity duration-300 ${opening ? 'opacity-0' : ''}`}
        />
      </span>
      <span className="mt-8 min-h-12 rounded-full bg-white px-8 py-3 text-lg font-bold shadow-lg transition-transform group-active:scale-95" style={{ color: accent }}>
        {t('openLetter')}
      </span>
    </button>
  )
}

function ScratchCard({ accent, Icon, onOpen }: { accent: string; Icon: LucideIcon; onOpen: () => void }) {
  const t = useTranslations('surprise')
  const canvas = useRef<HTMLCanvasElement>(null)
  const [done, setDone] = useState(false)
  const drawing = useRef(false)
  const moves = useRef(0)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const rect = el.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    el.width = rect.width * dpr
    el.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height)
    grad.addColorStop(0, '#d9d9d9')
    grad.addColorStop(0.5, '#f4f4f4')
    grad.addColorStop(1, '#bdbdbd')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.fillStyle = '#7a7a7a'
    ctx.font = '600 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(t('scratchHere'), rect.width / 2, rect.height / 2 + 6)
  }, [t])

  const finish = () => {
    if (done) return
    setDone(true)
    setTimeout(onOpen, reduced() ? 0 : 500)
  }

  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || done) return
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const rect = el.getBoundingClientRect()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 22, 0, Math.PI * 2)
    ctx.fill()
    // Ogni tanto: quanto è stato grattato?
    if (++moves.current % 12 === 0) {
      const data = ctx.getImageData(0, 0, el.width, el.height).data
      let clear = 0
      for (let i = 3; i < data.length; i += 64) if (data[i] === 0) clear++
      if (clear / (data.length / 64) > 0.5) finish()
    }
  }

  return (
    <div className="mx-auto flex flex-col items-center">
      <div className="relative h-48 w-72 overflow-hidden rounded-2xl shadow-2xl" style={{ background: `linear-gradient(160deg, ${accent}, ${accent}aa)` }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <Icon className="h-14 w-14 drop-shadow" />
          <p className="mt-2 font-[family-name:var(--font-letter)] text-2xl italic">{t('scratchUnder')}</p>
        </div>
        <canvas
          ref={canvas}
          aria-hidden
          className={`absolute inset-0 h-full w-full touch-none cursor-pointer transition-opacity duration-500 ${done ? 'opacity-0' : ''}`}
          onPointerDown={(e) => {
            drawing.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            scratch(e)
          }}
          onPointerMove={scratch}
          onPointerUp={() => (drawing.current = false)}
        />
      </div>
      <p className="mt-6 text-sm text-white/80">{t('scratchHint')}</p>
      <button type="button" onClick={finish} className="mt-2 min-h-11 cursor-pointer rounded-full px-5 py-2 text-sm font-semibold text-white underline underline-offset-4">
        {t('scratchSkip')}
      </button>
    </div>
  )
}

export default function Reveal({ style, accent, Icon, name, onOpen }: { style: RevealStyle; accent: string; Icon: LucideIcon; name: string; onOpen: () => void }) {
  if (style === 'envelope') return <Envelope accent={accent} name={name} onOpen={onOpen} />
  if (style === 'scratch') return <ScratchCard accent={accent} Icon={Icon} onOpen={onOpen} />
  return <GiftBox accent={accent} Icon={Icon} onOpen={onOpen} />
}

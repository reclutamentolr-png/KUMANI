'use client'

import { forwardRef } from 'react'
import localFont from 'next/font/local'
import type { LucideIcon } from 'lucide-react'

// Immagine per i social (Documenti → Immagini per i social): sempre sfondo
// nero, logo KUMANI oro e scritte oro e bianche. Post 1080×1080 o storia
// 1080×1920; la disegna il browser (niente file su Supabase) e SocialStudio
// la trasforma in PNG.
const inter = localFont({ src: '../../fonts/Inter.woff2', weight: '100 900' })
const playfair = localFont({ src: '../../fonts/PlayfairDisplay.woff2', weight: '400 900' })

export type SocialFormat = 'post' | 'story'
export const SOCIAL_SIZE: Record<SocialFormat, { w: number; h: number }> = { post: { w: 1080, h: 1080 }, story: { w: 1080, h: 1920 } }

export type SocialContent = {
  Icon: LucideIcon
  eyebrow: string
  title: string
  gold: string
  sub: string
  points: { Icon: LucideIcon; text: string }[]
  // Tema stagionale: 'halloween' = notte viola e arancio, luna e pipistrelli
  theme?: 'halloween'
}

const GOLD = '#d4af37'
const GOLD2 = '#f1d78a'
const GOLD_TEXT = { background: 'linear-gradient(180deg,#f6dd8a 0%,#d4af37 55%,#a87f22 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } as const

const SocialCanvas = forwardRef<HTMLDivElement, { format: SocialFormat; content: SocialContent; footer: string; logoUrl: string }>(function SocialCanvas(
  { format, content: c, footer, logoUrl },
  ref
) {
  const story = format === 'story'
  const { w, h } = SOCIAL_SIZE[format]
  const hw = c.theme === 'halloween'
  const ORANGE_TEXT = { background: 'linear-gradient(180deg,#ffd27a 0%,#ff8a1f 55%,#d9480f 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } as const
  // Pipistrello stilizzato (posizione in %, misura in px)
  const bat = (left: number, top: number, size: number, rot: number) => (
    <svg key={`${left}-${top}`} viewBox="0 0 64 32" width={size} height={size / 2} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, transform: `rotate(${rot}deg)`, opacity: 0.85 }}>
      <path fill="#0b0a08" d="M32 10c2-4 4-6 4-6s0 4 2 6c4-3 10-4 14-2-2 1-3 4-2 7 3-1 7 0 10 3-5 0-9 2-12 6-2-3-6-4-9-3-2 1-4 4-7 7-3-3-5-6-7-7-3-1-7 0-9 3-3-4-7-6-12-6 3-3 7-4 10-3 1-3 0-6-2-7 4-2 10-1 14 2 2-2 2-6 2-6s2 2 4 6z" />
    </svg>
  )
  return (
    <div
      ref={ref}
      className={inter.className}
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        width: w,
        height: h,
        overflow: 'hidden',
        color: '#fff',
        background: hw
          ? 'radial-gradient(circle at 78% 16%, #ffcf6b 0%, #ff8a1f 9%, rgba(255,120,30,0.35) 17%, transparent 30%), radial-gradient(ellipse at 50% 110%, rgba(255,110,20,0.35) 0%, transparent 55%), linear-gradient(180deg,#1b0b2e 0%,#2a0f3d 45%,#0b0a08 100%)'
          : 'radial-gradient(ellipse at 50% 18%, rgba(212,175,55,0.22) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(212,175,55,0.16) 0%, transparent 50%), #0b0a08',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: story ? '150px 90px 130px' : '70px 80px 60px',
      }}
    >
      {/* Cornice sottile (arancio ad Halloween) */}
      <div style={{ position: 'absolute', inset: 28, border: `2px solid ${hw ? 'rgba(255,138,31,0.55)' : 'rgba(212,175,55,0.45)'}`, borderRadius: 36, pointerEvents: 'none' }} />
      {hw && [bat(8, story ? 9 : 12, story ? 120 : 96, -12), bat(70, story ? 22 : 30, story ? 90 : 70, 10), bat(story ? 14 : 6, story ? 30 : 24, story ? 70 : 54, 6)]}

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" width={story ? 110 : 84} height={story ? 110 : 84} style={{ width: story ? 110 : 84, height: story ? 110 : 84, objectFit: 'contain' }} />
        <span className={playfair.className} style={{ fontSize: story ? 58 : 44, fontWeight: 800, letterSpacing: '0.18em', ...GOLD_TEXT }}>
          KUMANI
        </span>
      </div>

      {/* Contenuto al centro */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <div
          style={{
            width: story ? 150 : 112,
            height: story ? 150 : 112,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: hw ? 'linear-gradient(180deg,#ffd27a,#ff7a1a)' : 'linear-gradient(180deg,#f6dd8a,#c39327)',
            boxShadow: hw ? '0 0 70px rgba(255,122,26,0.6)' : '0 0 60px rgba(212,175,55,0.45)',
          }}
        >
          <c.Icon size={story ? 74 : 56} color="#171717" strokeWidth={1.9} />
        </div>
        <div
          style={{
            marginTop: story ? 50 : 30,
            padding: '10px 26px',
            borderRadius: 999,
            border: '2px solid rgba(212,175,55,0.55)',
            color: GOLD2,
            fontSize: story ? 30 : 24,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          {c.eyebrow}
        </div>
        <div style={{ marginTop: story ? 40 : 26, fontSize: story ? 96 : 74, fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.02em' }}>{c.title}</div>
        {c.gold && <div style={{ marginTop: 8, fontSize: story ? (hw ? 84 : 96) : hw ? 62 : 74, fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.02em', ...(hw ? ORANGE_TEXT : GOLD_TEXT) }}>{c.gold}</div>}
        {c.sub && (
          <div style={{ marginTop: story ? 40 : 24, fontSize: story ? 42 : 32, lineHeight: 1.3, color: 'rgba(255,255,255,0.82)', maxWidth: story ? 860 : 860 }}>{c.sub}</div>
        )}
        {c.points.length > 0 && (
          <div style={{ marginTop: story ? 70 : 34, display: 'flex', flexDirection: story ? 'column' : 'row', gap: story ? 26 : 18, width: '100%', justifyContent: 'center' }}>
            {c.points.map((p, i) => (
              <div
                key={i}
                style={{
                  flex: story ? undefined : 1,
                  display: 'flex',
                  flexDirection: story ? 'row' : 'column',
                  alignItems: 'center',
                  gap: story ? 24 : 12,
                  padding: story ? '22px 30px' : '20px 14px',
                  borderRadius: 24,
                  background: 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${hw ? 'rgba(255,138,31,0.5)' : 'rgba(212,175,55,0.35)'}`,
                  textAlign: story ? 'left' : 'center',
                  boxSizing: 'border-box',
                  minWidth: 0,
                }}
              >
                <p.Icon size={story ? 46 : 36} color={hw ? '#ff9a3c' : GOLD} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: story ? 36 : 24, fontWeight: 700, lineHeight: 1.2 }}>{p.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In basso: il link (d'invito del Kumano o kumani.io) */}
      <div
        style={{
          padding: story ? '22px 54px' : '16px 42px',
          borderRadius: 999,
          background: hw ? 'linear-gradient(90deg,#ff7a1a,#ffc15e)' : 'linear-gradient(90deg,#d4af37,#f1d78a)',
          color: '#171717',
          fontSize: story ? 44 : 34,
          fontWeight: 800,
          boxShadow: '0 0 50px rgba(212,175,55,0.4)',
        }}
      >
        {footer}
      </div>
    </div>
  )
})

export default SocialCanvas

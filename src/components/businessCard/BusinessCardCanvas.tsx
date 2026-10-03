'use client'

import { forwardRef, type CSSProperties } from 'react'
import { Inter, Playfair_Display } from 'next/font/google'

// Biglietto da visita KUMANI: 85×55 mm (1050×680 px) più 3 mm di margine di
// taglio per lato (37 px), quindi 1124×754 px in tutto. Il contenuto resta
// dentro l'area sicura; lo sfondo nero arriva fino al bordo del margine.

const inter = Inter({ subsets: ['latin', 'cyrillic'], weight: ['400', '600', '700'] })
const playfair = Playfair_Display({ subsets: ['latin', 'cyrillic'], weight: ['600', '700'] })

export const CARD_W = 1050
export const CARD_H = 680
export const BLEED = 37
export const FULL_W = CARD_W + BLEED * 2
export const FULL_H = CARD_H + BLEED * 2

export type CardDesign = 'A' | 'B' | 'C'
export type CardSide = 'front' | 'back'

export type CardTexts = {
  tagline: string
  scanMe: string
  scanContacts: string
  scanTitle: string
  scanText: string
}

type Props = { design: CardDesign; side: CardSide; texts: CardTexts; qrSvg: string; logoUrl: string }

const GOLD = '#e3c06a'
const goldLine = 'linear-gradient(90deg,#9c7a2f,#f1d78a,#9c7a2f)'

function Qr({ svg, size, background, padding, radius, ring }: { svg: string; size: number; background: string; padding: number; radius: number; ring?: boolean }) {
  return (
    <div style={{ background, padding, borderRadius: radius, boxShadow: ring ? '0 0 0 4px #c79a3b' : undefined, lineHeight: 0 }}>
      <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg.replace('<svg', `<svg width="${size}" height="${size}"`) }} />
    </div>
  )
}

const BusinessCardCanvas = forwardRef<HTMLDivElement, Props>(function BusinessCardCanvas({ design, side, texts, qrSvg, logoUrl }, ref) {
  const root: CSSProperties = {
    width: FULL_W,
    height: FULL_H,
    position: 'relative',
    overflow: 'hidden',
    color: '#fff',
    background: design === 'B' ? 'radial-gradient(circle at 50% 35%,#222 0%,#0b0b0b 70%)' : '#0d0d0d',
  }
  const card: CSSProperties = { position: 'absolute', left: BLEED, top: BLEED, width: CARD_W, height: CARD_H }
  const serif = playfair.style.fontFamily

  let content: React.ReactNode = null
  if (design === 'A') {
    content = (
      <>
        <div style={{ position: 'absolute', inset: 40, border: '2px solid #c79a3b', borderRadius: 22 }} />
        <div style={{ position: 'absolute', left: 80, top: 0, bottom: 0, width: 460, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="KUMANI" style={{ width: 320 }} />
          <div style={{ marginTop: 22, fontFamily: serif, fontSize: 28, letterSpacing: 2, color: GOLD, textAlign: 'center' }}>{texts.tagline}</div>
        </div>
        <div style={{ position: 'absolute', right: 95, top: '50%', transform: 'translateY(-50%)', textAlign: 'center' }}>
          <Qr svg={qrSvg} size={290} background="#fff" padding={18} radius={22} ring />
          <div style={{ marginTop: 18, fontSize: 22, fontWeight: 600, letterSpacing: 3, color: GOLD }}>{texts.scanMe}</div>
        </div>
      </>
    )
  } else if (design === 'B') {
    content = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="KUMANI" style={{ position: 'absolute', left: '50%', top: 42, transform: 'translateX(-50%)', width: 190 }} />
        <div style={{ position: 'absolute', left: '50%', top: 252, transform: 'translateX(-50%)' }}>
          <Qr svg={qrSvg} size={262} background="#e8c872" padding={14} radius={20} />
        </div>
        <div style={{ position: 'absolute', left: 64, bottom: 60, fontSize: 20, letterSpacing: 4, color: '#bbb', textTransform: 'uppercase' }}>{texts.scanContacts}</div>
        <div style={{ position: 'absolute', right: 64, bottom: 56, fontFamily: serif, fontSize: 26, color: GOLD }}>kumani.io</div>
      </>
    )
  } else if (side === 'front') {
    content = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 40, border: '1px solid rgba(199,154,59,.6)', borderRadius: 18 }} />
        <div style={{ position: 'absolute', inset: 52, border: '1px solid rgba(199,154,59,.3)', borderRadius: 12 }} />
        <div style={{ textAlign: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="KUMANI" style={{ width: 380 }} />
          <div style={{ marginTop: 20, fontFamily: serif, fontSize: 30, letterSpacing: 3, color: GOLD }}>{texts.tagline}</div>
        </div>
      </div>
    )
  } else {
    content = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 64 }}>
        <Qr svg={qrSvg} size={350} background="#fff" padding={20} radius={24} />
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontFamily: serif, fontSize: 44, lineHeight: 1.1, color: GOLD }}>{texts.scanTitle}</div>
          <div style={{ marginTop: 16, fontSize: 24, lineHeight: 1.45, color: '#ddd' }}>{texts.scanText}</div>
          <div style={{ marginTop: 26, height: 4, width: 120, borderRadius: 2, background: goldLine }} />
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className={inter.className} style={root}>
      {design === 'B' && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: BLEED + 12, background: goldLine }} />}
      <div style={card}>{content}</div>
    </div>
  )
})

export default BusinessCardCanvas

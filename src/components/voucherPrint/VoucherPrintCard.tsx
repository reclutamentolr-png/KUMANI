'use client'

import { forwardRef, type CSSProperties, type ReactNode } from 'react'
import { Cinzel, Cormorant_Garamond, IBM_Plex_Mono, Inter } from 'next/font/google'

// Voucher KUMANI da stampare: tre grafiche (A Classico, B Minimal,
// C Premium), fronte nero con il logo oro e retro con frase, codice e QR.
// Due formati: biglietto da visita 85×55 mm e cartolina A6 148×105 mm, più
// 3 mm di abbondanza per lato (lo sfondo arriva fino al bordo, i testi
// restano nell'area sicura). Le misure sono pensate in mm sul biglietto e
// scalate in proporzione per la cartolina.
//
// Con `blank` il retro esce senza codice e senza QR (restano gli spazi,
// segnati con data-slot): è il modello che il PDF usa una volta sola, poi
// codice e QR vengono disegnati sopra per ogni voucher.

const cinzel = Cinzel({ subsets: ['latin'], weight: ['500', '700'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin', 'cyrillic'], weight: ['500', '600'], style: ['normal', 'italic'] })
const mono = IBM_Plex_Mono({ subsets: ['latin', 'cyrillic'], weight: ['600'] })
const inter = Inter({ subsets: ['latin', 'cyrillic'], weight: ['400', '600', '700'] })

export type VoucherDesign = 'A' | 'B' | 'C'
export type VoucherFormat = 'card' | 'postcard'
export type VoucherSide = 'front' | 'back'

export const PX_PER_MM = 1050 / 85
export const BLEED_MM = 3
export const FORMATS: Record<VoucherFormat, { w: number; h: number }> = {
  card: { w: 85, h: 55 },
  postcard: { w: 148, h: 105 },
}

export function formatPx(format: VoucherFormat) {
  const { w, h } = FORMATS[format]
  const bleed = Math.round(BLEED_MM * PX_PER_MM)
  const trimW = Math.round(w * PX_PER_MM)
  const trimH = Math.round(h * PX_PER_MM)
  return { trimW, trimH, bleed, fullW: trimW + bleed * 2, fullH: trimH + bleed * 2 }
}

export type VoucherPrintTexts = {
  voucher: string
  gift: string
  oneYear: string
  planLine: string
  codeLabel: string
  codeShort: string
  howToLong: string
  howToShort: string
  scan: string
}

type Props = {
  design: VoucherDesign
  format: VoucherFormat
  side: VoucherSide
  plan: 'base' | 'pro'
  phrase: string
  offeredBy?: string
  code: string
  qrSvg: string
  texts: VoucherPrintTexts
  blank?: boolean
}

const LOGO = '/brand/logo-gold-hd.png'
const BLACK = '#0b0b0b'
const GOLD = '#d9b25a'
const GOLD_BRIGHT = '#e7c56a'
const GOLD_PALE = '#f5e8bd'
const GOLD_GRADIENT = 'linear-gradient(135deg,#b8862f 0%,#e7c56a 38%,#f5e8bd 52%,#d4a648 70%,#a97a28 100%)'

const VoucherPrintCard = forwardRef<HTMLDivElement, Props>(function VoucherPrintCard(props, ref) {
  const { design, format, side } = props
  const { trimW, trimH, bleed, fullW, fullH } = formatPx(format)
  // mm del biglietto → px nel formato scelto
  const k = FORMATS[format].h / 55
  const m = (mm: number) => mm * PX_PER_MM * k

  const background =
    side === 'front'
      ? design === 'A'
        ? `radial-gradient(circle at 50% 45%, #1c1a15 0%, ${BLACK} 70%)`
        : BLACK
      : design === 'C'
        ? GOLD_GRADIENT
        : BLACK

  const root: CSSProperties = {
    width: fullW,
    height: fullH,
    position: 'relative',
    overflow: 'hidden',
    background,
    fontFamily: inter.style.fontFamily,
    color: GOLD,
  }
  const trim: CSSProperties = { position: 'absolute', left: bleed, top: bleed, width: trimW, height: trimH }

  const ctx = { ...props, m }
  let content: ReactNode
  if (design === 'A') content = side === 'front' ? <FrontA {...ctx} /> : <BackA {...ctx} />
  else if (design === 'B') content = side === 'front' ? <FrontB {...ctx} /> : <BackB {...ctx} />
  else content = side === 'front' ? <FrontC {...ctx} /> : <BackC {...ctx} />

  return (
    <div ref={ref} style={root}>
      {design === 'C' && side === 'front' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `repeating-radial-gradient(circle at 50% 50%, rgba(199,154,59,.16) 0 ${m(0.25)}px, transparent ${m(0.25)}px ${m(3.2)}px)`,
          }}
        />
      )}
      <div style={trim}>{content}</div>
    </div>
  )
})

export default VoucherPrintCard

type Ctx = Props & { m: (mm: number) => number }

const planTag = (plan: 'base' | 'pro') => (plan === 'pro' ? 'PRO' : 'BASE')

function Logo({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO} alt="" width={size} height={size} style={{ width: size, height: size, display: 'block' }} />
}

function Code({ code, blank, style }: { code: string; blank?: boolean; style: CSSProperties }) {
  return (
    <div data-slot="code" style={{ ...style, fontFamily: mono.style.fontFamily, fontWeight: 600, whiteSpace: 'nowrap', visibility: blank ? 'hidden' : undefined }}>
      {code}
    </div>
  )
}

function Qr({ svg, size, blank }: { svg: string; size: number; blank?: boolean }) {
  return (
    <div
      data-slot="qr"
      style={{ width: size, height: size, lineHeight: 0, visibility: blank ? 'hidden' : undefined }}
      dangerouslySetInnerHTML={{ __html: svg.replace('<svg', `<svg width="${size}" height="${size}"`) }}
    />
  )
}

const caps = (m: Ctx['m'], size: number, spacing: number): CSSProperties => ({
  fontFamily: cormorant.style.fontFamily,
  fontWeight: 600,
  fontSize: m(size),
  letterSpacing: `${spacing}em`,
  textTransform: 'uppercase',
  lineHeight: 1.1,
})

// ---------- A · Classico
function FrontA({ m, plan, texts }: Ctx) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Logo size={m(33)} />
      <div style={{ ...caps(m, 2.9, 0.45), marginTop: m(3), paddingLeft: '0.45em', color: GOLD }}>
        {texts.voucher} · {planTag(plan)}
      </div>
    </div>
  )
}

function BackA({ m, phrase, offeredBy, code, qrSvg, texts, blank }: Ctx) {
  return (
    <div style={{ position: 'absolute', inset: m(3.2), border: `${m(0.25)}px solid #c79a3b`, padding: `${m(3.2)}px ${m(4)}px`, display: 'flex', gap: m(3.5), alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, marginBottom: m(2), fontFamily: cormorant.style.fontFamily, fontStyle: 'italic', fontWeight: 500, fontSize: m(3.9), lineHeight: 1.18, color: '#f1dfae' }}>
          “{phrase}”
        </p>
        <div style={{ ...caps(m, 2.5, 0.14), color: GOLD, marginBottom: m(1.6) }}>{texts.planLine}</div>
        <div style={{ fontSize: m(1.6), letterSpacing: '0.2em', textTransform: 'uppercase', color: '#a68a4d' }}>{texts.codeLabel}</div>
        <Code code={code} blank={blank} style={{ fontSize: m(3.7), letterSpacing: '0.06em', color: GOLD_BRIGHT, margin: `${m(0.3)}px 0 ${m(1.2)}px` }} />
        <div style={{ fontSize: m(1.65), color: '#a68a4d', lineHeight: 1.3 }}>
          {texts.howToLong}
          {offeredBy ? <span style={{ display: 'block', color: GOLD, marginTop: m(0.6) }}>{offeredBy}</span> : null}
        </div>
      </div>
      <div style={{ background: GOLD_PALE, padding: m(1.4), borderRadius: m(1.2), flex: 'none' }}>
        <Qr svg={qrSvg} size={m(16.2)} blank={blank} />
      </div>
    </div>
  )
}

// ---------- B · Minimal
function FrontB({ m, plan, texts }: Ctx) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', padding: `0 ${m(7)}px`, gap: m(5) }}>
      <Logo size={m(22)} />
      <div>
        <div style={{ fontFamily: cinzel.style.fontFamily, fontWeight: 700, fontSize: m(6), letterSpacing: '0.32em', color: '#e2bd63', lineHeight: 1.1 }}>KUMANI</div>
        <div style={{ height: m(0.3), width: m(36), margin: `${m(2)}px 0`, background: 'linear-gradient(90deg,#c79a3b,rgba(199,154,59,0))' }} />
        <div style={{ fontSize: m(2), letterSpacing: '0.3em', textTransform: 'uppercase', color: '#b8975a' }}>
          {texts.voucher} {plan === 'pro' ? 'PRO ' : ''}· {texts.oneYear}
        </div>
      </div>
    </div>
  )
}

function BackB({ m, phrase, offeredBy, code, qrSvg, texts, blank }: Ctx) {
  return (
    <div style={{ height: '100%', display: 'flex', gap: m(4), padding: `${m(5)}px ${m(5)}px ${m(5)}px ${m(6)}px` }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: m(3.05), lineHeight: 1.32, color: '#efe3c4', fontWeight: 600 }}>{phrase}</p>
          {offeredBy ? <p style={{ margin: `${m(1.2)}px 0 0`, fontSize: m(1.9), color: '#b8975a' }}>{offeredBy}</p> : null}
        </div>
        <div>
          <div style={{ fontSize: m(1.8), letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9b8456' }}>{texts.codeShort}</div>
          <Code code={code} blank={blank} style={{ fontSize: m(3.9), letterSpacing: '0.05em', color: GOLD_BRIGHT, margin: `${m(0.4)}px 0` }} />
          <div style={{ fontSize: m(1.9), color: '#9b8456', letterSpacing: '0.05em' }}>{texts.howToShort}</div>
        </div>
      </div>
      <div style={{ width: m(21), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
        {/* QR scuro su quadrato oro: leggibile da tutti i telefoni (oro su nero no) */}
        <div style={{ background: GOLD_BRIGHT, padding: m(1.3), borderRadius: m(1) }}>
          <Qr svg={qrSvg} size={m(18.4)} blank={blank} />
        </div>
        <div style={{ fontSize: m(1.7), color: '#9b8456', marginTop: m(1.2), letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center' }}>{texts.scan}</div>
      </div>
    </div>
  )
}

// ---------- C · Premium
function FrontC({ m, plan, texts }: Ctx) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: m(4),
          right: m(4),
          fontFamily: cinzel.style.fontFamily,
          fontWeight: 700,
          fontSize: m(2.3),
          letterSpacing: '0.25em',
          padding: `${m(0.9)}px ${m(2)}px ${m(0.9)}px ${m(2.6)}px`,
          color: BLACK,
          background: 'linear-gradient(135deg,#b8862f,#f5e8bd 50%,#c79a3b)',
          borderRadius: m(5),
          lineHeight: 1.2,
        }}
      >
        {planTag(plan)}
      </div>
      <Logo size={m(27)} />
      <div style={{ ...caps(m, 2.6, 0.4), marginTop: m(2.6), paddingLeft: '0.4em', color: GOLD_BRIGHT }}>{texts.gift}</div>
    </div>
  )
}

function BackC({ m, phrase, offeredBy, code, qrSvg, texts, blank }: Ctx) {
  return (
    <div style={{ height: '100%', display: 'flex', gap: m(4), padding: `${m(5)}px ${m(5)}px ${m(5)}px ${m(5.5)}px`, alignItems: 'center', color: '#111' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="" style={{ width: m(7), height: m(7), display: 'block', filter: 'brightness(0)', opacity: 0.85 }} />
        <p style={{ margin: `${m(1.6)}px 0 ${m(2.2)}px`, fontFamily: cormorant.style.fontFamily, fontStyle: 'italic', fontWeight: 600, fontSize: m(3.7), lineHeight: 1.18, color: '#121212' }}>
          {phrase}
        </p>
        <div style={{ display: 'inline-flex', flexDirection: 'column', background: BLACK, borderRadius: m(1.2), padding: `${m(1.2)}px ${m(2.4)}px` }}>
          <span style={{ fontSize: m(1.55), letterSpacing: '0.25em', textTransform: 'uppercase', color: '#b8975a' }}>{texts.codeShort}</span>
          <Code code={code} blank={blank} style={{ fontSize: m(3.6), letterSpacing: '0.05em', color: GOLD_BRIGHT }} />
        </div>
        <div style={{ fontSize: m(1.7), marginTop: m(1.5), color: '#2a2112' }}>
          {texts.howToShort}
          {offeredBy ? <span style={{ display: 'block', fontWeight: 600, marginTop: m(0.5) }}>{offeredBy}</span> : null}
        </div>
      </div>
      <Qr svg={qrSvg} size={m(20)} blank={blank} />
    </div>
  )
}

// Colore dei moduli del QR per grafica (lo sfondo è quello del modello)
export const QR_DARK: Record<VoucherDesign, string> = { A: BLACK, B: BLACK, C: BLACK }

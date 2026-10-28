'use client'

import { createContext, forwardRef, useContext, type CSSProperties, type ReactNode } from 'react'
import localFont from 'next/font/local'
import { AtSign, Globe, Mail, MapPin, Phone, Receipt, Smartphone } from 'lucide-react'
import { CONTACT_FIELDS, isVertical, type ClassicField, type ClassicSettings } from '@/lib/businessCardClassic'
import { BLEED, CARD_H, CARD_W } from './BusinessCardCanvas'

// Biglietto da visita classico: 85×55 mm come quello KUMANI (stessi pixel e
// stesso margine di taglio). Gli stili verticali sono lo stesso biglietto girato.

const inter = localFont({ src: '../../fonts/Inter.woff2', weight: '100 900' })
const playfair = localFont({ src: '../../fonts/PlayfairDisplay.woff2', weight: '400 900' })

export type CardColors = { bg: string; text: string; accent: string; muted: string; band: string; bandText: string }
export type ClassicTexts = { scanQr: string }
type Props = {
  settings: ClassicSettings
  side: 'front' | 'back'
  data: Partial<Record<ClassicField, string>>
  colors: CardColors
  qrSvg: string
  logoUrl: string | null
  texts: ClassicTexts
}

const ICONS: Partial<Record<ClassicField, typeof Phone>> = { phone: Phone, mobile: Smartphone, email: Mail, website: Globe, address: MapPin, vat: Receipt, social: AtSign }

export const classicSize = (s: ClassicSettings) => (isVertical(s.layout) ? { w: CARD_H, h: CARD_W } : { w: CARD_W, h: CARD_H })

function Qr({ svg, size }: { svg: string; size: number }) {
  // Sempre su bianco: si legge con qualunque colore del biglietto
  return (
    <div style={{ background: '#fff', padding: Math.round(size * 0.07), borderRadius: Math.round(size * 0.08), lineHeight: 0 }}>
      <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg.replace('<svg', `<svg width="${size}" height="${size}"`) }} />
    </div>
  )
}

// Grandezza del logo scelta (piccolo, medio, grande): vale per ogni stile
const LogoScale = createContext(1)
const LOGO_SCALE = { S: 0.7, M: 1, L: 1.35 } as const

function Logo({ url, maxW, maxH, tile }: { url: string | null; maxW: number; maxH: number; tile?: boolean }) {
  const k = useContext(LogoScale)
  if (!url) return null
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={url} alt="" crossOrigin="anonymous" style={{ maxWidth: maxW * k, maxHeight: maxH * k, objectFit: 'contain', display: 'block' }} />
  return tile ? <div style={{ background: '#fff', borderRadius: 18, padding: 14, lineHeight: 0 }}>{img}</div> : img
}

const ClassicCardCanvas = forwardRef<HTMLDivElement, Props>(function ClassicCardCanvas({ settings, side, data, colors, qrSvg, logoUrl, texts }, ref) {
  const { w, h } = classicSize(settings)
  const vertical = isVertical(settings.layout)
  const serif = playfair.style.fontFamily
  const on = (f: ClassicField) => settings.fields[f] && !!data[f]?.trim()
  const val = (f: ClassicField) => data[f]?.trim() ?? ''
  const contacts = CONTACT_FIELDS.filter(on)
  const qrFront = settings.qr === 'front' && !!qrSvg
  const qrBack = settings.qr === 'back' && !!qrSvg && settings.sides === 'both'

  const name = on('name') ? <div style={{ fontFamily: serif, fontSize: vertical ? 52 : 56, lineHeight: 1.08, fontWeight: 700, color: colors.text }}>{val('name')}</div> : null
  const role = on('role') ? <div style={{ marginTop: 10, fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: colors.accent }}>{val('role')}</div> : null
  const company = on('company') ? <div style={{ marginTop: 8, fontSize: 24, fontWeight: 500, color: colors.muted }}>{val('company')}</div> : null

  // Riga di contatto: icona nel colore d'accento e testo (più piccolo se lungo)
  const contactList = (opts: { align?: 'left' | 'center'; gap?: number; maxW?: number }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: opts.gap ?? 12, alignItems: opts.align === 'center' ? 'center' : 'flex-start' }}>
      {contacts.map((f) => {
        const Icon = ICONS[f]!
        const t = val(f)
        return (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: opts.maxW, color: colors.text }}>
            <Icon size={24} color={colors.accent} strokeWidth={2.2} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: t.length > 34 ? 21 : t.length > 26 ? 23 : 26, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>
          </div>
        )
      })}
    </div>
  )

  let content: ReactNode = null
  if (side === 'back') {
    // Retro: logo, QR, frase o tinta piena (con il QR in un angolo se va sul retro)
    const back = settings.back
    const bg = back === 'color' ? colors.band : colors.bg
    const fg = back === 'color' ? colors.bandText : colors.text
    content = (
      // Con il QR in basso al centro, logo e scritte salgono nello spazio sopra
      <div style={{ position: 'absolute', inset: 0, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 60, paddingBottom: qrBack && back !== 'qr' ? 72 + 150 + 40 : 60 }}>
        {back === 'logo' && (
          <>
            <Logo url={logoUrl} maxW={vertical ? 420 : 460} maxH={vertical ? 300 : 240} />
            {on('company') && <div style={{ marginTop: 26, fontFamily: serif, fontSize: 40, color: fg }}>{val('company')}</div>}
            {settings.slogan && <div style={{ marginTop: 12, fontSize: 24, letterSpacing: 2, color: colors.accent }}>{settings.slogan}</div>}
          </>
        )}
        {back === 'qr' && qrSvg && (
          <>
            <Qr svg={qrSvg} size={vertical ? 330 : 300} />
            <div style={{ marginTop: 26, fontSize: 26, fontWeight: 600, letterSpacing: 2, color: colors.accent }}>{texts.scanQr}</div>
            {on('website') && <div style={{ marginTop: 8, fontSize: 22, color: colors.muted }}>{val('website')}</div>}
          </>
        )}
        {back === 'slogan' && (
          <>
            <div style={{ fontFamily: serif, fontSize: vertical ? 52 : 58, lineHeight: 1.15, color: fg, maxWidth: vertical ? 560 : 860 }}>{settings.slogan || val('company') || val('name')}</div>
            <div style={{ marginTop: 26, height: 4, width: 120, borderRadius: 2, background: colors.accent }} />
            {on('website') && <div style={{ marginTop: 22, fontSize: 24, color: colors.muted }}>{val('website')}</div>}
          </>
        )}
        {back === 'color' && <Logo url={logoUrl} maxW={vertical ? 360 : 380} maxH={vertical ? 260 : 200} tile />}
        {qrBack && back !== 'qr' && (
          <div style={{ position: 'absolute', left: '50%', bottom: 72, transform: 'translateX(-50%)' }}>
            <Qr svg={qrSvg} size={150} />
          </div>
        )}
      </div>
    )
  } else if (settings.layout === 'centered') {
    content = (
      <div style={{ position: 'absolute', inset: 0, background: colors.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '50px 70px' }}>
        <Logo url={logoUrl} maxW={300} maxH={110} />
        <div style={{ marginTop: logoUrl ? 22 : 0 }}>{name}</div>
        {role}
        {company}
        {contacts.length > 0 && <div style={{ margin: '24px 0 20px', height: 3, width: 90, borderRadius: 2, background: colors.accent }} />}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 36, rowGap: 10, maxWidth: qrFront ? 700 : 900 }}>
          {contacts.map((f) => {
            const Icon = ICONS[f]!
            return (
              <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 22, color: colors.text, whiteSpace: 'nowrap' }}>
                <Icon size={22} color={colors.accent} strokeWidth={2.2} /> {val(f)}
              </span>
            )
          })}
        </div>
        {qrFront && (
          <div style={{ position: 'absolute', right: 50, bottom: 50 }}>
            <Qr svg={qrSvg} size={140} />
          </div>
        )}
      </div>
    )
  } else if (settings.layout === 'elegant') {
    content = (
      <div style={{ position: 'absolute', inset: 0, background: colors.bg, display: 'flex', alignItems: 'stretch', padding: '70px 70px' }}>
        <div style={{ width: 430, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoUrl && (
            <div style={{ marginBottom: 26 }}>
              <Logo url={logoUrl} maxW={260} maxH={100} />
            </div>
          )}
          {name}
          {role}
          {company}
          {qrFront && (
            <div style={{ marginTop: 22 }}>
              <Qr svg={qrSvg} size={120} />
            </div>
          )}
        </div>
        <div style={{ width: 3, margin: '10px 46px', borderRadius: 2, background: colors.accent }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>{contactList({ gap: 16, maxW: 420 })}</div>
      </div>
    )
  } else if (settings.layout === 'band') {
    content = (
      <div style={{ position: 'absolute', inset: 0, background: colors.bg, display: 'flex' }}>
        <div style={{ width: 330, background: colors.band, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: 36, textAlign: 'center' }}>
          <Logo url={logoUrl} maxW={220} maxH={150} tile />
          {on('company') && <div style={{ fontSize: 24, fontWeight: 700, color: colors.bandText }}>{val('company')}</div>}
          {qrFront && <Qr svg={qrSvg} size={130} />}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '50px 60px' }}>
          {name}
          {role}
          {contacts.length > 0 && <div style={{ margin: '24px 0', height: 3, width: 80, borderRadius: 2, background: colors.accent }} />}
          {contactList({ gap: 12, maxW: 560 })}
        </div>
      </div>
    )
  } else if (settings.layout === 'minimal') {
    content = (
      <div style={{ position: 'absolute', inset: 0, background: colors.bg, padding: '64px 70px' }}>
        <div style={{ position: 'absolute', right: 70, top: 64 }}>
          <Logo url={logoUrl} maxW={200} maxH={90} />
        </div>
        <div style={{ maxWidth: 620 }}>
          {name}
          {role}
          {company}
        </div>
        <div style={{ position: 'absolute', left: 70, bottom: 60, right: qrFront ? 260 : 70, display: 'grid', gridTemplateColumns: contacts.length > 3 ? '1fr 1fr' : '1fr', columnGap: 30, rowGap: 10 }}>
          {contacts.map((f) => {
            const Icon = ICONS[f]!
            const t = val(f)
            return (
              <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: t.length > 26 ? 19 : 21, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Icon size={20} color={colors.accent} strokeWidth={2.2} style={{ flexShrink: 0 }} /> {t}
              </span>
            )
          })}
        </div>
        {qrFront && (
          <div style={{ position: 'absolute', right: 60, bottom: 50 }}>
            <Qr svg={qrSvg} size={140} />
          </div>
        )}
      </div>
    )
  } else if (settings.layout === 'vertical') {
    content = (
      <div style={{ position: 'absolute', inset: 0, background: colors.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 60px' }}>
        <Logo url={logoUrl} maxW={300} maxH={150} />
        <div style={{ marginTop: logoUrl ? 40 : 0 }}>{name}</div>
        {role}
        {company}
        {contacts.length > 0 && <div style={{ margin: '34px 0 30px', height: 3, width: 90, borderRadius: 2, background: colors.accent }} />}
        {contactList({ align: 'center', gap: 16, maxW: 560 })}
        {qrFront && (
          <div style={{ marginTop: 40 }}>
            <Qr svg={qrSvg} size={170} />
          </div>
        )}
      </div>
    )
  } else {
    // verticalBand
    content = (
      <div style={{ position: 'absolute', inset: 0, background: colors.bg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 320, background: colors.band, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 30 }}>
          <Logo url={logoUrl} maxW={280} maxH={150} tile />
          {on('company') && <div style={{ fontSize: 26, fontWeight: 700, color: colors.bandText, textAlign: 'center' }}>{val('company')}</div>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '50px 60px' }}>
          {name}
          {role}
          {contacts.length > 0 && <div style={{ margin: '26px 0', height: 3, width: 80, borderRadius: 2, background: colors.accent }} />}
          {contactList({ gap: 14, maxW: 560 })}
          {qrFront && (
            <div style={{ marginTop: 'auto', alignSelf: 'flex-end' }}>
              <Qr svg={qrSvg} size={150} />
            </div>
          )}
        </div>
      </div>
    )
  }

  const root: CSSProperties = { width: w + BLEED * 2, height: h + BLEED * 2, position: 'relative', overflow: 'hidden', background: side === 'back' && settings.back === 'color' ? colors.band : colors.bg }
  return (
    <div ref={ref} className={inter.className} style={root}>
      <LogoScale.Provider value={LOGO_SCALE[settings.logoSize]}>
        <div style={{ position: 'absolute', left: BLEED, top: BLEED, width: w, height: h }}>{content}</div>
      </LogoScale.Provider>
    </div>
  )
})

export default ClassicCardCanvas

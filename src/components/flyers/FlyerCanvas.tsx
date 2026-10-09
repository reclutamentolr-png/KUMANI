'use client'

import { forwardRef, type CSSProperties } from 'react'
import localFont from 'next/font/local'
import {
  AudioWaveform, Award, BadgeCheck, Bell, BellRing, BookOpen, Bookmark, BriefcaseBusiness, Building2, Calculator, CalendarCheck, CalendarClock,
  CalendarDays, Camera, Car, ChartColumn, ChartLine, Circle, CircleCheck, ClipboardList, ClipboardPaste, Clock, Coins, Compass, Dices, Download, Ear, Eye,
  EyeOff, FileDown, FileSpreadsheet, FileText, Flower2, FolderOpen, Gauge, Gift, Globe, GraduationCap, Grid3x3, HandHelping, Handshake,
  HeartHandshake, House, IdCard, Image as ImageIcon, KeyRound, Landmark, Languages, Laugh, Lightbulb, Link, ListChecks, Mail, MailWarning,
  Map as MapIcon, MapPin, Megaphone, MessageCircle, MessageSquareWarning, Moon, Music, NotebookPen, Package, Palette, Paperclip, PenLine, Pencil,
  PartyPopper, Percent, PiggyBank, Plane, QrCode, Receipt, RefreshCw, Repeat, Route, ScanBarcode, Search, Send, Share2, ShieldCheck, ShoppingBasket, SlidersHorizontal,
  Smartphone, Sparkles, Stamp, Star, Store, Swords, Tag, Ticket, Timer, TreePine, TriangleAlert, UserSearch, Users, Utensils, VenetianMask, Wallet,
  Wheat, Wind, Zap, type LucideIcon,
} from 'lucide-react'
import type { FlyerConfig } from '@/lib/flyers'

// Volantino 1080×1350 (4:5, adatto a WhatsApp e social). Lo disegna il
// browser con i testi ufficiali e il QR di chi scarica; FlyerExport lo
// trasforma in immagine e PDF.

// Caratteri dentro il progetto (src/fonts, latino e cirillico): la build non
// dipende da Google Fonts
const inter = localFont({ src: '../../fonts/Inter.woff2', weight: '100 900' })
const playfair = localFont({ src: '../../fonts/PlayfairDisplay.woff2', weight: '400 900' })

const ICONS: Record<string, LucideIcon> = {
  AudioWaveform, Award, BadgeCheck, Bell, BellRing, BookOpen, Bookmark, BriefcaseBusiness, Building2, Calculator, CalendarCheck, CalendarClock,
  CalendarDays, Camera, Car, ChartColumn, ChartLine, Circle, CircleCheck, ClipboardList, ClipboardPaste, Clock, Coins, Compass, Dices, Download, Ear, Eye,
  EyeOff, FileDown, FileSpreadsheet, FileText, Flower2, FolderOpen, Gauge, Gift, Globe, GraduationCap, Grid3x3, HandHelping, Handshake,
  HeartHandshake, House, IdCard, Image: ImageIcon, KeyRound, Landmark, Languages, Laugh, Lightbulb, Link, ListChecks, Mail, MailWarning,
  Map: MapIcon, MapPin, Megaphone, MessageCircle, MessageSquareWarning, Moon, Music, NotebookPen, Package, Palette, Paperclip, PenLine, Pencil,
  PartyPopper, Percent, PiggyBank, Plane, QrCode, Receipt, RefreshCw, Repeat, Route, ScanBarcode, Search, Send, Share2, ShieldCheck, ShoppingBasket, SlidersHorizontal,
  Smartphone, Sparkles, Stamp, Star, Store, Swords, Tag, Ticket, Timer, TreePine, TriangleAlert, UserSearch, Users, Utensils, VenetianMask, Wallet,
  Wheat, Wind, Zap,
}
const Icon = ({ name, size, color }: { name: string; size: number; color: string }) => {
  const C = ICONS[name] ?? Sparkles
  return <C size={size} color={color} strokeWidth={1.75} />
}

export type FlyerTexts = {
  name: string
  sub: string
  tagline: string
  points: [string, string][]
  note: string | null
  category: string
  planLabel: string
  priceLabel: string
  passLabel: string | null
  cta: string
  url: string
  tagLine: string
}

type Props = { config: FlyerConfig; texts: FlyerTexts; qrSvg: string; logoUrl: string; imageUrl: string | null }

const GOLD = '#C79A3B'
const GOLD2 = '#E7C56A'
const INK = '#171717'
const CREAM = '#F4F1E8'
const MUTED = '#756F62'
const PALE = '#F5E8BD'

const FlyerCanvas = forwardRef<HTMLDivElement, Props>(function FlyerCanvas({ config, texts, qrSvg, logoUrl, imageUrl }, ref) {
  const serif = playfair.style.fontFamily
  const root: CSSProperties = { width: 1080, height: 1350, position: 'relative', overflow: 'hidden', fontFamily: inter.style.fontFamily, color: INK }
  const brand = (dark: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt="" width={76} height={76} />
      <span style={{ fontFamily: serif, fontSize: 30, fontWeight: 800, letterSpacing: 6, color: dark ? GOLD2 : GOLD }}>KUMANI</span>
    </div>
  )
  const footer = (dark: boolean) => (
    <div
      style={{
        position: 'absolute', left: 64, right: 64, bottom: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28,
        background: dark ? INK : '#fff', color: dark ? '#fff' : INK, borderRadius: 30, padding: '24px 28px', boxShadow: '0 10px 30px rgba(0,0,0,.10)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: 1.5 }}>{texts.planLabel}</div>
        <div style={{ fontSize: 38, fontWeight: 800, marginTop: 2 }}>{texts.priceLabel}</div>
        {texts.passLabel && <div style={{ fontSize: 20, lineHeight: 1.35, whiteSpace: 'pre-line', color: dark ? '#cfc6b0' : MUTED, marginTop: 4 }}>{texts.passLabel}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 'none' }}>
        <div style={{ textAlign: 'right', fontSize: 21, color: dark ? '#cfc6b0' : MUTED }}>
          {texts.cta}
          <div style={{ fontSize: 32, fontWeight: 800, color: dark ? '#fff' : INK }}>{texts.url}</div>
          <div style={{ fontSize: 18 }}>{texts.tagLine}</div>
        </div>
        <div style={{ width: 128, height: 128, padding: 9, borderRadius: 16, border: `2px solid ${GOLD2}`, background: '#fff' }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>
    </div>
  )
  const chip = (dark: boolean): CSSProperties => ({
    display: 'inline-block', padding: '9px 20px', borderRadius: 999, fontSize: 22, fontWeight: 700,
    ...(dark ? { background: 'rgba(231,197,106,.14)', border: '1px solid rgba(231,197,106,.45)', color: GOLD2 } : { border: `2px solid ${INK}` }),
  })

  // ---------- Foto (servizi Pro) ----------
  if (config.style === 'photo') {
    return (
      <div ref={ref} style={{ ...root, background: CREAM }}>
        <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 720, backgroundImage: imageUrl ? `url(${imageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: INK }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(23,23,23,.75) 0%,rgba(23,23,23,.15) 35%,rgba(23,23,23,.92) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, padding: '60px 68px', color: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {brand(true)}
              <span style={{ padding: '9px 20px', borderRadius: 999, background: GOLD2, color: INK, fontSize: 22, fontWeight: 700 }}>{texts.category}</span>
            </div>
            <div style={{ marginTop: 'auto' }}>
              <div style={{ fontFamily: serif, fontSize: texts.name.length > 12 ? 84 : 100, lineHeight: 0.95, fontWeight: 800 }}>{texts.name}</div>
              <div style={{ fontSize: 34, fontWeight: 600, color: GOLD2, marginTop: 12 }}>{texts.sub}</div>
              <div style={{ marginTop: 22, fontSize: 32, lineHeight: 1.3, color: PALE, maxWidth: 900 }}>{texts.tagline}</div>
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 64, right: 64, top: 770, bottom: 290, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {texts.points.map(([t, d], i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 26, padding: '30px 24px', boxShadow: '0 8px 24px rgba(0,0,0,.06)' }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, background: PALE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={config.points[i]} size={32} color={GOLD} />
              </div>
              <div style={{ marginTop: 20, fontSize: 27, fontWeight: 700, lineHeight: 1.2 }}>{t}</div>
              <div style={{ marginTop: 10, fontSize: 22, lineHeight: 1.35, color: MUTED }}>{d}</div>
            </div>
          ))}
        </div>
        {texts.note && <div style={{ position: 'absolute', left: 64, right: 64, top: 1072, fontSize: 19, color: MUTED, fontStyle: 'italic' }}>{texts.note}</div>}
        {footer(true)}
      </div>
    )
  }

  // ---------- Telefono con la schermata ----------
  if (config.style === 'phone') {
    return (
      <div ref={ref} style={{ ...root, background: INK, color: '#fff' }}>
        <div style={{ position: 'absolute', right: -200, top: 120, width: 760, height: 760, borderRadius: '50%', background: 'radial-gradient(circle,rgba(231,197,106,.35),transparent 65%)' }} />
        <div style={{ position: 'absolute', left: 68, top: 64, width: 520 }}>
          {brand(true)}
          <div style={{ ...chip(true), marginTop: 56 }}>{texts.category}</div>
          <div style={{ marginTop: 24, fontFamily: serif, fontSize: texts.name.length > 11 ? 60 : 72, lineHeight: 0.98, fontWeight: 800 }}>{texts.name}</div>
          <div style={{ fontSize: 30, fontWeight: 600, color: GOLD2, marginTop: 14 }}>{texts.sub}</div>
          <div style={{ marginTop: 22, fontSize: 27, lineHeight: 1.38, color: PALE }}>{texts.tagline}</div>
        </div>
        <div style={{ position: 'absolute', right: 70, top: 70, width: 380, height: 800, borderRadius: 56, background: '#0b0b0b', padding: 14, boxShadow: '0 30px 60px rgba(0,0,0,.55),0 0 0 2px #3a352b' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 44, overflow: 'hidden', backgroundColor: '#222', backgroundImage: imageUrl ? `url(${imageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'top center' }} />
        </div>
        {texts.note && <div style={{ position: 'absolute', right: 70, top: 885, width: 380, fontSize: 18, color: '#a39a86', fontStyle: 'italic', textAlign: 'center' }}>{texts.note}</div>}
        <div style={{ position: 'absolute', left: 68, top: 610, width: 520 }}>
          {texts.points.map(([t, d], i) => (
            <div key={i} style={{ display: 'flex', gap: 18, marginBottom: 22 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: `linear-gradient(135deg,${GOLD},${GOLD2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name={config.points[i]} size={28} color={INK} />
              </div>
              <div>
                <div style={{ fontSize: 25, fontWeight: 700 }}>{t}</div>
                <div style={{ marginTop: 3, fontSize: 20, lineHeight: 1.35, color: '#cfc6b0' }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
        {footer(false)}
      </div>
    )
  }

  // ---------- Chiaro e minimale ----------
  return (
    <div ref={ref} style={{ ...root, background: '#fff' }}>
      <div style={{ padding: '68px 76px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {brand(false)}
          <span style={chip(false)}>{texts.category}</span>
        </div>
        <div style={{ marginTop: 80, display: 'flex', alignItems: 'flex-end', gap: 28 }}>
          <div style={{ width: 120, height: 120, borderRadius: 32, background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Icon name={config.icon} size={64} color={GOLD2} />
          </div>
          <div style={{ fontFamily: serif, fontSize: texts.name.length > 12 ? 84 : 110, lineHeight: 0.9, fontWeight: 800 }}>{texts.name}</div>
        </div>
        <div style={{ marginTop: 22, fontSize: 40, fontWeight: 700, color: GOLD }}>{texts.sub}</div>
        <div style={{ marginTop: 18, fontSize: 31, lineHeight: 1.35, color: '#4a463e', maxWidth: 900 }}>{texts.tagline}</div>
        <div style={{ marginTop: 48, borderTop: '2px solid #EFE7D2' }}>
          {texts.points.map(([t, d], i) => (
            <div key={i} style={{ display: 'flex', gap: 28, padding: '24px 0', borderBottom: '2px solid #EFE7D2' }}>
              <span style={{ fontFamily: serif, fontWeight: 800, fontSize: 44, color: GOLD2, width: 70, flex: 'none', lineHeight: 1 }}>0{i + 1}</span>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{t}</div>
                <div style={{ marginTop: 4, fontSize: 23, lineHeight: 1.35, color: MUTED }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
        {texts.note && <div style={{ marginTop: 18, fontSize: 19, color: MUTED, fontStyle: 'italic' }}>{texts.note}</div>}
      </div>
      {footer(true)}
    </div>
  )
})

export default FlyerCanvas

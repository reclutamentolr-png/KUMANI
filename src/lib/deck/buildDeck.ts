'use client'

import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import QRCode from 'qrcode'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as Lucide from 'lucide-react'
import type { DeckCatalogGroup, DeckPlan, DeckVariant } from '@/lib/deck/types'

// Presentazione KUMANI creata nel browser al momento del download: testi
// ufficiali (namespace "deckTexts", correggibili dall'Area Traduttori),
// 19 slide con transizioni, animazioni d'entrata e note per chi presenta.
// Apertura d'urto (truffe, troppe app, la risposta) prima della copertina, se
// la lingua ha già quei testi. Le righe legate a un servizio («tools») si
// mostrano solo se il servizio è acceso dall'Admin.
// Versione Full: in più, dopo la Sicurezza, tutti i servizi uno per uno
// (una slide per gruppo, come la pagina Servizi) con il bollino del piano.

/* eslint-disable @typescript-eslint/no-explicit-any */
type T = any // testi della presentazione, struttura in messages/<lingua>.json → deckTexts

const THEME_COLORS: Record<string, string> = {
  dk1: '171717', lt1: 'FFFFFF', dk2: '292722', lt2: 'F4F1E8',
  accent1: 'C79A3B', accent2: 'E7C56A', accent3: 'F5E8BD', accent4: '756F62', accent5: 'B5452F', accent6: '3E7C59',
  hlink: 'C79A3B', folHlink: '756F62',
}
const HEX = { ink: '171717', gold: 'C79A3B', goldBright: 'E7C56A', white: 'FFFFFF', red: 'B5452F', sky: '5BA4D6' }
const SCALE: Record<string, number> = { it: 1, en: 1, fr: 0.94, es: 0.96, pt: 0.96, de: 0.92, ru: 0.92 }
// Gruppi di servizi (stessi colori della pagina Servizi) e bollini dei piani
const GROUP_HEX: Record<string, string> = { social: 'C2185B', kids: 'E08A1E', security: 'B5452F', money: '2F6B45', work: '2B4F9A', business: '8A6D1F', wellness: '0F766E', fun: '7C3AED', community: 'C79A3B' }
const GROUP_TILE: Record<string, string> = { social: 'FCE4EF', kids: 'FDEFD9', security: 'FDE7E3', money: 'E4F1E8', work: 'E6ECF8', business: 'F5E8BD', wellness: 'DFF3F1', fun: 'EFE7FD', community: 'F5E8BD' }
const GROUP_ICON: Record<string, string> = { social: 'Megaphone', kids: 'Baby', security: 'ShieldCheck', money: 'Wallet', work: 'BriefcaseBusiness', business: 'Store', wellness: 'Leaf', fun: 'Dices', community: 'Users' }
const PLAN_BADGE: Record<DeckPlan, { fill: string; text: string }> = { free: { fill: '3E7C59', text: 'FFFFFF' }, base: { fill: 'C79A3B', text: '171717' }, pro: { fill: '171717', text: 'E7C56A' } }
// Servizi per slide (griglia 2 × 4): oltre, il gruppo si divide in più slide
const PER_SLIDE = 8
// Schermate della sorpresa per la slide (public/deck/surprise-<lingua>.png)
const SURPRISE_SHOTS = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']
const LANG: Record<string, string> = { it: 'it-IT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', pt: 'pt-PT', de: 'de-DE', ru: 'ru-RU' }

// Oggetti con chiavi "1", "2"… (come nei file delle lingue) → array
function arrays(v: any): any {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const keys = Object.keys(v)
    if (keys.length && keys.every((k, i) => k === String(i + 1))) return keys.map((k) => arrays(v[k]))
    return Object.fromEntries(keys.map((k) => [k, arrays(v[k])]))
  }
  return v
}

// Icona lucide → PNG (data URL) disegnata su un canvas
const iconCache = new Map<string, string>()
async function icon(name: string, hex: string, px = 256): Promise<string> {
  const key = `${name}-${hex}`
  const hit = iconCache.get(key)
  if (hit) return hit
  const Comp = (Lucide as any)[name] ?? Lucide.Sparkles
  const svg = renderToStaticMarkup(createElement(Comp, { color: '#' + hex, size: px, strokeWidth: 1.75 }))
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  canvas.getContext('2d')!.drawImage(img, 0, 0, px, px)
  const data = 'image/png;base64,' + canvas.toDataURL('image/png').split(',')[1]
  iconCache.set(key, data)
  return data
}

export async function buildDeck(
  rawTexts: unknown,
  locale: string,
  minPassEur: number,
  landingPassEur: number | null = null,
  donationPercentBp: number | null = null,
  variant: DeckVariant = 'lite',
  catalog: DeckCatalogGroup[] = [],
  enabledTools: string[] | null = null
): Promise<Blob> {
  const S: T = arrays(rawTexts)
  // Righe di una slide che compaiono solo con il loro servizio acceso
  const on = enabledTools ? new Set(enabledTools) : null
  const keep = <R,>(rows: R[], tools?: string[]) => rows.filter((_, i) => !on || !tools?.[i] || on.has(tools[i]))
  const full = variant === 'full' && catalog.length > 0
  // {price} = Pass più economico, con il formato di prezzo della lingua
  const price = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: minPassEur % 1 ? 2 : 0 }).format(minPassEur)
  S.s8.passText = String(S.s8.passText).replace('{price}', price)
  S.s8.notes = String(S.s8.notes).replace('{price}', price)
  // Landing Page: inclusa nel Pro, oppure da sola (Pass) se l'Admin la vende così
  const landingPrice =
    landingPassEur != null
      ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: landingPassEur % 1 ? 2 : 0 }).format(landingPassEur)
      : null
  S.landing.badge = landingPrice ? String(S.landing.badgePass).replace('{price}', landingPrice) : S.landing.badgePro
  // {percent} = percentuale di ogni abbonamento donata (Admin → Donazioni)
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format((donationPercentBp ?? 500) / 10000)
  S.s15.src = S.s15.src.map((card: string[]) => card.map((text) => String(text).replace('{percent}', percent)))
  S.s15.notes = String(S.s15.notes).replace('{percent}', percent)
  const k = SCALE[locale] ?? 1
  const fs = (n: number) => Math.round(n * k * 2) / 2
  const lg = LANG[locale] ?? 'it-IT'
  const IMG = `${window.location.origin}/deck`
  const LOGO = `${IMG}/logo.png`

  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = full ? S.full.docTitle : S.docTitle
  pres.author = 'KUMANI'
  pres.company = 'KUMANI'
  pres.theme = { headFontFace: 'Cambria', bodyFontFace: 'Calibri' }
  const C = pres.SchemeColor
  const SH = (): any => ({ type: 'outer', color: '000000', opacity: 0.12, blur: 8, offset: 2, angle: 90 })

  const titleOpts = (color: any) => ({ x: 0.6, y: 0.42, w: 11.2, h: 0.8, fontSize: fs(32), bold: true, color, fontFace: 'Cambria', align: 'left', valign: 'middle', margin: 0 })
  const subOpts = (color: any) => ({ x: 0.6, y: 1.18, w: 11.2, h: 0.45, fontSize: fs(16), color, align: 'left', valign: 'top', margin: 0 })
  for (const [name, bg, tc, sc, nc] of [
    ['KUMANI chiaro', C.background2, C.text1, C.accent4, C.accent4],
    ['KUMANI scuro', C.text1, C.background1, C.accent2, C.accent2],
  ] as const) {
    pres.defineSlideMaster({
      title: name,
      background: { color: bg },
      objects: [
        { placeholder: { options: { name: 'title', type: 'title', ...titleOpts(tc) } as any, text: '' } },
        { placeholder: { options: { name: 'sub', type: 'body', ...subOpts(sc) } as any, text: '' } },
        { image: { x: 12.38, y: 6.78, w: 0.5, h: 0.5, path: LOGO } },
      ],
      slideNumber: { x: 11.55, y: 6.88, w: 0.7, h: 0.3, fontSize: 11, color: nc, align: 'right' } as any,
    })
  }
  pres.defineSlideMaster({ title: 'KUMANI copertina', background: { color: C.text1 }, objects: [] })

  const Tx = (s: any, text: any, o: any) => s.addText(text, { isTextBox: true, margin: 0, lang: lg, ...o })
  const circleIcon = async (s: any, name: string, x: number, y: number, d: number, bg: any, fg: string, objectName: string) => {
    s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: bg }, line: { type: 'none' }, objectName: objectName + '-bg' })
    s.addImage({ data: await icon(name, fg), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52, objectName: objectName + '-ic' })
  }
  const card = (s: any, x: number, y: number, w: number, h: number, objectName: string, fill: any = C.background1) =>
    s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { type: 'none' }, shadow: SH(), objectName })
  const line = (s: any, x1: number, y1: number, x2: number, y2: number, opts: any, objectName: string) =>
    s.addShape(pres.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001), flipH: x2 < x1, flipV: y2 < y1, line: opts, objectName })
  const titled = (s: any, t: string, sub?: string) => {
    s.addText(t, { placeholder: 'title', lang: lg })
    if (sub) s.addText(sub, { placeholder: 'sub', lang: lg })
  }
  const sec: string[] = S.sec

  pres.addSection({ title: sec[0] })

  // 0a. Il colpo: quanto si perde con le truffe online
  if (S.hook1) {
    const s = pres.addSlide({ masterName: 'KUMANI copertina', sectionTitle: sec[0] })
    Tx(s, S.hook1.eyebrow, { x: 0.9, y: 1.35, w: 11.5, h: 0.45, fontSize: 16, bold: true, charSpacing: 6, color: C.accent1, objectName: 'a1-eye' })
    Tx(s, S.hook1.big, { x: 0.9, y: 1.95, w: 11.6, h: 1.7, fontFace: 'Cambria', fontSize: fs(80), bold: true, color: C.accent2, valign: 'middle', objectName: 'a2-big' })
    Tx(s, S.hook1.text, { x: 0.9, y: 3.85, w: 11.0, h: 1.4, fontSize: fs(28), color: C.background1, valign: 'top', objectName: 'a3-testo' })
    s.addShape(pres.ShapeType.rect, { x: 0.9, y: 5.75, w: 1.2, h: 0.06, fill: { color: HEX.red }, line: { type: 'none' }, objectName: 'a4-riga' } as any)
    Tx(s, S.hook1.source, { x: 0.9, y: 5.95, w: 11.0, h: 0.45, fontSize: 12, italic: true, color: C.accent4, objectName: 'a4-fonte' })
    s.addNotes(S.hook1.notes)
  }

  // 1. Copertina
  {
    const s = pres.addSlide({ masterName: 'KUMANI copertina', sectionTitle: sec[0] })
    s.addImage({ path: `${IMG}/circle.jpg`, x: 7.0, y: 0, w: 6.333, h: 7.5, objectName: 'a1-foto' } as any)
    s.addImage({ path: LOGO, x: 0.75, y: 0.8, w: 1.7, h: 1.7, objectName: 'a2-logo' } as any)
    Tx(s, S.s1.title, { x: 0.75, y: 2.85, w: 6.0, h: 1.65, fontFace: 'Cambria', fontSize: S.s1.title.length > 34 ? 36 : fs(44), bold: true, color: C.background1, valign: 'top', objectName: 'a3-titolo' })
    Tx(s, S.s1.sub, { x: 0.75, y: 4.6, w: 6.0, h: 0.9, fontSize: fs(22), italic: true, color: C.accent2, valign: 'top', objectName: 'a4-sotto' })
    Tx(s, full ? S.full.foot : S.s1.foot, { x: 0.75, y: 6.55, w: 6.0, h: 0.4, fontSize: 14, color: C.accent4, objectName: 'a5-data' })
    s.addNotes(S.s1.notes)
  }

  // 2. Il nome
  pres.addSection({ title: sec[1] })
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[1] })
    titled(s, S.s2.title, S.s2.sub)
    const w = 3.35, gap = 0.75, y = 2.2, h = 3.2
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * (w + gap), last = i === 2, [big, head, body] = S.s2.cards[i]
      card(s, x, y, w, h, `a${i * 2 + 1}-card${i}`, last ? C.text1 : C.background1)
      Tx(s, big, { x: x + 0.3, y: y + 0.35, w: w - 0.6, h: 1.0, fontFace: 'Cambria', fontSize: 40, bold: true, color: last ? C.accent2 : C.accent1, objectName: `a${i * 2 + 1}-big${i}` })
      Tx(s, head, { x: x + 0.3, y: y + 1.4, w: w - 0.6, h: 0.6, fontSize: fs(16), bold: true, color: last ? C.background1 : C.text1, valign: 'top', objectName: `a${i * 2 + 1}-head${i}` })
      Tx(s, body, { x: x + 0.3, y: y + 2.0, w: w - 0.6, h: 1.1, fontSize: fs(15), color: last ? C.accent3 : C.accent4, valign: 'top', objectName: `a${i * 2 + 1}-body${i}` })
      if (i < 2) Tx(s, i === 0 ? '+' : '=', { x: x + w, y: y + h / 2 - 0.4, w: gap, h: 0.8, fontSize: 40, bold: true, align: 'center', color: C.accent1, objectName: `a${i * 2 + 2}-op${i}` })
    }
    s.addNotes(S.s2.notes)
  }

  // 3. Perché nasce
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[1] })
    s.addImage({ path: `${IMG}/artisan.jpg`, x: 0, y: 0, w: 5.0, h: 7.5, objectName: 'a1-foto' } as any)
    Tx(s, S.s3.title, { x: 5.6, y: 0.42, w: 7.1, h: 0.8, fontFace: 'Cambria', fontSize: fs(32), bold: true, color: C.text1, valign: 'middle' })
    const ics = ['Hand', 'Lightbulb', 'HeartHandshake']
    for (let i = 0; i < 3; i++) {
      const y = 1.65 + i * 1.65
      await circleIcon(s, ics[i], 5.6, y, 0.9, C.accent3, HEX.gold, `a${i + 2}-ic${i}`)
      Tx(s, S.s3.rows[i][0], { x: 6.8, y: y - 0.02, w: 5.8, h: 0.45, fontSize: fs(20), bold: true, color: C.text1, objectName: `a${i + 2}-t${i}` })
      Tx(s, S.s3.rows[i][1], { x: 6.8, y: y + 0.45, w: 5.8, h: 1.0, fontSize: fs(15), color: C.accent4, valign: 'top', objectName: `a${i + 2}-d${i}` })
    }
    s.addNotes(S.s3.notes)
  }

  // 4. Manifesto
  {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: sec[1] })
    titled(s, S.s4.title, S.s4.sub)
    const ics = ['HandHelping', 'Wrench', 'Hammer', 'BadgeEuro', 'Wind', 'Scale']
    const w = 3.75, h = 2.15, gx = 0.37, gy = 0.35
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * (w + gx), y = 2.0 + Math.floor(i / 3) * (h + gy)
      card(s, x, y, w, h, `a${i + 1}-card${i}`, C.text2)
      s.addImage({ data: await icon(ics[i], HEX.goldBright), x: x + 0.3, y: y + 0.28, w: 0.55, h: 0.55, objectName: `a${i + 1}-ic${i}` } as any)
      Tx(s, [
        { text: S.s4.items[i][0], options: { bold: true, color: C.background1, breakLine: true } },
        { text: S.s4.items[i][1], options: { color: C.accent3 } },
      ], { x: x + 0.3, y: y + 0.95, w: w - 0.6, h: 1.1, fontSize: fs(16), valign: 'top', objectName: `a${i + 1}-tx${i}` })
    }
    s.addNotes(S.s4.notes)
  }

  // 5. Numeri
  pres.addSection({ title: sec[2] })
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[2] })
    titled(s, S.s5.title, S.s5.sub)
    const w = 2.85, gap = 0.27
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * (w + gap), y = 2.1, [n, l, d] = S.s5.stats[i]
      card(s, x, y, w, 3.4, `a${i + 1}-card${i}`)
      Tx(s, n, { x: x + 0.25, y: y + 0.35, w: w - 0.5, h: 1.3, fontFace: 'Cambria', fontSize: 60, bold: true, color: C.accent1, objectName: `a${i + 1}-n${i}` })
      Tx(s, l, { x: x + 0.25, y: y + 1.7, w: w - 0.5, h: 0.5, fontSize: fs(18), bold: true, color: C.text1, objectName: `a${i + 1}-l${i}` })
      Tx(s, d, { x: x + 0.25, y: y + 2.25, w: w - 0.5, h: 1.05, fontSize: fs(14), color: C.accent4, valign: 'top', objectName: `a${i + 1}-d${i}` })
    }
    s.addNotes(S.s5.notes)
  }

  // 6. Le aree: tutte, con quanti servizi e alcuni nomi (servizi accesi)
  if (S.s7.links && catalog.length) {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[2] })
    titled(s, S.s6.title, S.s6.sub)
    const cols = catalog.length > 6 ? 4 : 3, rowsN = Math.ceil(catalog.length / cols)
    const gx = 0.25, gy = 0.25, w = (12.1 - gx * (cols - 1)) / cols, h = Math.min(2.3, (4.85 - gy * (rowsN - 1)) / rowsN)
    for (let i = 0; i < catalog.length; i++) {
      const g = catalog[i], x = 0.6 + (i % cols) * (w + gx), y = 1.85 + Math.floor(i / cols) * (h + gy), hex = GROUP_HEX[g.key] ?? HEX.gold
      card(s, x, y, w, h, `a${i + 1}-card${i}`)
      await circleIcon(s, GROUP_ICON[g.key] ?? 'Sparkles', x + 0.22, y + 0.22, 0.62, hex, HEX.white, `a${i + 1}-ic${i}`)
      Tx(s, [
        { text: g.label, options: { bold: true, color: C.text1, fontSize: fs(16), breakLine: true } },
        { text: g.count, options: { bold: true, color: hex, fontSize: fs(13) } },
      ], { x: x + 0.95, y: y + 0.16, w: w - 1.1, h: 0.75, valign: 'middle', objectName: `a${i + 1}-t${i}` })
      const names = g.items.map((it) => it.name)
      const shown = rowsN > 1 ? 6 : 8
      Tx(s, names.slice(0, shown).join(' · ') + (names.length > shown ? ' …' : ''), { x: x + 0.22, y: y + 0.98, w: w - 0.4, h: h - 1.08, fontSize: fs(12), color: C.accent4, valign: 'top', objectName: `a${i + 1}-d${i}` })
    }
    s.addNotes(S.s6.notes)
  } else {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[2] })
    titled(s, S.s6.title, S.s6.sub)
    const ics = ['Megaphone', 'ShieldCheck', 'CalendarDays', 'Leaf', 'BriefcaseBusiness', 'Users']
    const w = 3.8, h = 2.3, gx = 0.35, gy = 0.3
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * (w + gx), y = 1.85 + Math.floor(i / 3) * (h + gy)
      card(s, x, y, w, h, `a${i + 1}-card${i}`)
      await circleIcon(s, ics[i], x + 0.25, y + 0.25, 0.75, C.text1, HEX.goldBright, `a${i + 1}-ic${i}`)
      Tx(s, S.s6.areas[i][0], { x: x + 1.15, y: y + 0.25, w: w - 1.35, h: 0.75, fontSize: fs(19), bold: true, color: C.text1, valign: 'middle', objectName: `a${i + 1}-t${i}` })
      Tx(s, S.s6.areas[i][1], { x: x + 0.25, y: y + 1.12, w: w - 0.5, h: 1.1, fontSize: fs(14), color: C.accent4, valign: 'top', objectName: `a${i + 1}-d${i}` })
    }
    s.addNotes(S.s6.notes)
  }

  // 7. Ecosistema: le aree in cerchio, collegate dai passaggi veri tra servizi
  if (S.s7.links && catalog.length) {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: sec[2] })
    titled(s, S.s7.title, S.s7.sub)
    const cx = 3.55, cy = 4.4, r = 2.05, d = 0.82
    // Le aree in cerchio: ogni collegamento passa da KUMANI, al centro
    const ring = catalog
    const pos = new Map(ring.map((g, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / ring.length
      return [g.key, [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number]]
    }))
    const all = (S.s7.links as string[][]).map((row, i) => ({ row, groups: S.s7.linkGroups[i] as string[], tool: S.s7.linkTools?.[i] as string | undefined }))
    const links = all.filter((l) => pos.has(l.groups[0]) && pos.has(l.groups[1]) && (!on || !l.tool || on.has(l.tool)))
    // Raggi: ogni area è collegata al centro
    ring.forEach((g, k) => {
      const [x, y] = pos.get(g.key)!
      line(s, cx, cy, x, y, { color: HEX.gold, width: 1.5, dashType: 'dash' }, `a2-raggio${k}`)
    })
    s.addShape(pres.ShapeType.ellipse, { x: cx - 0.62, y: cy - 0.62, w: 1.24, h: 1.24, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'a1-centro' } as any)
    s.addImage({ path: LOGO, x: cx - 0.47, y: cy - 0.47, w: 0.94, h: 0.94, objectName: 'a1-logo' } as any)
    let k = 0
    for (const g of ring) {
      const [x, y] = pos.get(g.key)!, hex = GROUP_HEX[g.key] ?? HEX.gold
      await circleIcon(s, GROUP_ICON[g.key] ?? 'Sparkles', x - d / 2, y - d / 2, d, hex, HEX.white, `a2-area${k}`)
      const below = y >= cy - 0.1
      Tx(s, g.label, { x: x - 1.0, y: below ? y + d / 2 + 0.02 : y - d / 2 - 0.4, w: 2.0, h: 0.38, fontSize: fs(11), bold: true, align: 'center', color: C.background1, valign: below ? 'top' : 'bottom', objectName: `a2-lab${k}` })
      // Sul raggio, i numeri dei collegamenti di quest'area (vedi elenco a destra)
      const nums = links.map((l, i) => (l.groups.includes(g.key) ? String(i + 1) : '')).filter(Boolean)
      if (nums.length) {
        const mx = cx + (x - cx) * 0.6, my = cy + (y - cy) * 0.6, pw = 0.2 + nums.length * 0.24
        s.addShape(pres.ShapeType.roundRect, { x: mx - pw / 2, y: my - 0.16, w: pw, h: 0.32, rectRadius: 0.16, fill: { color: C.accent2 }, line: { color: C.text1, width: 1 }, objectName: `a3-num${k}` } as any)
        Tx(s, nums.join(' · '), { x: mx - pw / 2, y: my - 0.16, w: pw, h: 0.32, fontSize: 10, bold: true, align: 'center', valign: 'middle', color: C.text1, objectName: `a3-numtx${k}` })
      }
      k++
    }
    // Elenco a destra: ogni collegamento con il suo numero
    links.forEach((l, i) => {
      const ly = 1.9 + i * Math.min(0.68, 4.9 / Math.max(links.length, 1))
      s.addShape(pres.ShapeType.ellipse, { x: 7.0, y: ly + 0.04, w: 0.36, h: 0.36, fill: { color: C.accent2 }, line: { type: 'none' }, objectName: `a${i + 4}-n${i}` } as any)
      Tx(s, String(i + 1), { x: 7.0, y: ly + 0.04, w: 0.36, h: 0.36, fontSize: 11, bold: true, align: 'center', valign: 'middle', color: C.text1, objectName: `a${i + 4}-nt${i}` })
      Tx(s, [
        { text: l.row[0], options: { bold: true, color: C.background1, fontSize: fs(14), breakLine: true } },
        { text: l.row[1], options: { color: C.accent3, fontSize: fs(12) } },
      ], { x: 7.5, y: ly - 0.04, w: 5.3, h: 0.66, valign: 'top', objectName: `a${i + 4}-tx${i}` })
    })
    s.addNotes(S.s7.notes)
  } else {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: sec[2] })
    titled(s, S.s7.title, S.s7.sub)
    const cx = 6.67, cy = 4.3
    const ics = ['CalendarCheck', 'Plane', 'Utensils', 'BookUser', 'Wallet', 'Palette']
    const pos = [[0.6, 2.0], [0.6, 3.6], [0.6, 5.2], [8.93, 2.0], [8.93, 3.6], [8.93, 5.2]]
    const nw = 3.8, nh = 1.3
    for (let i = 0; i < 6; i++) line(s, cx, cy, i < 3 ? pos[i][0] + nw : pos[i][0], pos[i][1] + nh / 2, { color: HEX.gold, width: 1.25, dashType: 'dash' }, `a${i + 2}-ln${i}`)
    s.addShape(pres.ShapeType.ellipse, { x: cx - 1.15, y: cy - 1.15, w: 2.3, h: 2.3, fill: { color: C.accent1 }, line: { type: 'none' }, objectName: 'a1-centro' } as any)
    s.addImage({ path: LOGO, x: cx - 0.85, y: cy - 0.85, w: 1.7, h: 1.7, objectName: 'a1-logo' } as any)
    for (let i = 0; i < 6; i++) {
      const [x, y] = pos[i]
      card(s, x, y, nw, nh, `a${i + 2}-card${i}`, C.text2)
      s.addImage({ data: await icon(ics[i], HEX.goldBright), x: x + 0.22, y: y + 0.35, w: 0.6, h: 0.6, objectName: `a${i + 2}-ic${i}` } as any)
      Tx(s, [
        { text: S.s7.nodes[i][0], options: { bold: true, color: C.background1, fontSize: fs(16), breakLine: true } },
        { text: S.s7.nodes[i][1], options: { color: C.accent3, fontSize: fs(13) } },
      ], { x: x + 1.0, y: y + 0.1, w: nw - 1.12, h: nh - 0.2, valign: 'middle', objectName: `a${i + 2}-tx${i}` })
    }
    s.addNotes(S.s7.notes)
  }

  // 7b. «Scrivi cosa ti serve»: KUMI porta al servizio giusto
  if (S.kumi) {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[2] })
    titled(s, S.kumi.title, S.kumi.sub)
    s.addImage({ path: `${IMG}/kumi.png`, x: 9.45, y: 1.75, w: 3.25, h: 3.58, objectName: 'a1-kumi' } as any)
    // Il campo di ricerca della Home
    s.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 1.95, w: 8.4, h: 0.72, rectRadius: 0.36, fill: { color: C.background1 }, line: { color: HEX.gold, width: 1.5 }, shadow: SH(), objectName: 'a2-campo' } as any)
    s.addImage({ data: await icon('Search', HEX.gold), x: 0.85, y: 2.11, w: 0.4, h: 0.4, objectName: 'a2-lente' } as any)
    Tx(s, S.kumi.search, { x: 1.4, y: 1.95, w: 7.3, h: 0.72, fontSize: fs(17), italic: true, color: C.accent4, valign: 'middle', objectName: 'a2-scrivi' })
    const rows = keep(S.kumi.examples as string[][], S.kumi.tools)
    for (let i = 0; i < rows.length; i++) {
      const y = 2.95 + i * 0.8
      card(s, 0.6, y, 8.4, 0.66, `a${i + 3}-card${i}`)
      Tx(s, rows[i][0], { x: 0.85, y, w: 4.9, h: 0.66, fontSize: fs(15), italic: true, color: C.text1, valign: 'middle', objectName: `a${i + 3}-q${i}` })
      s.addImage({ data: await icon('ArrowRight', HEX.gold), x: 5.8, y: y + 0.16, w: 0.34, h: 0.34, objectName: `a${i + 3}-fr${i}` } as any)
      Tx(s, rows[i][1], { x: 6.3, y, w: 2.55, h: 0.66, fontSize: fs(15), bold: true, color: C.accent1, valign: 'middle', objectName: `a${i + 3}-s${i}` })
    }
    card(s, 0.6, 6.25, 12.1, 0.55, `a${rows.length + 3}-badge`, C.accent3)
    Tx(s, S.kumi.badge, { x: 0.85, y: 6.27, w: 11.6, h: 0.5, fontSize: fs(15), bold: true, color: C.text1, valign: 'middle', objectName: `a${rows.length + 3}-badgetx` })
    s.addNotes(S.kumi.notes)
  }

  // 7c. Un'app sul telefono, senza store
  if (S.app) {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: sec[2] })
    titled(s, S.app.title, S.app.sub)
    const ics = ['Smartphone', 'BellRing', 'MonitorSmartphone', 'Languages']
    for (let i = 0; i < 4; i++) {
      const y = 1.95 + i * 1.08
      await circleIcon(s, ics[i], 0.6, y, 0.72, C.accent1, HEX.ink, `a${i + 2}-ic${i}`)
      Tx(s, [
        { text: S.app.rows[i][0], options: { bold: true, color: C.background1, fontSize: fs(18), breakLine: true } },
        { text: S.app.rows[i][1], options: { color: C.accent3, fontSize: fs(14) } },
      ], { x: 1.55, y: y - 0.08, w: 6.6, h: 1.0, valign: 'top', objectName: `a${i + 2}-tx${i}` })
    }
    card(s, 0.6, 6.25, 7.55, 0.55, 'a6-badge', C.accent1)
    Tx(s, S.app.badge, { x: 0.8, y: 6.27, w: 7.2, h: 0.5, fontSize: fs(15), bold: true, color: C.text1, valign: 'middle', objectName: 'a6-badgetx' })
    // Telefono con l'icona di KUMANI sulla schermata Home
    s.addShape(pres.ShapeType.roundRect, { x: 9.05, y: 1.45, w: 3.15, h: 5.2, rectRadius: 0.3, fill: { color: '000000' }, line: { color: HEX.gold, width: 1.5 }, shadow: SH(), objectName: 'a1-tel' } as any)
    s.addShape(pres.ShapeType.roundRect, { x: 9.3, y: 1.6, w: 2.65, h: 4.9, rectRadius: 0.18, fill: { color: C.text2 }, line: { type: 'none' }, objectName: 'a1-schermo' } as any)
    s.addShape(pres.ShapeType.roundRect, { x: 10.17, y: 3.15, w: 0.9, h: 0.9, rectRadius: 0.2, fill: { color: C.text1 }, line: { color: HEX.gold, width: 1 }, objectName: 'a1-icona' } as any)
    s.addImage({ path: LOGO, x: 10.25, y: 3.23, w: 0.74, h: 0.74, objectName: 'a1-iconalogo' } as any)
    Tx(s, 'KUMANI', { x: 9.3, y: 4.1, w: 2.65, h: 0.35, fontSize: 12, bold: true, align: 'center', color: C.background1, objectName: 'a1-nome' })
    s.addNotes(S.app.notes)
  }

  pres.addSection({ title: sec[3] })
  // 9. Professionisti
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[3] })
    s.addImage({ path: `${IMG}/cafe.jpg`, x: 0, y: 0, w: 5.0, h: 7.5, objectName: 'a1-foto' } as any)
    Tx(s, S.s9.title, { x: 5.6, y: 0.42, w: 7.2, h: 0.8, fontFace: 'Cambria', fontSize: fs(30), bold: true, color: C.text1, valign: 'middle' })
    Tx(s, S.s9.sub, { x: 5.6, y: 1.18, w: 7.2, h: 0.45, fontSize: fs(16), color: C.accent4 })
    // Icone nell'ordine dei testi (6 righe nelle lingue non ancora aggiornate)
    const icsAll = S.s9.rows.length > 6 ? ['Utensils', 'Stamp', 'FileText', 'Store', 'Link2', 'Receipt', 'Package', 'QrCode'] : ['Utensils', 'Stamp', 'FileText', 'Receipt', 'Package', 'QrCode']
    const rows = keep((S.s9.rows as string[][]).map((r, i) => ({ r, ic: icsAll[i] ?? 'Sparkles' })), S.s9.tools)
    const step = Math.min(1.5, 4.95 / Math.max(Math.ceil(rows.length / 2), 1))
    for (let i = 0; i < rows.length; i++) {
      const x = 5.6 + (i % 2) * 3.6, y = 1.95 + Math.floor(i / 2) * step
      await circleIcon(s, rows[i].ic, x, y, 0.7, C.text1, HEX.goldBright, `a${i + 2}-ic${i}`)
      Tx(s, rows[i].r[0], { x: x + 0.85, y: y - 0.02, w: 2.65, h: 0.4, fontSize: fs(16), bold: true, color: C.text1, objectName: `a${i + 2}-t${i}` })
      Tx(s, rows[i].r[1], { x: x + 0.85, y: y + 0.36, w: 2.65, h: step - 0.45, fontSize: fs(13), color: C.accent4, valign: 'top', objectName: `a${i + 2}-d${i}` })
    }
    s.addNotes(S.s9.notes)
  }

  // 9b. Landing Page: il sito vetrina del professionista
  {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: sec[3] })
    titled(s, S.landing.title, S.landing.sub)
    const ics = ['Sparkles', 'Palette', 'MessageCircle', 'Search']
    for (let i = 0; i < 4; i++) {
      const y = 1.95 + i * 1.08
      await circleIcon(s, ics[i], 0.6, y, 0.72, C.accent1, HEX.ink, `a${i + 2}-ic${i}`)
      Tx(s, [
        { text: S.landing.rows[i][0], options: { bold: true, color: C.background1, fontSize: fs(18), breakLine: true } },
        { text: S.landing.rows[i][1], options: { color: C.accent3, fontSize: fs(14) } },
      ], { x: 1.55, y: y - 0.08, w: 6.6, h: 1.0, valign: 'top', objectName: `a${i + 2}-tx${i}` })
    }
    card(s, 0.6, 6.25, 7.55, 0.55, 'a6-badge', C.accent1)
    Tx(s, S.landing.badge, { x: 0.8, y: 6.27, w: 7.2, h: 0.5, fontSize: fs(15), bold: true, color: C.text1, valign: 'middle', objectName: 'a6-badgetx' })
    // Telefono con una Landing Page di esempio
    s.addShape(pres.ShapeType.roundRect, { x: 9.05, y: 1.45, w: 3.15, h: 5.2, rectRadius: 0.3, fill: { color: '000000' }, line: { color: HEX.gold, width: 1.5 }, shadow: SH(), objectName: 'a1-tel' } as any)
    s.addImage({ path: `${IMG}/landing.png`, x: 9.3, y: 1.6, w: 2.65, h: 4.9, objectName: 'a1-pagina' } as any)
    s.addNotes(S.landing.notes)
  }

  // 9c. Clienti e Lavori: clienti, lavori, tempo e incassi in tasca
  {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: sec[3] })
    titled(s, S.clienti.title, S.clienti.sub)
    const ics = ['CalendarCheck', 'BookUser', 'Timer', 'Wallet']
    for (let i = 0; i < 4; i++) {
      const y = 1.95 + i * 1.08
      await circleIcon(s, ics[i], 0.6, y, 0.72, C.accent1, HEX.ink, `a${i + 2}-ic${i}`)
      Tx(s, [
        { text: S.clienti.rows[i][0], options: { bold: true, color: C.background1, fontSize: fs(18), breakLine: true } },
        { text: S.clienti.rows[i][1], options: { color: C.accent3, fontSize: fs(14) } },
      ], { x: 1.55, y: y - 0.08, w: 6.6, h: 1.0, valign: 'top', objectName: `a${i + 2}-tx${i}` })
    }
    card(s, 0.6, 6.25, 7.55, 0.55, 'a6-badge', C.accent1)
    Tx(s, S.clienti.badge, { x: 0.8, y: 6.27, w: 7.2, h: 0.5, fontSize: fs(15), bold: true, color: C.text1, valign: 'middle', objectName: 'a6-badgetx' })
    // Telefono con la pagina «Oggi»
    s.addShape(pres.ShapeType.roundRect, { x: 9.05, y: 1.45, w: 3.15, h: 5.2, rectRadius: 0.3, fill: { color: '000000' }, line: { color: HEX.gold, width: 1.5 }, shadow: SH(), objectName: 'a1-tel' } as any)
    s.addImage({ path: `${IMG}/clienti-${locale === 'it' ? 'it' : 'en'}.jpg`, x: 9.3, y: 1.6, w: 2.65, h: 4.9, objectName: 'a1-pagina' } as any)
    s.addNotes(S.clienti.notes)
  }

  // 10. Sicurezza
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[3] })
    titled(s, S.s10.title, S.s10.sub)
    const ics = ['Globe', 'Image', 'MailWarning', 'Landmark', 'IdCard', 'BookOpen']
    const w = 3.8, h = 2.2, gx = 0.35, gy = 0.3
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * (w + gx), y = 1.9 + Math.floor(i / 3) * (h + gy)
      card(s, x, y, w, h, `a${i + 1}-card${i}`)
      s.addImage({ data: await icon(ics[i], HEX.red), x: x + 0.3, y: y + 0.28, w: 0.6, h: 0.6, objectName: `a${i + 1}-ic${i}` } as any)
      Tx(s, S.s10.items[i][0], { x: x + 0.3, y: y + 0.98, w: w - 0.6, h: 0.45, fontSize: fs(18), bold: true, color: C.text1, objectName: `a${i + 1}-t${i}` })
      Tx(s, S.s10.items[i][1], { x: x + 0.3, y: y + 1.43, w: w - 0.6, h: 0.72, fontSize: fs(14), color: C.accent4, valign: 'top', objectName: `a${i + 1}-d${i}` })
    }
    s.addNotes(S.s10.notes)
  }

  // 10b. Rete Anti-Truffa: la community che si protegge a vicenda
  {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: sec[3] })
    titled(s, S.antitruffa.title, S.antitruffa.sub)
    const ics = ['Flag', 'ShieldAlert', 'PhoneCall', 'Award']
    for (let i = 0; i < 4; i++) {
      const y = 1.95 + i * 1.08
      await circleIcon(s, ics[i], 0.6, y, 0.72, C.accent1, HEX.ink, `a${i + 2}-ic${i}`)
      Tx(s, [
        { text: S.antitruffa.rows[i][0], options: { bold: true, color: C.background1, fontSize: fs(18), breakLine: true } },
        { text: S.antitruffa.rows[i][1], options: { color: C.accent3, fontSize: fs(14) } },
      ], { x: 1.55, y: y - 0.08, w: 6.6, h: 1.0, valign: 'top', objectName: `a${i + 2}-tx${i}` })
    }
    card(s, 0.6, 6.25, 7.55, 0.55, 'a6-badge', C.accent1)
    Tx(s, S.antitruffa.badge, { x: 0.8, y: 6.27, w: 7.2, h: 0.5, fontSize: fs(15), bold: true, color: C.text1, valign: 'middle', objectName: 'a6-badgetx' })
    // Telefono con l'avviso della community
    s.addShape(pres.ShapeType.roundRect, { x: 9.05, y: 1.45, w: 3.15, h: 5.2, rectRadius: 0.3, fill: { color: '000000' }, line: { color: HEX.gold, width: 1.5 }, shadow: SH(), objectName: 'a1-tel' } as any)
    s.addImage({ path: `${IMG}/antitruffa-${locale === 'it' ? 'it' : 'en'}.jpg`, x: 9.3, y: 1.6, w: 2.65, h: 4.9, objectName: 'a1-pagina' } as any)
    s.addNotes(S.antitruffa.notes)
  }

  // Full: tutti i servizi, uno per uno (prima della Community)
  if (full) {
    pres.addSection({ title: S.full.section })
    const planName: Record<DeckPlan, string> = { free: S.s8.plans[0][0], base: S.s8.plans[1][0], pro: S.s8.plans[2][0] }
    const badge = (s: any, plan: DeckPlan, x: number, y: number, w: number, h: number, objectName: string) => {
      s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: h / 2, fill: { color: PLAN_BADGE[plan].fill }, line: plan === 'pro' ? { color: HEX.gold, width: 0.75 } : { type: 'none' }, objectName: objectName + '-bg' } as any)
      Tx(s, planName[plan], { x, y, w, h, fontSize: 10, bold: true, align: 'center', valign: 'middle', color: PLAN_BADGE[plan].text, objectName: objectName + '-tx' })
    }

    // Apertura: i gruppi con il numero dei servizi e la legenda dei bollini
    {
      const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: S.full.section })
      titled(s, S.full.title, S.full.sub)
      const w = 2.8, h = 2.05, gx = 0.3, gy = 0.3
      const slot = (i: number) => [0.6 + (i % 4) * (w + gx), 1.95 + Math.floor(i / 4) * (h + gy)]
      const shown = catalog.slice(0, 7)
      for (let i = 0; i < shown.length; i++) {
        const g = shown[i], [x, y] = slot(i)
        card(s, x, y, w, h, `a${i + 1}-card${i}`, C.text2)
        await circleIcon(s, GROUP_ICON[g.key] ?? 'Sparkles', x + 0.25, y + 0.25, 0.75, GROUP_HEX[g.key] ?? HEX.gold, HEX.white, `a${i + 1}-ic${i}`)
        Tx(s, g.label, { x: x + 0.25, y: y + 1.08, w: w - 0.5, h: 0.6, fontSize: fs(16), bold: true, color: C.background1, valign: 'top', objectName: `a${i + 1}-t${i}` })
        Tx(s, g.count, { x: x + 0.25, y: y + 1.65, w: w - 0.5, h: 0.3, fontSize: fs(14), color: C.accent2, objectName: `a${i + 1}-n${i}` })
      }
      const [lx, ly] = slot(7), n = shown.length + 1
      card(s, lx, ly, w, h, `a${n}-legenda`, C.text2)
      Tx(s, S.full.legend, { x: lx + 0.25, y: ly + 0.18, w: w - 0.5, h: 0.78, fontSize: fs(12.5), italic: true, color: C.accent3, valign: 'top', objectName: `a${n}-legtx` })
      ;(['free', 'base', 'pro'] as const).forEach((plan, j) => badge(s, plan, lx + 0.25, ly + 1.0 + j * 0.34, 1.45, 0.28, `a${n}-b${j}`))
      s.addNotes(S.full.introNotes)
    }

    // Una slide per gruppo (divisa in più slide oltre PER_SLIDE servizi)
    for (const g of catalog) {
      const parts = Math.ceil(g.items.length / PER_SLIDE)
      const size = Math.ceil(g.items.length / parts)
      const hex = GROUP_HEX[g.key] ?? HEX.gold, tile = GROUP_TILE[g.key] ?? 'F5E8BD'
      for (let p = 0; p < parts; p++) {
        const items = g.items.slice(p * size, (p + 1) * size)
        const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: S.full.section })
        titled(s, parts > 1 ? `${g.label} (${p + 1}/${parts})` : g.label, g.sub)
        await circleIcon(s, GROUP_ICON[g.key] ?? 'Sparkles', 11.95, 0.45, 0.75, hex, HEX.white, 'a1-gruppo')
        s.addShape(pres.ShapeType.rect, { x: 0.6, y: 1.7, w: 0.9, h: 0.06, fill: { color: hex }, line: { type: 'none' }, objectName: 'a1-riga' } as any)
        const w = 5.95, h = 1.1, gx = 0.2, gy = 0.12
        for (let i = 0; i < items.length; i++) {
          const it = items[i], x = 0.6 + (i % 2) * (w + gx), y = 1.9 + Math.floor(i / 2) * (h + gy), a = `a${i + 2}`
          card(s, x, y, w, h, `${a}-card${i}`)
          s.addShape(pres.ShapeType.ellipse, { x: x + 0.2, y: y + 0.2, w: 0.62, h: 0.62, fill: { color: tile }, line: { type: 'none' }, objectName: `${a}-icbg${i}` } as any)
          s.addImage({ data: await icon(it.iconName, hex), x: x + 0.33, y: y + 0.33, w: 0.36, h: 0.36, objectName: `${a}-ic${i}` } as any)
          Tx(s, it.name, { x: x + 0.98, y: y + 0.1, w: w - 2.4, h: 0.36, fontSize: it.name.length > 28 ? fs(14) : fs(16), bold: true, color: C.text1, valign: 'middle', objectName: `${a}-t${i}` })
          badge(s, it.plan, x + w - 1.3, y + 0.16, 1.1, 0.28, `${a}-b${i}`)
          Tx(s, it.description, { x: x + 0.98, y: y + 0.46, w: w - 1.18, h: 0.6, fontSize: fs(11), color: C.accent4, valign: 'top', objectName: `${a}-d${i}` })
        }
        s.addNotes(g.notes)
      }
    }
  }

  // 11. Community
  pres.addSection({ title: sec[4] })
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[4] })
    s.addImage({ path: `${IMG}/toast.jpg`, x: 0, y: 0, w: 5.0, h: 7.5, objectName: 'a1-foto' } as any)
    Tx(s, S.s11.title, { x: 5.6, y: 0.42, w: 7.2, h: 0.8, fontFace: 'Cambria', fontSize: fs(30), bold: true, color: C.text1, valign: 'middle' })
    Tx(s, S.s11.sub, { x: 5.6, y: 1.18, w: 7.2, h: 0.45, fontSize: fs(16), italic: true, color: C.accent1 })
    const icsAll = S.s11.rows.length > 6 ? ['ClipboardList', 'ShoppingBasket', 'Clock', 'Ticket', 'Lightbulb', 'Star', 'Sparkles', 'Dices'] : ['ClipboardList', 'ShoppingBasket', 'Clock', 'Ticket', 'Sparkles', 'Dices']
    const rows = keep((S.s11.rows as string[][]).map((r, i) => ({ r, ic: icsAll[i] ?? 'Sparkles' })), S.s11.tools)
    const step = Math.min(1.5, 4.95 / Math.max(Math.ceil(rows.length / 2), 1))
    for (let i = 0; i < rows.length; i++) {
      const x = 5.6 + (i % 2) * 3.6, y = 1.95 + Math.floor(i / 2) * step
      await circleIcon(s, rows[i].ic, x, y, 0.7, C.accent3, HEX.gold, `a${i + 2}-ic${i}`)
      Tx(s, rows[i].r[0], { x: x + 0.85, y: y - 0.02, w: 2.65, h: 0.4, fontSize: fs(16), bold: true, color: C.text1, objectName: `a${i + 2}-t${i}` })
      Tx(s, rows[i].r[1], { x: x + 0.85, y: y + 0.36, w: 2.65, h: step - 0.45, fontSize: fs(13), color: C.accent4, valign: 'top', objectName: `a${i + 2}-d${i}` })
    }
    s.addNotes(S.s11.notes)
  }

  // 12. Punti
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[4] })
    titled(s, S.s12.title, S.s12.sub)
    const cols = [{ ic: 'Sparkles', v: S.s12.karma, dark: false }, { ic: 'Gem', v: S.s12.points, dark: true }]
    const w = 5.9, gap = 0.3, y = 1.85, h = 4.15
    for (let i = 0; i < 2; i++) {
      const x = 0.6 + i * (w + gap), d = cols[i].dark, [n, how, uses] = cols[i].v
      card(s, x, y, w, h, `a${i * 2 + 1}-card${i}`, d ? C.text1 : C.background1)
      await circleIcon(s, cols[i].ic, x + 0.3, y + 0.3, 0.8, d ? C.accent1 : C.accent3, d ? HEX.ink : HEX.gold, `a${i * 2 + 1}-ic${i}`)
      Tx(s, n, { x: x + 1.3, y: y + 0.3, w: w - 1.6, h: 0.8, fontFace: 'Cambria', fontSize: 28, bold: true, color: d ? C.accent2 : C.text1, valign: 'middle', objectName: `a${i * 2 + 1}-n${i}` })
      Tx(s, how, { x: x + 0.3, y: y + 1.25, w: w - 0.6, h: 0.8, fontSize: fs(15), italic: true, color: d ? C.accent3 : C.accent4, valign: 'top', objectName: `a${i * 2 + 1}-h${i}` })
      Tx(s, (uses as string[]).map((u, j) => ({ text: u, options: { bullet: true, breakLine: j < uses.length - 1 } })), { x: x + 0.3, y: y + 2.15, w: w - 0.6, h: 1.85, fontSize: fs(15), color: d ? C.background1 : C.text1, paraSpaceAfter: 6, valign: 'top', objectName: `a${i * 2 + 2}-u${i}` })
    }
    Tx(s, S.s12.note, { x: 0.6, y: 6.12, w: 10.8, h: 0.55, fontSize: fs(13), italic: true, color: C.accent4, valign: 'top', objectName: 'a5-nota' })
    s.addNotes(S.s12.notes)
  }

  // 12b. KUMANI Sorpresa: regalare un'esperienza (anche con i punti)
  if (S.surprise) {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: sec[4] })
    titled(s, S.surprise.title, S.surprise.sub)
    const ics = ['Gift', 'Route', 'PartyPopper', 'HandHeart']
    for (let i = 0; i < 4; i++) {
      const y = 1.95 + i * 1.08
      await circleIcon(s, ics[i], 0.6, y, 0.72, C.accent1, HEX.ink, `a${i + 2}-ic${i}`)
      Tx(s, [
        { text: S.surprise.rows[i][0], options: { bold: true, color: C.background1, fontSize: fs(18), breakLine: true } },
        { text: S.surprise.rows[i][1], options: { color: C.accent3, fontSize: fs(14) } },
      ], { x: 1.55, y: y - 0.08, w: 6.6, h: 1.0, valign: 'top', objectName: `a${i + 2}-tx${i}` })
    }
    card(s, 0.6, 6.25, 7.55, 0.55, 'a6-badge', C.accent1)
    Tx(s, S.surprise.badge, { x: 0.8, y: 6.27, w: 7.2, h: 0.5, fontSize: fs(15), bold: true, color: C.text1, valign: 'middle', objectName: 'a6-badgetx' })
    // Telefono con una sorpresa aperta, nella lingua della presentazione
    s.addShape(pres.ShapeType.roundRect, { x: 9.05, y: 1.45, w: 3.15, h: 5.2, rectRadius: 0.3, fill: { color: '000000' }, line: { color: HEX.gold, width: 1.5 }, shadow: SH(), objectName: 'a1-tel' } as any)
    s.addImage({ path: `${IMG}/surprise-${SURPRISE_SHOTS.includes(locale) ? locale : 'en'}.png`, x: 9.3, y: 1.6, w: 2.65, h: 4.9, objectName: 'a1-pagina' } as any)
    s.addNotes(S.surprise.notes)
  }

  // 13. Condividi
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[4] })
    titled(s, S.s13.title, S.s13.sub)
    const cx = 3.4, cy = 4.25, r = 1.75
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
      line(s, cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a), { color: HEX.gold, width: 1.5 }, `a2-ln${i}`)
    }
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a)
      s.addShape(pres.ShapeType.ellipse, { x: px - 0.42, y: py - 0.42, w: 0.84, h: 0.84, fill: { color: i === 3 ? HEX.sky : HEX.gold }, line: { color: HEX.white, width: 2 }, objectName: `a${3 + i}-p${i}` } as any)
      s.addImage({ data: await icon('User', HEX.white), x: px - 0.22, y: py - 0.22, w: 0.44, h: 0.44, objectName: `a${3 + i}-pi${i}` } as any)
    }
    s.addShape(pres.ShapeType.ellipse, { x: cx - 0.6, y: cy - 0.6, w: 1.2, h: 1.2, fill: { color: C.text1 }, line: { type: 'none' }, objectName: 'a1-tu' } as any)
    Tx(s, S.s13.you, { x: cx - 0.6, y: cy - 0.3, w: 1.2, h: 0.6, fontSize: 18, bold: true, align: 'center', valign: 'middle', color: C.accent2, objectName: 'a1-tutx' })
    s.addShape(pres.ShapeType.ellipse, { x: 0.9, y: 6.45, w: 0.22, h: 0.22, fill: { color: HEX.gold }, line: { type: 'none' }, objectName: 'a8-l1' } as any)
    Tx(s, S.s13.legendMine, { x: 1.2, y: 6.38, w: 2.1, h: 0.36, fontSize: 12, color: C.accent4, valign: 'middle', objectName: 'a8-l1t' })
    s.addShape(pres.ShapeType.ellipse, { x: 3.35, y: 6.45, w: 0.22, h: 0.22, fill: { color: HEX.sky }, line: { type: 'none' }, objectName: 'a8-l2' } as any)
    Tx(s, S.s13.legendReceived, { x: 3.65, y: 6.38, w: 2.4, h: 0.36, fontSize: 12, color: C.accent4, valign: 'middle', objectName: 'a8-l2t' })
    const ics = ['Link', 'HeartHandshake', 'Award']
    for (let i = 0; i < 3; i++) {
      const x = 6.6, y = 1.95 + i * 1.5
      await circleIcon(s, ics[i], x, y, 0.75, C.accent3, HEX.gold, `a${9 + i}-ic${i}`)
      Tx(s, S.s13.rows[i][0], { x: x + 0.95, y: y - 0.02, w: 5.2, h: 0.4, fontSize: fs(18), bold: true, color: C.text1, objectName: `a${9 + i}-t${i}` })
      Tx(s, S.s13.rows[i][1], { x: x + 0.95, y: y + 0.4, w: 5.2, h: 0.95, fontSize: fs(14), color: C.accent4, valign: 'top', objectName: `a${9 + i}-d${i}` })
    }
    s.addNotes(S.s13.notes)
  }

  // Concorrenza e prezzi: dopo aver mostrato tutto quello che c'è
  const priceSec: string = S.secPrice ?? sec[3]
  pres.addSection({ title: priceSec })
  // 0b. Il secondo problema: un'app a pagamento per ogni cosa
  if (S.hook2) {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: priceSec })
    // Titolo lungo (in alcune lingue): più piccolo, così resta su una riga
    const long = String(S.hook2.title).length > 54
    Tx(s, S.hook2.title, { x: 0.6, y: 0.42, w: 12.1, h: 0.8, fontFace: 'Cambria', fontSize: fs(long ? 25 : 32), bold: true, color: C.background1, valign: 'middle' })
    Tx(s, S.hook2.sub, { x: 0.6, y: 1.18, w: 12.1, h: 0.45, fontSize: fs(long ? 14 : 16), color: C.accent2, valign: 'top' })
    const all = (S.hook2.rows as string[][]).map((r, i) => ({ r, annual: Number(S.hook2.annual?.[i] ?? 0) }))
    const rows = keep(all, S.hook2.tools)
    const step = Math.min(0.78, 3.6 / Math.max(rows.length, 1))
    for (let i = 0; i < rows.length; i++) {
      const [app, price, ours] = rows[i].r, y = 1.95 + i * step, h = step - 0.12
      card(s, 0.6, y, 12.1, h, `a${i + 1}-card${i}`, C.text2)
      Tx(s, app, { x: 0.85, y, w: 4.2, h, fontSize: fs(17), bold: true, color: C.background1, valign: 'middle', objectName: `a${i + 1}-app${i}` })
      Tx(s, price, { x: 5.0, y, w: 3.2, h, fontSize: fs(16), bold: true, color: 'FF8A7A', valign: 'middle', objectName: `a${i + 1}-p${i}` })
      s.addImage({ data: await icon('ArrowRight', HEX.gold), x: 8.3, y: y + h / 2 - 0.17, w: 0.34, h: 0.34, objectName: `a${i + 1}-fr${i}` } as any)
      Tx(s, ours, { x: 8.85, y, w: 3.7, h, fontSize: fs(16), bold: true, color: C.accent2, valign: 'middle', objectName: `a${i + 1}-k${i}` })
    }
    const yearly = rows.filter((x) => x.annual > 0)
    const total = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.floor(yearly.reduce((t, x) => t + x.annual, 0)))
    const n = rows.length + 1, ty = 1.95 + rows.length * step + 0.4
    Tx(s, String(S.hook2.total).replace('{count}', String(yearly.length)).replace('{total}', total), { x: 0.6, y: ty, w: 12.1, h: 0.6, fontSize: fs(26), bold: true, color: C.background1, objectName: `a${n}-totale` })
    card(s, 0.6, ty + 0.8, 12.1, 0.85, `a${n + 1}-rispcard`, C.accent1)
    Tx(s, S.hook2.answer, { x: 0.9, y: ty + 0.8, w: 11.6, h: 0.85, fontSize: fs(26), bold: true, color: C.text1, valign: 'middle', objectName: `a${n + 1}-risposta` })
    s.addNotes(S.hook2.notes)
  }

  // 0c. La risposta: un account, tutti gli strumenti, prezzi chiari
  if (S.hook3) {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: priceSec })
    s.addImage({ path: LOGO, x: 0.6, y: 0.55, w: 1.0, h: 1.0, objectName: 'a1-logo' } as any)
    Tx(s, S.hook3.title, { x: 1.85, y: 0.45, w: 10.9, h: 1.3, fontFace: 'Cambria', fontSize: fs(38), bold: true, color: C.background1, valign: 'middle', objectName: 'a1-titolo' })
    const w = 3.85, gap = 0.27, y = 2.35, h = 3.2
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * (w + gap), [big, head, body] = S.hook3.cards[i], hi = i === 2
      card(s, x, y, w, h, `a${i + 2}-card${i}`, hi ? C.accent1 : C.text2)
      Tx(s, big, { x: x + 0.3, y: y + 0.3, w: w - 0.6, h: 1.25, fontFace: 'Cambria', fontSize: 60, bold: true, color: hi ? C.text1 : C.accent2, valign: 'middle', objectName: `a${i + 2}-big${i}` })
      Tx(s, head, { x: x + 0.3, y: y + 1.6, w: w - 0.6, h: 0.5, fontSize: fs(19), bold: true, color: hi ? C.text1 : C.background1, objectName: `a${i + 2}-h${i}` })
      Tx(s, body, { x: x + 0.3, y: y + 2.15, w: w - 0.6, h: 1.6, fontSize: fs(15), color: hi ? C.text1 : C.accent3, valign: 'top', objectName: `a${i + 2}-d${i}` })
    }
    s.addNotes(S.hook3.notes)
  }

  // 8. Piani
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: priceSec })
    titled(s, S.s8.title, S.s8.sub)
    const w = 3.8, gap = 0.35, y = 1.85, h = 3.95
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * (w + gap), d = i === 2, [n, p, per, who, inc, ex] = S.s8.plans[i]
      card(s, x, y, w, h, `a${i + 1}-card${i}`, d ? C.text1 : C.background1)
      Tx(s, n, { x: x + 0.3, y: y + 0.28, w: w - 0.6, h: 0.45, fontSize: fs(20), bold: true, color: d ? C.accent2 : C.accent1, objectName: `a${i + 1}-n${i}` })
      Tx(s, [
        { text: p, options: { fontFace: 'Cambria', fontSize: 44, bold: true, color: d ? C.background1 : C.text1 } },
        { text: '  ' + per, options: { fontSize: fs(15), color: d ? C.accent3 : C.accent4 } },
      ], { x: x + 0.3, y: y + 0.75, w: w - 0.6, h: 0.85, valign: 'middle', objectName: `a${i + 1}-p${i}` })
      Tx(s, who, { x: x + 0.3, y: y + 1.65, w: w - 0.6, h: 0.55, fontSize: fs(14), italic: true, color: d ? C.accent3 : C.accent4, valign: 'top', objectName: `a${i + 1}-w${i}` })
      Tx(s, inc, { x: x + 0.3, y: y + 2.22, w: w - 0.6, h: 0.42, fontSize: fs(15), bold: true, color: d ? C.background1 : C.text1, objectName: `a${i + 1}-i${i}` })
      Tx(s, ex, { x: x + 0.3, y: y + 2.68, w: w - 0.6, h: 1.2, fontSize: fs(13), color: d ? C.accent3 : C.accent4, valign: 'top', objectName: `a${i + 1}-e${i}` })
    }
    card(s, 0.6, 6.0, 12.1, 0.62, 'a4-pass', C.accent3)
    s.addImage({ data: await icon('Ticket', HEX.ink), x: 0.85, y: 6.11, w: 0.4, h: 0.4, objectName: 'a4-passic' } as any)
    Tx(s, [{ text: S.s8.passBold, options: { bold: true } }, { text: S.s8.passText }], { x: 1.45, y: 6.05, w: 11.0, h: 0.52, fontSize: fs(15), color: C.text1, valign: 'middle', objectName: 'a4-passtx' })
    s.addNotes(S.s8.notes)
  }

  // 14. Donazioni: apertura
  pres.addSection({ title: sec[5] })
  {
    const s = pres.addSlide({ masterName: 'KUMANI copertina', sectionTitle: sec[5] })
    s.addImage({ path: `${IMG}/donation-heart.jpg`, x: 7.83, y: 0, w: 5.5, h: 7.5, objectName: 'a1-foto' } as any)
    Tx(s, S.s14.eyebrow, { x: 0.75, y: 2.0, w: 6.6, h: 0.4, fontSize: 15, bold: true, charSpacing: 4, color: C.accent2, objectName: 'a2-eye' })
    Tx(s, S.s14.title, { x: 0.75, y: 2.5, w: 6.6, h: 1.95, fontFace: 'Cambria', fontSize: fs(46), bold: true, color: C.background1, valign: 'top', objectName: 'a3-titolo' })
    Tx(s, S.s14.text, { x: 0.75, y: 4.6, w: 6.4, h: 1.2, fontSize: fs(18), color: C.accent3, valign: 'top', objectName: 'a4-testo' })
    s.addNotes(S.s14.notes)
  }

  // 15. Donazioni: come funzionano
  {
    const s = pres.addSlide({ masterName: 'KUMANI scuro', sectionTitle: sec[5] })
    titled(s, S.s15.title, S.s15.sub)
    for (let i = 0; i < 3; i++) {
      const x = 0.6, y = 1.95 + i * 1.5, w = 4.6, h = 1.3, [n, t, d] = S.s15.src[i]
      card(s, x, y, w, h, `a${i + 1}-card${i}`, C.text2)
      Tx(s, n, { x: x + 0.25, y: y + 0.15, w: 1.5, h: 1.0, fontFace: 'Cambria', fontSize: 40, bold: true, color: C.accent2, valign: 'middle', objectName: `a${i + 1}-n${i}` })
      Tx(s, [
        { text: t, options: { bold: true, color: C.background1, fontSize: fs(16), breakLine: true } },
        { text: d, options: { color: C.accent3, fontSize: fs(14) } },
      ], { x: x + 1.8, y: y + 0.1, w: w - 1.95, h: 1.1, valign: 'middle', objectName: `a${i + 1}-t${i}` })
    }
    for (let i = 0; i < 3; i++) line(s, 5.2, 1.95 + i * 1.5 + 0.65, 6.5, 4.25, { color: HEX.gold, width: 1.5, endArrowType: 'triangle' }, `a4-fr${i}`)
    s.addShape(pres.ShapeType.ellipse, { x: 6.55, y: 3.0, w: 2.5, h: 2.5, fill: { color: C.accent5 }, line: { type: 'none' }, objectName: 'a5-ass' } as any)
    s.addImage({ data: await icon('Heart', HEX.white), x: 7.4, y: 3.4, w: 0.8, h: 0.8, objectName: 'a5-assic' } as any)
    Tx(s, S.s15.assoc, { x: 6.7, y: 4.3, w: 2.2, h: 0.8, fontSize: fs(14), bold: true, align: 'center', valign: 'top', color: C.background1, objectName: 'a5-asstx' })
    line(s, 9.1, 4.25, 9.8, 4.25, { color: HEX.gold, width: 1.5, endArrowType: 'triangle' }, 'a6-fr')
    card(s, 9.85, 2.6, 2.85, 3.3, 'a6-card', C.text2)
    s.addImage({ data: await icon('FileCheck', HEX.goldBright), x: 10.1, y: 2.85, w: 0.6, h: 0.6, objectName: 'a6-ic' } as any)
    Tx(s, S.s15.publicT, { x: 10.1, y: 3.55, w: 2.4, h: 0.45, fontSize: fs(17), bold: true, color: C.background1, objectName: 'a6-t' })
    Tx(s, S.s15.publicD, { x: 10.1, y: 4.05, w: 2.4, h: 1.75, fontSize: fs(14), color: C.accent3, valign: 'top', objectName: 'a6-d' })
    s.addNotes(S.s15.notes)
  }

  // 16. Fiducia
  pres.addSection({ title: sec[6] })
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[6] })
    titled(s, S.s16.title, S.s16.sub)
    const ics = ['Scale', 'Server', 'CreditCard', 'Languages', 'BookOpenCheck', 'Mail']
    const w = 3.8, h = 2.2, gx = 0.35, gy = 0.3
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * (w + gx), y = 1.9 + Math.floor(i / 3) * (h + gy)
      card(s, x, y, w, h, `a${i + 1}-card${i}`)
      await circleIcon(s, ics[i], x + 0.3, y + 0.28, 0.7, C.text1, HEX.goldBright, `a${i + 1}-ic${i}`)
      Tx(s, S.s16.items[i][0], { x: x + 1.15, y: y + 0.25, w: w - 1.35, h: 0.8, fontSize: fs(18), bold: true, color: C.text1, valign: 'middle', objectName: `a${i + 1}-t${i}` })
      Tx(s, S.s16.items[i][1], { x: x + 0.3, y: y + 1.12, w: w - 0.6, h: 1.0, fontSize: fs(14), color: C.accent4, valign: 'top', objectName: `a${i + 1}-d${i}` })
    }
    s.addNotes(S.s16.notes)
  }

  // 17. Come si inizia
  {
    const s = pres.addSlide({ masterName: 'KUMANI chiaro', sectionTitle: sec[6] })
    titled(s, S.s17.title, S.s17.sub)
    const ics = ['UserPlus', 'Compass', 'Rocket']
    const w = 3.5, gap = 0.8, y = 2.2
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * (w + gap)
      card(s, x, y, w, 3.1, `a${i * 2 + 1}-card${i}`)
      Tx(s, String(i + 1), { x: x + 0.3, y: y + 0.25, w: 1.0, h: 1.0, fontFace: 'Cambria', fontSize: 54, bold: true, color: C.accent3, objectName: `a${i * 2 + 1}-num${i}` })
      await circleIcon(s, ics[i], x + w - 1.15, y + 0.35, 0.85, C.text1, HEX.goldBright, `a${i * 2 + 1}-ic${i}`)
      Tx(s, S.s17.steps[i][0], { x: x + 0.3, y: y + 1.4, w: w - 0.6, h: 0.5, fontSize: fs(20), bold: true, color: C.text1, objectName: `a${i * 2 + 1}-t${i}` })
      Tx(s, S.s17.steps[i][1], { x: x + 0.3, y: y + 1.95, w: w - 0.6, h: 1.05, fontSize: fs(15), color: C.accent4, valign: 'top', objectName: `a${i * 2 + 1}-d${i}` })
      if (i < 2) s.addImage({ data: await icon('ArrowRight', HEX.gold), x: x + w + 0.15, y: y + 1.3, w: 0.5, h: 0.5, objectName: `a${i * 2 + 2}-fr${i}` } as any)
    }
    s.addNotes(S.s17.notes)
  }

  // 18. Chiusura
  {
    const s = pres.addSlide({ masterName: 'KUMANI copertina', sectionTitle: sec[6] })
    s.addImage({ path: `${IMG}/walk-together.jpg`, x: 0, y: 0, w: 13.333, h: 7.5, objectName: 'a1-foto' } as any)
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: C.text1, transparency: 35 }, line: { type: 'none' }, objectName: 'a1-velo' } as any)
    s.addImage({ path: LOGO, x: S.s18.cta ? 1.0 : 5.82, y: 0.9, w: 1.7, h: 1.7, objectName: 'a2-logo' } as any)
    if (!S.s18.cta) Tx(s, S.s18.title, { x: 1.0, y: 2.85, w: 11.33, h: 1.9, fontFace: 'Cambria', fontSize: fs(44), bold: true, align: 'center', color: C.background1, valign: 'middle', objectName: 'a3-titolo' })
    if (S.s18.cta) {
      // Invito all'azione e QR verso kumani.io
      Tx(s, S.s18.title, { x: 1.0, y: 2.7, w: 8.2, h: 1.9, fontFace: 'Cambria', fontSize: fs(40), bold: true, color: C.background1, valign: 'middle', objectName: 'a3-titolo2' })
      card(s, 1.0, 4.75, 8.2, 0.75, 'a4-cta', C.accent1)
      Tx(s, S.s18.cta, { x: 1.2, y: 4.75, w: 7.8, h: 0.75, fontSize: fs(20), bold: true, color: C.text1, valign: 'middle', objectName: 'a4-ctatx' })
      Tx(s, S.s18.contacts, { x: 1.0, y: 5.7, w: 8.2, h: 0.5, fontSize: 20, color: C.accent2, objectName: 'a5-contatti' })
      const qr = await QRCode.toDataURL(`https://kumani.io/${locale}`, { margin: 1, width: 600, color: { dark: '#171717', light: '#FFFFFF' } })
      card(s, 9.85, 2.75, 2.6, 3.05, 'a6-qrcard', C.background1)
      s.addImage({ data: 'image/png;base64,' + qr.split(',')[1], x: 10.05, y: 2.95, w: 2.2, h: 2.2, objectName: 'a6-qr' } as any)
      Tx(s, S.s18.qr, { x: 9.85, y: 5.22, w: 2.6, h: 0.45, fontSize: 14, bold: true, align: 'center', color: C.text1, objectName: 'a6-qrtx' })
    } else {
      Tx(s, S.s18.contacts, { x: 1.2, y: 5.05, w: 10.93, h: 0.6, fontSize: 22, align: 'center', color: C.accent2, objectName: 'a4-contatti' })
    }
    s.addNotes(S.s18.notes)
  }

  const raw = (await pres.write({ outputType: 'arraybuffer' })) as ArrayBuffer
  return finishDeck(raw)
}

// ---------- Tema e animazioni (ritocchi al file PowerPoint) ----------

const SLOTS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
const STEP_MS = 380
const GAP_MS = 120

function effect(ctn: { next: number }, spid: string, nodeType: string) {
  const a = ctn.next++, b = ctn.next++, c = ctn.next++
  return `<p:par><p:cTn id="${a}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="${nodeType}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    `<p:set><p:cBhvr><p:cTn id="${b}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>` +
    `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${c}" dur="${STEP_MS}"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>`
}

function timingXml(steps: string[][], textIds: string[]) {
  const ctn = { next: 4 }
  let groups = ''
  steps.forEach((ids, i) => {
    const gid = ctn.next++
    const inner = ids.map((spid, j) => effect(ctn, spid, j === 0 ? 'afterEffect' : 'withEffect')).join('')
    groups += `<p:par><p:cTn id="${gid}" fill="hold"><p:stCondLst><p:cond delay="${i * (STEP_MS + GAP_MS)}"/></p:stCondLst><p:childTnLst>${inner}</p:childTnLst></p:cTn></p:par>`
  })
  const bld = textIds.map((spid) => `<p:bldP spid="${spid}" grpId="0" animBg="1"/>`).join('')
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
    `<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>${groups}</p:childTnLst></p:cTn></p:par>` +
    `</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>` +
    `</p:childTnLst></p:cTn></p:par></p:tnLst>${bld ? `<p:bldLst>${bld}</p:bldLst>` : ''}</p:timing>`
}

async function finishDeck(raw: ArrayBuffer): Promise<Blob> {
  const zip = await JSZip.loadAsync(raw)
  // Colori del tema KUMANI
  const themePart = 'ppt/theme/theme1.xml'
  const theme = zip.file(themePart)
  if (theme) {
    const scheme = `<a:clrScheme name="KUMANI">` + SLOTS.map((s) => `<a:${s}><a:srgbClr val="${THEME_COLORS[s]}"/></a:${s}>`).join('') + '</a:clrScheme>'
    zip.file(themePart, (await theme.async('string')).replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, scheme))
  }
  // Dissolvenza tra le slide; gli oggetti "aN-…" entrano in ordine di N
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    let xml = await zip.file(name)!.async('string')
    // Caselle del modello rimaste vuote (le slide con le foto scrivono i
    // titoli da sole): in PowerPoint mostrerebbero «Fare clic per inserire il
    // testo» sopra i titoli veri, quindi si tolgono
    xml = xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph\b(?:(?!<\/p:sp>)[\s\S])*?<\/p:sp>/g, (sp) => (/<a:t>[^<]+<\/a:t>/.test(sp) ? sp : ''))
    const byStep = new Map<number, string[]>()
    const textIds: string[] = []
    for (const m of xml.matchAll(/<p:(sp|pic|cxnSp)>([\s\S]*?)<\/p:\1>/g)) {
      const nv = m[2].match(/<p:cNvPr id="(\d+)" name="([^"]*)"/)
      const step = nv?.[2].match(/^a(\d+)-/)
      if (!nv || !step) continue
      const n = Number(step[1])
      byStep.set(n, [...(byStep.get(n) ?? []), nv[1]])
      if (m[1] === 'sp' && m[2].includes('<p:txBody>') && m[2].includes('<a:t>')) textIds.push(nv[1])
    }
    const steps = [...byStep.keys()].sort((a, b) => a - b).map((n) => byStep.get(n)!)
    const add = '<p:transition spd="med"><p:fade/></p:transition>' + (steps.length ? timingXml(steps, textIds) : '')
    xml = xml.includes('</p:clrMapOvr>') ? xml.replace('</p:clrMapOvr>', '</p:clrMapOvr>' + add) : xml.replace('</p:sld>', add + '</p:sld>')
    zip.file(name, xml)
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE' })
}

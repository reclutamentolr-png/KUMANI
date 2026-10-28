'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, FileText, LoaderCircle, RotateCcw } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import {
  CLASSIC_BACKS,
  CLASSIC_FIELDS,
  CLASSIC_LAYOUTS,
  CLASSIC_LOGOS,
  CLASSIC_LOGO_SIZES,
  CLASSIC_PALETTES,
  CLASSIC_QR,
  CLASSIC_QR_TARGETS,
  isVertical,
  type ClassicField,
  type ClassicSettings,
  type ClassicSource,
} from '@/lib/businessCardClassic'
import { saveClassicCard } from '@/app/actions/businessCard'
import { businessWebsiteUrl } from '@/lib/businessProfile'
import ClassicCardCanvas, { classicSize, type CardColors } from './ClassicCardCanvas'
import { BLEED } from './BusinessCardCanvas'

// Biglietto classico: stile, colori, logo, lati, QR e dati da stampare.
// Ogni scelta si salva da sola; anteprima dal vivo, PDF per la tipografia
// (con il margine di taglio) e immagine.

export type BrandPalette = { primary: string; accent: string; background: string; text: string; onPrimary: string } | null

type Props = {
  initial: ClassicSettings
  source: ClassicSource
  brand: BrandPalette
  businessLogo: string | null
  urls: { card: string; bio: string; website: string | null }
}

const KUMANI_LOGO = '/brand/logo-gold-hd.png'

function colorsFor(settings: ClassicSettings, brand: BrandPalette): CardColors {
  if (settings.palette === 'brand' && brand)
    return { bg: brand.background, text: brand.text, accent: brand.primary, muted: brand.text, band: brand.primary, bandText: brand.onPrimary }
  if (settings.palette === 'white') return { bg: '#ffffff', text: '#1d1d1f', accent: '#a07a2c', muted: '#5f5f5f', band: '#1d1d1f', bandText: '#ffffff' }
  return { bg: '#0d0d0d', text: '#ffffff', accent: '#e3c06a', muted: '#bdbdbd', band: '#c79a3b', bandText: '#111111' }
}

export default function ClassicCardEditor({ initial, source, brand, businessLogo, urls }: Props) {
  const t = useTranslations('businessCard')
  const [s, setS] = useState<ClassicSettings>(initial)
  const [qrSvg, setQrSvg] = useState('')
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState(360)
  const front = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLDivElement>(null)
  const first = useRef(true)

  const set = (patch: Partial<ClassicSettings>) => setS((prev) => ({ ...prev, ...patch }))

  // Salvataggio automatico, un attimo dopo l'ultima modifica
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const timer = setTimeout(async () => {
      const r = await saveClassicCard('classic', s)
      if (r.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      } else setError(true)
    }, 600)
    return () => clearTimeout(timer)
  }, [s])

  // Dove porta il QR (il sito solo se c'è: quello scritto sul biglietto, se
  // corretto a mano, altrimenti quello della Scheda attività)
  const website = s.values.website ? businessWebsiteUrl(s.values.website) : urls.website
  const qrUrl = s.qrTarget === 'website' && website ? website : s.qrTarget === 'bio' ? urls.bio : urls.card
  useEffect(() => {
    if (s.qr === 'none') return
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toString(qrUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#00000000' } }))
      .then(setQrSvg)
  }, [qrUrl, s.qr])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setBoxW(el.clientWidth)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Dati stampati: corretti a mano oppure quelli del profilo
  const data = useMemo(() => Object.fromEntries(CLASSIC_FIELDS.map((f) => [f, s.values[f] || source[f] || ''])) as Record<ClassicField, string>, [s.values, source])
  const colors = colorsFor(s, brand)
  const logoUrl = s.logo === 'business' ? businessLogo : s.logo === 'kumani' ? KUMANI_LOGO : null
  const { w, h } = classicSize(s)
  const vertical = isVertical(s.layout)
  // Anteprima: i verticali un po' più stretti, così fronte e retro stanno nello schermo
  const scale = Math.min(boxW, vertical ? 300 : 620) / w
  const sides: ('front' | 'back')[] = s.sides === 'both' ? ['front', 'back'] : ['front']
  const refFor = (side: 'front' | 'back') => (side === 'front' ? front : back)

  const render = async (side: 'front' | 'back') => {
    const { toPng } = await import('html-to-image')
    await document.fonts.ready
    return toPng(refFor(side).current!, { width: w + BLEED * 2, height: h + BLEED * 2, pixelRatio: 2, cacheBust: true, style: { transform: 'none' } })
  }
  const download = (href: string, name: string) => {
    const a = document.createElement('a')
    a.href = href
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  const fileBase = `KUMANI_biglietto_classico_${s.layout}`

  const exportPdf = async () => {
    setBusy('pdf')
    setError(false)
    try {
      const { jsPDF } = await import('jspdf')
      // 85×55 mm (o 55×85 se verticale) + 2 mm di abbondanza per lato (come
      // chiedono le tipografie online): il disegno ha 3 mm, il millimetro in
      // più resta fuori pagina
      const size: [number, number] = vertical ? [59, 89] : [89, 59]
      const orientation = vertical ? 'portrait' : 'landscape'
      const pdf = new jsPDF({ unit: 'mm', format: size, orientation })
      for (const [i, side] of sides.entries()) {
        if (i > 0) pdf.addPage(size, orientation)
        pdf.addImage(await render(side), 'PNG', -1, -1, size[0] + 2, size[1] + 2, undefined, 'FAST')
      }
      download(URL.createObjectURL(pdf.output('blob')), `${fileBase}_stampa.pdf`)
    } catch (e) {
      console.error('[biglietto classico]', e)
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  const exportPng = async () => {
    setBusy('png')
    setError(false)
    try {
      for (const side of sides) {
        const img = new Image()
        img.src = await render(side)
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = w * 2
        canvas.height = h * 2
        canvas.getContext('2d')!.drawImage(img, BLEED * 2, BLEED * 2, w * 2, h * 2, 0, 0, w * 2, h * 2)
        download(canvas.toDataURL('image/png'), `${fileBase}${sides.length > 1 ? (side === 'front' ? '_fronte' : '_retro') : ''}.png`)
      }
    } catch (e) {
      console.error('[biglietto classico]', e)
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  const chip = (active: boolean, disabled?: boolean) =>
    `rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
      disabled ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400' : active ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-[var(--gold)]/20 bg-white text-[var(--ink)] hover:border-[var(--gold)]/60'
    }`
  const section = 'rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm'
  const title = 'font-bold text-[var(--ink)]'

  return (
    <div className="space-y-6">
      {/* Anteprima dal vivo */}
      <section className="space-y-3">
        <div ref={box} className="flex w-full flex-wrap gap-4">
          {sides.map((side) => (
            <div key={side}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{t(side === 'front' ? 'front' : 'backSide')}</p>
              <div className="relative overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5" style={{ width: w * scale, height: h * scale }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: w + BLEED * 2, height: h + BLEED * 2, marginLeft: -BLEED * scale, marginTop: -BLEED * scale }}>
                  <ClassicCardCanvas ref={refFor(side)} settings={s} side={side} data={data} colors={colors} qrSvg={s.qr === 'none' ? '' : qrSvg} logoUrl={logoUrl} texts={{ scanQr: t('classic.scanQr') }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={exportPdf} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-extrabold text-[var(--ink)] shadow-sm transition hover:brightness-105 disabled:opacity-60">
            {busy === 'pdf' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />} {busy === 'pdf' ? t('generating') : t('downloadPdf')}
          </button>
          <button type="button" onClick={exportPng} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-white px-5 py-3 font-bold text-[var(--ink)] transition hover:border-[var(--gold)] disabled:opacity-60">
            {busy === 'png' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5 text-[var(--gold)]" />} {busy === 'png' ? t('generating') : t('downloadImage')}
          </button>
          <span className="h-4 text-xs font-semibold text-emerald-700">{saved ? t('saved') : ''}</span>
        </div>
        <p className="text-xs text-[var(--muted)]">{t('printHint')}</p>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t('error')}</p>}
      </section>

      {/* Stile */}
      <section className={section}>
        <h2 className={title}>{t('classic.styleTitle')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CLASSIC_LAYOUTS.map((l) => (
            <button key={l} type="button" aria-pressed={s.layout === l} onClick={() => set({ layout: l })} className={chip(s.layout === l)}>
              {t(`classic.layout_${l}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Colori e logo */}
      <section className={`${section} space-y-4`}>
        <div>
          <h2 className={title}>{t('classic.colorsTitle')}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {CLASSIC_PALETTES.map((p) => (
              <button key={p} type="button" disabled={p === 'brand' && !brand} aria-pressed={s.palette === p} onClick={() => set({ palette: p })} className={chip(s.palette === p, p === 'brand' && !brand)}>
                {t(`classic.palette_${p}`)}
              </button>
            ))}
          </div>
          {!brand && (
            <Link href="/scheda-attivita/colori" className="mt-2 inline-block text-xs font-semibold text-[#8a6a1f] hover:underline">
              {t('classic.paletteBrandMissing')}
            </Link>
          )}
        </div>
        <div>
          <h2 className={title}>{t('classic.logoTitle')}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {CLASSIC_LOGOS.map((l) => (
              <button key={l} type="button" disabled={l === 'business' && !businessLogo} aria-pressed={s.logo === l} onClick={() => set({ logo: l })} className={chip(s.logo === l, l === 'business' && !businessLogo)}>
                {t(`classic.logo_${l}`)}
              </button>
            ))}
          </div>
          {!businessLogo && (
            <Link href="/scheda-attivita" className="mt-2 inline-block text-xs font-semibold text-[#8a6a1f] hover:underline">
              {t('classic.logoBusinessMissing')}
            </Link>
          )}
          {logoUrl && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-[var(--ink)]">{t('classic.logoSizeTitle')}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {CLASSIC_LOGO_SIZES.map((z) => (
                  <button key={z} type="button" aria-pressed={s.logoSize === z} onClick={() => set({ logoSize: z })} className={`${chip(s.logoSize === z)} flex items-center justify-center gap-2`}>
                    <span className="inline-block rounded-sm bg-current opacity-70" style={{ width: { S: 8, M: 12, L: 16 }[z], height: { S: 8, M: 12, L: 16 }[z] }} aria-hidden />
                    {t(`classic.logoSize_${z}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Lati, retro e QR */}
      <section className={`${section} space-y-4`}>
        <div>
          <h2 className={title}>{t('classic.sidesTitle')}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['front', 'both'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={s.sides === v} onClick={() => set({ sides: v, ...(v === 'front' && s.qr === 'back' ? { qr: 'front' as const } : {}) })} className={chip(s.sides === v)}>
                {t(`classic.sides_${v}`)}
              </button>
            ))}
          </div>
        </div>
        {s.sides === 'both' && (
          <div>
            <h2 className={title}>{t('classic.backTitle')}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CLASSIC_BACKS.map((b) => (
                <button key={b} type="button" aria-pressed={s.back === b} onClick={() => set({ back: b, ...(b === 'qr' && s.qr === 'none' ? { qr: 'back' as const } : {}) })} className={chip(s.back === b)}>
                  {t(`classic.back_${b}`)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <h2 className={title}>{t('classic.qrTitle')}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CLASSIC_QR.map((q) => (
              <button key={q} type="button" disabled={q === 'back' && s.sides !== 'both'} aria-pressed={s.qr === q} onClick={() => set({ qr: q })} className={chip(s.qr === q, q === 'back' && s.sides !== 'both')}>
                {t(`classic.qr_${q}`)}
              </button>
            ))}
          </div>
          {s.sides !== 'both' && <p className="mt-1.5 text-xs text-[var(--muted)]">{t('classic.qrBackNeedsBoth')}</p>}
          {s.qr !== 'none' && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{t('classic.qrTargetTitle')}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {CLASSIC_QR_TARGETS.map((q) => (
                  <button key={q} type="button" disabled={q === 'website' && !website} aria-pressed={s.qrTarget === q} onClick={() => set({ qrTarget: q })} className={chip(s.qrTarget === q, q === 'website' && !website)}>
                    {t(`classic.qrTarget_${q}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Dati da stampare */}
      <section className={section}>
        <h2 className={title}>{t('classic.fieldsTitle')}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('classic.fieldsHint')}</p>
        <div className="mt-4 space-y-2">
          {CLASSIC_FIELDS.map((f) => (
            <div key={f} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${s.fields[f] ? 'border-[var(--gold)]/40 bg-[var(--gold-pale)]/30' : 'border-gray-200'}`}>
              <input
                id={`cf-${f}`}
                type="checkbox"
                checked={s.fields[f]}
                onChange={(e) => set({ fields: { ...s.fields, [f]: e.target.checked } })}
                className="h-5 w-5 shrink-0 accent-[var(--gold)]"
              />
              <label htmlFor={`cf-${f}`} className="w-28 shrink-0 text-sm font-semibold text-[var(--ink)] sm:w-40">
                {t(`classic.field_${f}`)}
              </label>
              <input
                value={s.values[f] ?? ''}
                placeholder={source[f] || t('classic.fieldEmpty')}
                maxLength={120}
                onChange={(e) => set({ values: { ...s.values, [f]: e.target.value } })}
                className="min-w-0 flex-1 rounded-lg border border-[var(--gold)]/25 bg-white px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none"
              />
              {s.values[f] && (
                <button
                  type="button"
                  onClick={() => {
                    const { [f]: _removed, ...rest } = s.values
                    void _removed
                    set({ values: rest })
                  }}
                  aria-label={t('classic.fieldReset')}
                  title={t('classic.fieldReset')}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--gold-pale)] hover:text-[var(--ink)]"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <label className="mt-4 block text-sm font-semibold text-[var(--ink)]" htmlFor="cf-slogan">
          {t('classic.sloganTitle')}
        </label>
        <input
          id="cf-slogan"
          value={s.slogan}
          maxLength={90}
          placeholder={t('classic.sloganPlaceholder')}
          onChange={(e) => set({ slogan: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[var(--gold)]/25 bg-white px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none"
        />
      </section>
    </div>
  )
}

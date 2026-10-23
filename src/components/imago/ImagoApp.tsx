'use client'

import { useEffect, useRef, useState } from 'react'
import localFont from 'next/font/local'
import { useTranslations } from 'next-intl'
import { Download, ImagePlus, Share2, X } from 'lucide-react'
import { imagoDone } from '@/app/actions/imago'
import { drawImago, IMAGO_FIELDS, IMAGO_FORMATS, IMAGO_PRESETS, IMAGO_TEMPLATES, type ImagoFormat, type ImagoPalette, type ImagoTemplate, type ImagoTexts } from '@/lib/imago'

// Caratteri dentro il progetto, come i volantini: la tela li usa anche offline
const inter = localFont({ src: '../../fonts/Inter.woff2', weight: '100 900' })
const playfair = localFont({ src: '../../fonts/PlayfairDisplay.woff2', weight: '400 900', style: 'normal' })

type Img = { el: HTMLImageElement; size: [number, number] }
const loadImage = (src: string) =>
  new Promise<Img>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve({ el, size: [el.naturalWidth, el.naturalHeight] })
    el.onerror = reject
    el.src = src
  })

// KUMANI IMAGO: grafiche per post e storie con i colori e il logo della
// Scheda attività. Tutto nel browser: l'immagine si scarica o si condivide.
export default function ImagoApp({ brandName, contact, logoUrl, hours, brandPalette }: { brandName: string; contact: string; logoUrl: string | null; hours: string; brandPalette: ImagoPalette | null }) {
  const t = useTranslations('imago')
  const [template, setTemplate] = useState<ImagoTemplate>('offer')
  const [format, setFormat] = useState<ImagoFormat>('post')
  const defaults = (tpl: ImagoTemplate): ImagoTexts => ({
    badge: t(`default_${tpl}_badge`),
    highlight: tpl === 'offer' ? t('default_offer_highlight') : '',
    title: t(`default_${tpl}_title`),
    subtitle: t(`default_${tpl}_subtitle`),
    detail: tpl === 'hours' ? hours || t('default_hours_detail') : tpl === 'event' ? t('default_event_detail') : '',
    note: t(`default_${tpl}_note`),
  })
  const [texts, setTexts] = useState<ImagoTexts>(() => defaults('offer'))
  const [paletteKey, setPaletteKey] = useState(brandPalette ? 'brand' : 'kumani')
  const [photo, setPhoto] = useState<Img | null>(null)
  const [logo, setLogo] = useState<Img | null>(null)
  const [showLogo, setShowLogo] = useState(true)
  const [name, setName] = useState(brandName)
  const [contactText, setContactText] = useState(contact)
  const [result, setResult] = useState<{ url: string; blob: Blob } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [W, H] = IMAGO_FORMATS[format]
  const palette = paletteKey === 'brand' && brandPalette ? brandPalette : IMAGO_PRESETS[paletteKey] ?? IMAGO_PRESETS.kumani

  useEffect(() => {
    if (!logoUrl) return
    loadImage(logoUrl)
      .then(setLogo)
      .catch(() => {})
  }, [logoUrl])

  // Disegno (anteprima = immagine finale) ogni volta che cambia qualcosa
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    const fams = [inter.style.fontFamily, playfair.style.fontFamily]
    Promise.all(fams.map((f) => document.fonts.load(`700 40px ${f}`)))
      .catch(() => {})
      .finally(() => setFontsReady(true))
  }, [])
  useEffect(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    c.width = W
    c.height = H
    drawImago(ctx, W, H, {
      template,
      texts,
      palette,
      photo: photo?.el ?? null,
      photoSize: photo?.size ?? null,
      logo: showLogo && logo ? logo.el : null,
      logoSize: showLogo && logo ? logo.size : null,
      brandName: name.trim(),
      contact: contactText.trim(),
      fonts: { sans: inter.style.fontFamily, serif: playfair.style.fontFamily },
    })
  }, [template, texts, palette, photo, logo, showLogo, name, contactText, W, H, fontsReady])

  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url)
    },
    [result]
  )

  const pickTemplate = (tpl: ImagoTemplate) => {
    setTemplate(tpl)
    setTexts(defaults(tpl))
    setResult(null)
  }
  const pickPhoto = (file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    loadImage(url)
      .then(setPhoto)
      .catch(() => {})
  }
  const exportImage = () => {
    canvasRef.current?.toBlob(
      (blob) => {
        if (!blob) return
        setResult({ url: URL.createObjectURL(blob), blob })
        void imagoDone()
      },
      'image/png'
    )
  }
  const share = async () => {
    if (!result) return
    try {
      await navigator.share({ files: [new File([result.blob], `kumani-imago-${format}.png`, { type: 'image/png' })] })
    } catch {
      // annullato
    }
  }
  const canShare = (() => {
    if (!result || typeof navigator === 'undefined' || !navigator.canShare) return false
    try {
      return navigator.canShare({ files: [new File([result.blob], 'imago.png', { type: 'image/png' })] })
    } catch {
      return false
    }
  })()

  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 text-gray-600 hover:border-[var(--gold)]/60'}`
  const field = 'mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-base text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none'
  const fields = IMAGO_FIELDS[template]
  const swatches: [string, ImagoPalette][] = [...(brandPalette ? ([['brand', brandPalette]] as [string, ImagoPalette][]) : []), ...Object.entries(IMAGO_PRESETS)]

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="order-2 space-y-4 lg:order-1">
        <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
          <p className="text-sm font-semibold text-[var(--ink)]">{t('template')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {IMAGO_TEMPLATES.map((tpl) => (
              <button key={tpl} type="button" aria-pressed={template === tpl} onClick={() => pickTemplate(tpl)} className={chip(template === tpl)}>
                {t(`template_${tpl}`)}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('format')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(IMAGO_FORMATS) as ImagoFormat[]).map((f) => (
              <button key={f} type="button" aria-pressed={format === f} onClick={() => { setFormat(f); setResult(null) }} className={chip(format === f)}>
                {t(`format_${f}`)}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
          <p className="font-bold text-[var(--ink)]">{t('textsTitle')}</p>
          {fields.map((k) => (
            <label key={k} className="mt-3 block text-sm font-semibold text-[var(--ink)]">
              {t(k === 'detail' && template === 'hours' ? 'field_hours' : `field_${k}`)}
              {k === 'subtitle' || k === 'detail' || (k === 'title' && template === 'quote') ? (
                <textarea
                  value={texts[k]}
                  rows={k === 'detail' ? 4 : 3}
                  onChange={(e) => { setTexts((x) => ({ ...x, [k]: e.target.value.slice(0, 400) })); setResult(null) }}
                  className={field}
                />
              ) : (
                <input value={texts[k]} onChange={(e) => { setTexts((x) => ({ ...x, [k]: e.target.value.slice(0, 120) })); setResult(null) }} className={field} />
              )}
            </label>
          ))}
        </section>

        <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
          <p className="font-bold text-[var(--ink)]">{t('lookTitle')}</p>
          <div className="mt-3">
            {photo ? (
              <button type="button" onClick={() => { setPhoto(null); setResult(null) }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 underline">
                <X className="h-4 w-4" /> {t('photoRemove')}
              </button>
            ) : (
              <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--gold)]/50 px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold)]/5">
                <ImagePlus className="h-4 w-4 text-[var(--gold)]" /> {t('photoAdd')}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { pickPhoto(e.target.files?.[0]); setResult(null) }} />
              </label>
            )}
            <p className="mt-1 text-xs text-[var(--muted)]">{t('photoNote')}</p>
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('colors')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {swatches.map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setPaletteKey(key); setResult(null) }}
                aria-pressed={paletteKey === key}
                title={key === 'brand' ? t('brandColors') : key}
                className={`flex h-10 items-center gap-1 rounded-full border-2 px-1.5 ${paletteKey === key ? 'border-[var(--ink)]' : 'border-gray-200'}`}
              >
                <span className="h-6 w-6 rounded-full" style={{ background: p.bg }} />
                <span className="h-6 w-6 rounded-full" style={{ background: p.accent }} />
                {key === 'brand' && <span className="pr-1 text-xs font-bold">{t('brandColors')}</span>}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[var(--ink)]">
              {t('brandName')}
              <input value={name} onChange={(e) => { setName(e.target.value.slice(0, 40)); setResult(null) }} className={field} />
            </label>
            <label className="block text-sm font-semibold text-[var(--ink)]">
              {t('contact')}
              <input value={contactText} onChange={(e) => { setContactText(e.target.value.slice(0, 70)); setResult(null) }} placeholder={t('contactPlaceholder')} className={field} />
            </label>
          </div>
          {logo && (
            <label className="mt-3 flex items-center gap-3 text-sm font-semibold text-[var(--ink)]">
              <input type="checkbox" checked={showLogo} onChange={(e) => { setShowLogo(e.target.checked); setResult(null) }} className="h-5 w-5 accent-[var(--gold)]" />
              {t('showLogo')}
            </label>
          )}
          {!logoUrl && !brandPalette && <p className="mt-3 text-xs text-[var(--muted)]">{t('profileHint')}</p>}
        </section>
      </div>

      <aside className="order-1 lg:order-2">
        <div className="space-y-3 lg:sticky lg:top-24">
          <canvas ref={canvasRef} aria-label={t('preview')} className="mx-auto block w-full max-w-[20rem] rounded-2xl shadow-lg" />
          {result ? (
            <div className="space-y-2">
              <a href={result.url} download={`kumani-imago-${format}.png`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 font-extrabold text-[var(--ink)]">
                <Download className="h-5 w-5" /> {t('download')}
              </a>
              {canShare && (
                <button type="button" onClick={share} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-white px-4 font-bold">
                  <Share2 className="h-5 w-5" /> {t('share')}
                </button>
              )}
            </div>
          ) : (
            <button type="button" onClick={exportImage} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-extrabold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]">
              <Download className="h-5 w-5" /> {t('create')}
            </button>
          )}
          <p className="text-center text-xs text-[var(--muted)]">{t('privacy')}</p>
        </div>
      </aside>
    </div>
  )
}

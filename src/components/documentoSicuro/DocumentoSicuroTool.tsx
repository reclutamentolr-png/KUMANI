'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Camera,
  CalendarClock,
  CheckCircle2,
  Download,
  Eraser,
  ImagePlus,
  Loader2,
  MapPin,
  RotateCcw,
  Share2,
  ShieldCheck,
  Smartphone,
  Square,
  Stamp,
  Undo2,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { completeDocumentoSicuro } from '@/app/actions/documentoSicuro'
import { exifDateToDate, parseExif, type ExifSummary } from './exif'
import { canvasToJpeg, decodeImage, exportFileName, renderDocument, type Rect, type WatermarkColor } from './canvas'

type Loaded = { base: HTMLCanvasElement; exif: ExifSummary; today: string; takenAt: string | null }
type Preset = 'affitto' | 'banca' | 'lavoro' | 'acquisto' | 'altro'

const PRESETS: { key: Preset; label: string; value: string | null }[] = [
  { key: 'affitto', label: 'presetAffitto', value: 'presetAffittoValue' },
  { key: 'banca', label: 'presetBanca', value: 'presetBancaValue' },
  { key: 'lavoro', label: 'presetLavoro', value: 'presetLavoroValue' },
  { key: 'acquisto', label: 'presetAcquisto', value: 'presetAcquistoValue' },
  { key: 'altro', label: 'presetAltro', value: null },
]
const COLORS: { key: WatermarkColor; label: string; swatch: string }[] = [
  { key: 'dark', label: 'colorDark', swatch: 'bg-neutral-900' },
  { key: 'light', label: 'colorLight', swatch: 'bg-white' },
  { key: 'red', label: 'colorRed', swatch: 'bg-red-600' },
]
const MIN_RECT = 0.01

// Condivisione di file supportata? (solo nel browser, mai durante il rendering sul server)
const noopSubscribe = () => () => {}
const canShareFiles = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export default function DocumentoSicuroTool() {
  const t = useTranslations('documentoSicuro')
  const locale = useLocale()
  const shareSupported = useSyncExternalStore(noopSubscribe, canShareFiles, () => false)

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rects, setRects] = useState<Rect[]>([])
  const [draft, setDraft] = useState<Rect | null>(null)
  const [hideMode, setHideMode] = useState(false)
  const [purpose, setPurpose] = useState('')
  const [customText, setCustomText] = useState<string | null>(null)
  const [opacity, setOpacity] = useState(35)
  const [size, setSize] = useState(4)
  const [color, setColor] = useState<WatermarkColor>('dark')
  const [busy, setBusy] = useState<'download' | 'share' | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const purposeRef = useRef<HTMLInputElement>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const awarded = useRef(false)

  const suggestedText = loaded
    ? purpose.trim()
      ? t('watermarkDefault', { purpose: purpose.trim(), date: loaded.today })
      : t('watermarkDefaultNoPurpose', { date: loaded.today })
    : ''
  const watermarkText = customText ?? suggestedText

  // Ridisegna la copia protetta a ogni modifica (la bozza del rettangolo è un riquadro CSS a parte)
  useEffect(() => {
    if (!loaded || !canvasRef.current) return
    renderDocument(canvasRef.current, loaded.base, rects, { text: watermarkText, opacity: opacity / 100, size, color })
  }, [loaded, rects, watermarkText, opacity, size, color])

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const [base, head] = await Promise.all([decodeImage(file), file.slice(0, 512 * 1024).arrayBuffer()])
      const exif = parseExif(head)
      const now = new Date()
      const dateFormat = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
      const taken = exif.dateTime ? exifDateToDate(exif.dateTime) : null
      setLoaded({
        base,
        exif,
        today: dateFormat.format(now),
        takenAt: taken ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(taken) : null,
      })
      setRects([])
      setDraft(null)
      setCustomText(null)
      setHideMode(false)
    } catch {
      setError(t('errorDecode'))
    } finally {
      setLoading(false)
    }
  }

  const pointToImage = (event: ReactPointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: clamp01((event.clientX - box.left) / box.width), y: clamp01((event.clientY - box.top) / box.height) }
  }
  const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  })

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hideMode || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointToImage(event)
    dragStart.current = point
    setDraft({ ...point, w: 0, h: 0 })
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    setDraft(rectFrom(dragStart.current, pointToImage(event)))
  }
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return
    const rect = rectFrom(dragStart.current, pointToImage(event))
    dragStart.current = null
    setDraft(null)
    if (rect.w >= MIN_RECT && rect.h >= MIN_RECT) setRects((current) => [...current, rect])
  }
  const onPointerCancel = () => {
    dragStart.current = null
    setDraft(null)
  }

  const choosePreset = (preset: (typeof PRESETS)[number]) => {
    setCustomText(null)
    if (preset.value) {
      setPurpose(t(preset.value))
    } else {
      setPurpose('')
      purposeRef.current?.focus()
    }
  }

  const rewardOnce = () => {
    if (awarded.current) return
    awarded.current = true
    void completeDocumentoSicuro().catch(() => {})
  }

  const download = async () => {
    if (!canvasRef.current) return
    setBusy('download')
    setNotice(null)
    try {
      const blob = await canvasToJpeg(canvasRef.current)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = exportFileName()
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setNotice({ kind: 'ok', text: t('downloadDone') })
      rewardOnce()
    } catch {
      setNotice({ kind: 'error', text: t('exportError') })
    } finally {
      setBusy(null)
    }
  }

  const share = async () => {
    if (!canvasRef.current) return
    setBusy('share')
    setNotice(null)
    try {
      const blob = await canvasToJpeg(canvasRef.current)
      const file = new File([blob], exportFileName(), { type: 'image/jpeg' })
      if (!navigator.canShare({ files: [file] })) {
        setNotice({ kind: 'error', text: t('shareUnsupported') })
        return
      }
      await navigator.share({ files: [file], title: t('shareTitle') })
      setNotice({ kind: 'ok', text: t('shareDone') })
      rewardOnce()
    } catch (err) {
      // chiusura del menu di condivisione da parte dell'utente: non è un errore
      if (!(err instanceof DOMException && err.name === 'AbortError')) setNotice({ kind: 'error', text: t('shareError') })
    } finally {
      setBusy(null)
    }
  }

  const exif = loaded?.exif
  const device = exif ? [exif.make, exif.model].filter(Boolean).join(' ').trim() : ''
  const deviceText = exif?.make && exif.model?.toLowerCase().startsWith(exif.make.toLowerCase()) ? exif.model : device
  const foundSomething = !!exif && (exif.hasGps || !!deviceText || !!loaded?.takenAt)

  const card = 'rounded-3xl border border-[var(--gold)]/20 bg-[var(--paper)] p-5 shadow-sm sm:p-6'
  const cardTitle = 'mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--ink)]'
  const chip = 'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]'
  const secondaryButton =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--ink)]/15 bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-600/25 bg-emerald-50 p-4 text-sm text-emerald-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">{t('privacyTitle')}</strong> {t('privacyText')}
        </p>
      </div>

      {/* 1. Scelta della foto */}
      <section className={card} aria-labelledby="ds-pick">
        <h3 id="ds-pick" className={cardTitle}>
          <ImagePlus className="h-5 w-5 text-[var(--gold)]" aria-hidden />
          {loaded ? t('changeTitle') : t('pickTitle')}
        </h3>
        {!loaded && <p className="mb-4 text-sm text-[var(--muted)]">{t('pickText')}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-semibold text-[var(--gold-bright)] transition-opacity hover:opacity-90 focus-within:ring-2 focus-within:ring-[var(--gold)]">
            <ImagePlus className="h-5 w-5" aria-hidden />
            {t('pickButton')}
            <input type="file" accept="image/*" className="sr-only" onChange={onFile} disabled={loading} />
          </label>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--gold)] px-5 py-3 font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)] focus-within:ring-2 focus-within:ring-[var(--gold)] sm:hidden">
            <Camera className="h-5 w-5" aria-hidden />
            {t('cameraButton')}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} disabled={loading} />
          </label>
        </div>
        {loading && (
          <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('loading')}
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        )}
      </section>

      {loaded && exif && (
        <>
          {/* 2. Dati nascosti */}
          <section className={card} aria-labelledby="ds-meta">
            <h3 id="ds-meta" className={cardTitle}>
              <Smartphone className="h-5 w-5 text-[var(--gold)]" aria-hidden />
              {t('metaTitle')}
            </h3>
            {foundSomething ? (
              <ul className="space-y-2 text-sm">
                {exif.hasGps && (
                  <li className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-red-900">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      <strong className="font-semibold">{t('metaGps')}</strong>
                      {exif.latitude !== null && exif.longitude !== null && (
                        <span className="block text-red-800/80">
                          {t('metaGpsCoords', { lat: exif.latitude.toFixed(4), lon: exif.longitude.toFixed(4) })}
                        </span>
                      )}
                    </span>
                  </li>
                )}
                {deviceText && (
                  <li className="flex items-start gap-2 rounded-xl bg-[var(--gold-pale)]/60 p-3 text-[var(--ink)]">
                    <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {t('metaCamera', { model: deviceText })}
                  </li>
                )}
                {loaded.takenAt && (
                  <li className="flex items-start gap-2 rounded-xl bg-[var(--gold-pale)]/60 p-3 text-[var(--ink)]">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {t('metaDate', { date: loaded.takenAt })}
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">{t('metaNone')}</p>
            )}
            <p className="mt-3 flex items-start gap-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t('metaRemoved')}
            </p>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            {/* Anteprima con le zone oscurate */}
            <section className={`${card} lg:sticky lg:top-24`} aria-labelledby="ds-preview">
              <h3 id="ds-preview" className={cardTitle}>
                <Square className="h-5 w-5 fill-[var(--ink)] text-[var(--ink)]" aria-hidden />
                {t('previewTitle')}
              </h3>
              <p className="mb-3 text-sm text-[var(--muted)]">{t('hideHint')}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setHideMode((current) => !current)}
                  aria-pressed={hideMode}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    hideMode ? 'bg-[var(--gold)] text-[var(--ink)]' : 'bg-[var(--ink)] text-[var(--gold-bright)]'
                  }`}
                >
                  <Square className="h-4 w-4 fill-current" aria-hidden />
                  {hideMode ? t('hideModeOff') : t('hideModeOn')}
                </button>
                <button type="button" onClick={() => setRects((current) => current.slice(0, -1))} disabled={!rects.length} className={secondaryButton}>
                  <Undo2 className="h-4 w-4" aria-hidden />
                  {t('undo')}
                </button>
                <button type="button" onClick={() => setRects([])} disabled={!rects.length} className={secondaryButton}>
                  <Eraser className="h-4 w-4" aria-hidden />
                  {t('clearAll')}
                </button>
              </div>
              {hideMode && (
                <p className="mb-3 rounded-xl bg-[var(--gold-pale)] p-3 text-sm text-[var(--ink)]" role="status">
                  {t('hideModeActive')}
                </p>
              )}
              <div
                className={`relative overflow-hidden rounded-2xl border border-[var(--ink)]/10 bg-neutral-100 ${hideMode ? 'cursor-crosshair touch-none select-none' : ''}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerCancel}
              >
                <canvas ref={canvasRef} role="img" aria-label={t('previewAlt', { count: rects.length })} className="block h-auto w-full" />
                {draft && (
                  <div
                    className="pointer-events-none absolute border-2 border-[var(--gold-bright)] bg-black/70"
                    style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }}
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">{t('hiddenCount', { count: rects.length })}</p>
            </section>

            <div className="space-y-6">
              {/* 3. Filigrana */}
              <section className={card} aria-labelledby="ds-watermark">
                <h3 id="ds-watermark" className={cardTitle}>
                  <Stamp className="h-5 w-5 text-[var(--gold)]" aria-hidden />
                  {t('watermarkTitle')}
                </h3>
                <p className="mb-4 text-sm text-[var(--muted)]">{t('watermarkIntro')}</p>

                <p className="mb-2 text-sm font-medium text-[var(--ink)]" id="ds-presets">
                  {t('presetsLabel')}
                </p>
                <div className="mb-4 flex flex-wrap gap-2" role="group" aria-labelledby="ds-presets">
                  {PRESETS.map((preset) => {
                    const active = preset.value ? purpose === t(preset.value) : false
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => choosePreset(preset)}
                        aria-pressed={active}
                        className={`${chip} ${active ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--ink)]' : 'border-[var(--ink)]/15 bg-white text-[var(--ink)] hover:border-[var(--gold)]'}`}
                      >
                        {t(preset.label)}
                      </button>
                    )
                  })}
                </div>

                <label htmlFor="ds-purpose" className="mb-1 block text-sm font-medium text-[var(--ink)]">
                  {t('purposeLabel')}
                </label>
                <input
                  id="ds-purpose"
                  ref={purposeRef}
                  type="text"
                  value={purpose}
                  maxLength={60}
                  onChange={(event) => {
                    setPurpose(event.target.value)
                    setCustomText(null)
                  }}
                  placeholder={t('purposePlaceholder')}
                  className="mb-4 w-full rounded-xl border border-[var(--ink)]/15 bg-white px-3 py-2.5 text-base text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/40"
                />

                <label htmlFor="ds-text" className="mb-1 block text-sm font-medium text-[var(--ink)]">
                  {t('textLabel')}
                </label>
                <textarea
                  id="ds-text"
                  value={watermarkText}
                  maxLength={140}
                  rows={3}
                  onChange={(event) => setCustomText(event.target.value)}
                  aria-describedby="ds-text-help"
                  className="w-full rounded-xl border border-[var(--ink)]/15 bg-white px-3 py-2.5 text-base text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/40"
                />
                <div className="mb-4 mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p id="ds-text-help" className="text-xs text-[var(--muted)]">
                    {t('textHelp')}
                  </p>
                  {customText !== null && (
                    <button type="button" onClick={() => setCustomText(null)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)] hover:underline">
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      {t('resetText')}
                    </button>
                  )}
                </div>

                <label htmlFor="ds-opacity" className="mb-1 flex justify-between text-sm font-medium text-[var(--ink)]">
                  <span>{t('opacityLabel')}</span>
                  <span className="text-[var(--muted)]">{t('percent', { value: opacity })}</span>
                </label>
                <input
                  id="ds-opacity"
                  type="range"
                  min={10}
                  max={80}
                  step={5}
                  value={opacity}
                  onChange={(event) => setOpacity(Number(event.target.value))}
                  className="mb-4 w-full accent-[var(--gold)]"
                />

                <label htmlFor="ds-size" className="mb-1 flex justify-between text-sm font-medium text-[var(--ink)]">
                  <span>{t('sizeLabel')}</span>
                  <span className="text-[var(--muted)]">{t('sizeValue', { value: size })}</span>
                </label>
                <input
                  id="ds-size"
                  type="range"
                  min={2}
                  max={9}
                  step={1}
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                  className="mb-4 w-full accent-[var(--gold)]"
                />

                <p className="mb-2 text-sm font-medium text-[var(--ink)]" id="ds-color">
                  {t('colorLabel')}
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="ds-color">
                  {COLORS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      role="radio"
                      aria-checked={color === option.key}
                      onClick={() => setColor(option.key)}
                      className={`${chip} inline-flex items-center gap-2 ${color === option.key ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-[var(--ink)]/15 bg-white text-[var(--ink)] hover:border-[var(--gold)]'}`}
                    >
                      <span className={`h-4 w-4 rounded-full border border-black/20 ${option.swatch}`} aria-hidden />
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              </section>

              {/* 4. Download e condivisione */}
              <section className={card} aria-labelledby="ds-export">
                <h3 id="ds-export" className={cardTitle}>
                  <Download className="h-5 w-5 text-[var(--gold)]" aria-hidden />
                  {t('exportTitle')}
                </h3>
                <p className="mb-4 text-sm text-[var(--muted)]">{t('exportText')}</p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={download}
                    disabled={busy !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-semibold text-[var(--gold-bright)] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === 'download' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Download className="h-5 w-5" aria-hidden />}
                    {t('downloadButton')}
                  </button>
                  {shareSupported && (
                    <button
                      type="button"
                      onClick={share}
                      disabled={busy !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--gold)] px-5 py-3 font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)] disabled:opacity-50"
                    >
                      {busy === 'share' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Share2 className="h-5 w-5" aria-hidden />}
                      {t('shareButton')}
                    </button>
                  )}
                </div>
                {notice && (
                  <p
                    className={`mt-3 text-sm font-medium ${notice.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`}
                    role={notice.kind === 'ok' ? 'status' : 'alert'}
                  >
                    {notice.text}
                  </p>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      {/* Consigli */}
      <section className="rounded-3xl bg-[var(--ink)] p-5 text-white sm:p-6" aria-labelledby="ds-tips">
        <h3 id="ds-tips" className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--gold-bright)]">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          {t('tipsTitle')}
        </h3>
        <ul className="space-y-2 text-sm text-white/80">
          {(['tip1', 'tip2', 'tip3', 'tip4'] as const).map((key) => (
            <li key={key} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" aria-hidden />
              {t(key)}
            </li>
          ))}
        </ul>
        <Link
          href="/marketplace/antitruffa"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/50 px-4 py-2.5 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:bg-[var(--gold)]/15"
        >
          {t('antitruffaLink')}
        </Link>
      </section>
    </div>
  )
}

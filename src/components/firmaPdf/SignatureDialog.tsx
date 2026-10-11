'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Keyboard, PenLine, Upload, X } from 'lucide-react'
import { INK_COLORS, SIGNATURE_UPLOAD_MAX, imageToSignature, textToPng, trimCanvas, type InkColor } from '@/lib/firmaPdf'

type Tab = 'type' | 'draw' | 'upload'
export type SignatureResult = { png: string; ratio: number }

const tabBtn = 'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold transition'

// Finestra «La tua firma»: digitata, disegnata o caricata da una foto.
// Firma solo chi sta usando KUMANI: niente firmatari esterni.
export default function SignatureDialog({
  fonts,
  defaultName,
  saved,
  onClose,
  onDone,
}: {
  fonts: { family: string; label: string }[]
  defaultName: string
  saved: SignatureResult | null
  onClose: () => void
  onDone: (result: SignatureResult, remember: boolean) => void
}) {
  const t = useTranslations('firmaPdf')
  const [tab, setTab] = useState<Tab>('type')
  const [name, setName] = useState(defaultName)
  const [font, setFont] = useState(0)
  const [color, setColor] = useState<InkColor>('blue')
  const [typed, setTyped] = useState<SignatureResult | null>(null)
  const [drawn, setDrawn] = useState(false)
  const [uploaded, setUploaded] = useState<SignatureResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [remember, setRemember] = useState(!!saved)
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ x: number; y: number } | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Anteprima della firma digitata
  useEffect(() => {
    let cancelled = false
    const family = fonts[font]?.family ?? 'cursive'
    textToPng(name, family, INK_COLORS[color]).then((r) => {
      if (!cancelled) setTyped(r)
    })
    return () => {
      cancelled = true
    }
  }, [name, font, color, fonts])

  // Esc chiude; il fuoco entra nella finestra
  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Tela per disegnare: risoluzione doppia per un tratto pulito
  useEffect(() => {
    if (tab !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * 2)
    canvas.height = Math.round(rect.height * 2)
    setDrawn(false)
  }, [tab])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width, y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height }
  }
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = point(e)
    const ctx = e.currentTarget.getContext('2d')
    if (ctx) {
      ctx.fillStyle = INK_COLORS[color]
      ctx.beginPath()
      ctx.arc(drawing.current.x, drawing.current.y, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    setDrawn(true)
  }
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    const next = point(e)
    ctx.strokeStyle = INK_COLORS[color]
    ctx.lineWidth = 5.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(drawing.current.x, drawing.current.y)
    ctx.lineTo(next.x, next.y)
    ctx.stroke()
    drawing.current = next
  }
  const endDraw = () => {
    drawing.current = null
  }

  const clear = () => {
    if (tab === 'type') setName('')
    if (tab === 'draw') {
      const canvas = canvasRef.current
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      setDrawn(false)
    }
    if (tab === 'upload') {
      setUploaded(null)
      setUploadError(null)
    }
  }

  const onUpload = async (file: File | undefined) => {
    setUploadError(null)
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setUploadError(t('uploadType'))
      return
    }
    if (file.size > SIGNATURE_UPLOAD_MAX) {
      setUploadError(t('uploadSize'))
      return
    }
    const result = await imageToSignature(file)
    if (!result) setUploadError(t('uploadEmpty'))
    setUploaded(result)
  }

  const ready = tab === 'type' ? !!typed : tab === 'draw' ? drawn : !!uploaded

  const confirm = async () => {
    setBusy(true)
    let result: SignatureResult | null = null
    if (tab === 'type') result = typed
    else if (tab === 'upload') result = uploaded
    else if (canvasRef.current) {
      const trimmed = trimCanvas(canvasRef.current, 10)
      if (trimmed) result = { png: trimmed.toDataURL('image/png'), ratio: trimmed.height / trimmed.width }
    }
    setBusy(false)
    if (result) onDone(result, remember)
  }

  const tabs: { id: Tab; icon: typeof Keyboard; label: string }[] = [
    { id: 'type', icon: Keyboard, label: t('tabType') },
    { id: 'draw', icon: PenLine, label: t('tabDraw') },
    { id: 'upload', icon: Upload, label: t('tabUpload') },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-title"
        className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sign-title" className="text-xl font-extrabold text-[var(--ink)]">
              {t('signTitle')}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('signText')}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[var(--background)]" aria-label={t('cancel')}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {saved && (
          <button
            type="button"
            onClick={() => onDone(saved, true)}
            className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/50 p-3 text-left hover:bg-[var(--gold-pale)]"
          >
            <span className="text-sm font-bold text-[var(--ink)]">{t('useSaved')}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={saved.png} alt="" className="h-10 max-w-[50%] object-contain" />
          </button>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label={t('signTitle')}>
            {tabs.map(({ id, icon: Icon, label }) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`${tabBtn} ${tab === id ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'text-[var(--ink)] hover:bg-[var(--background)]'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={clear} className="min-h-11 px-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">
            {t('clear')}
          </button>
        </div>

        {tab !== 'upload' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
            {t('ink')}
            {(Object.keys(INK_COLORS) as InkColor[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                aria-label={t(`inks.${c}`)}
                className={`h-8 w-8 rounded-full border-2 ${color === c ? 'border-[var(--gold)] ring-2 ring-[var(--gold)]/40' : 'border-white shadow'}`}
                style={{ background: INK_COLORS[c] }}
              />
            ))}
          </div>
        )}

        <div className="mt-3">
          {tab === 'type' && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-[var(--muted)]">
                {t('typeLabel')}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                  className="mt-1 block min-h-12 w-full rounded-xl border border-[var(--gold)]/35 px-3 text-base text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
                  placeholder={t('typePlaceholder')}
                  autoComplete="name"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {fonts.map((f, i) => (
                  <button
                    key={f.family}
                    type="button"
                    onClick={() => setFont(i)}
                    aria-pressed={font === i}
                    aria-label={f.label}
                    className={`flex min-h-20 items-center justify-center overflow-hidden rounded-2xl border-2 bg-[var(--background)] px-3 text-3xl ${font === i ? 'border-[var(--gold)]' : 'border-transparent'}`}
                    style={{ fontFamily: f.family, color: INK_COLORS[color] }}
                  >
                    <span className="truncate px-3 py-1">{name.trim() || t('typePlaceholder')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'draw' && (
            <div className="relative">
              <canvas
                ref={canvasRef}
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerCancel={endDraw}
                className="h-48 w-full touch-none rounded-2xl border border-dashed border-[var(--gold)]/50 bg-[var(--background)]"
                aria-label={t('drawHint')}
              />
              {!drawn && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">{t('drawHint')}</p>}
              <div className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-[var(--muted)]/30" aria-hidden="true" />
            </div>
          )}

          {tab === 'upload' && (
            <div className="space-y-2">
              <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--gold)]/50 bg-[var(--background)] p-4 text-center">
                {uploaded ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uploaded.png} alt={t('signTitle')} className="max-h-36 max-w-full object-contain" />
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-[var(--gold)]" aria-hidden="true" />
                    <span className="text-sm font-bold text-[var(--ink)]">{t('uploadHint')}</span>
                    <span className="text-xs text-[var(--muted)]">{t('uploadFormats')}</span>
                  </>
                )}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onUpload(e.target.files?.[0])} />
              </label>
              {uploadError && (
                <p className="text-sm font-semibold text-[#a12a2a]" role="alert">
                  {uploadError}
                </p>
              )}
            </div>
          )}
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm text-[var(--ink)]">
          <input type="checkbox" checked={remember} onChange={() => setRemember((v) => !v)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
          {t('remember')}
        </label>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)] sm:max-w-[60%]">{t('consent')}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-full border border-[var(--ink)]/20 px-5 font-bold text-[var(--ink)] sm:flex-none">
              {t('cancel')}
            </button>
            <button type="button" disabled={!ready || busy} onClick={confirm} className="min-h-12 flex-1 rounded-full bg-[var(--ink)] px-6 font-bold text-[var(--gold-bright)] disabled:opacity-40 sm:flex-none">
              {t('sign')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

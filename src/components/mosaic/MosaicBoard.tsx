'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Check, Download, Hourglass, Minus, Plus, Radio, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMosaicCanvas, placeMosaicPixel } from '@/app/actions/mosaic'
import { MOSAIC_PALETTE, decodeCanvas, hexToRgb, secondsToRomeMidnight, type MosaicStatus } from '@/lib/mosaic'

const EMPTY_RGB: [number, number, number] = [239, 234, 224] // casella libera (beige chiaro)
const ZOOMS = [1, 2, 4, 8]
const LUT = MOSAIC_PALETTE.map(hexToRgb)

const clock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((n) => String(n).padStart(2, '0')).join(':')

// La tela del Mosaic: si tocca una casella libera, si sceglie il colore e si
// conferma. Le tessere degli altri compaiono in tempo reale.
export default function MosaicBoard({ status }: { status: MosaicStatus }) {
  const t = useTranslations('mosaic')
  const locale = useLocale()
  const season = status.season!
  const size = season.width * season.height

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cells = useRef<Uint8Array>(decodeCanvas(status.canvas, size))
  const [filled, setFilled] = useState(season.filled)
  const [mine, setMine] = useState(season.mine)
  const [contributors, setContributors] = useState(season.contributors)
  const [left, setLeft] = useState(status.allowance.left)
  const [zoom, setZoom] = useState(1)
  const [cellPx, setCellPx] = useState(0)
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState(10)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null)
  const [live, setLive] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const canPlace = status.online && status.eligible && left > 0

  // Disegno della tela: un pixel del canvas per ogni casella
  const paintAll = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(season.width, season.height)
    cells.current.forEach((value, i) => {
      const [r, g, b] = value ? LUT[value - 1] : EMPTY_RGB
      img.data.set([r, g, b, 255], i * 4)
    })
    ctx.putImageData(img, 0, 0)
  }, [season.width, season.height])

  const paintCell = useCallback(
    (x: number, y: number, value: number) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const [r, g, b] = value ? LUT[value - 1] : EMPTY_RGB
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    },
    [],
  )

  const reload = useCallback(async () => {
    const data = await getMosaicCanvas(season.id)
    if (data === null) return
    cells.current = decodeCanvas(data, size)
    setFilled(cells.current.reduce((n, v) => n + (v ? 1 : 0), 0))
    paintAll()
  }, [season.id, size, paintAll])

  useEffect(() => {
    paintAll()
  }, [paintAll])

  // Dimensione di una casella sullo schermo (per griglia e tocchi)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => setCellPx(canvas.getBoundingClientRect().width / season.width))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [season.width])

  // Tempo reale: tessere nuove e ricariche decise dallo Staff
  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null
    let active = true
    ;(async () => {
      await supabase.realtime.setAuth()
      if (!active) return
      channel = supabase
        .channel(`mosaic:${season.id}`, { config: { private: true } })
        .on('broadcast', { event: 'pixel' }, ({ payload }) => {
          const { x, y, c } = payload as { x: number; y: number; c: number }
          const i = y * season.width + x
          if (i < 0 || i >= size) return
          if (!cells.current[i]) setFilled((n) => n + 1)
          cells.current[i] = c + 1
          paintCell(x, y, c + 1)
          setSelected((current) => (current && current.x === x && current.y === y ? null : current))
        })
        .on('broadcast', { event: 'reload' }, () => reload())
        .subscribe((state) => setLive(state === 'SUBSCRIBED'))
    })()
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) supabase.removeChannel(channel)
    }
  }, [season.id, season.width, size, paintCell, reload])

  // Conto alla rovescia per le tessere di domani
  useEffect(() => {
    if (left > 0 || !status.eligible) return
    const tick = () => setCountdown(secondsToRomeMidnight())
    const timer = setInterval(tick, 1000)
    const first = setTimeout(tick, 0)
    return () => {
      clearInterval(timer)
      clearTimeout(first)
    }
  }, [left, status.eligible])

  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * season.width)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * season.height)
    if (x < 0 || y < 0 || x >= season.width || y >= season.height) return
    if (cells.current[y * season.width + x]) {
      setSelected(null)
      setNotice({ text: t('cellTaken'), ok: false })
      return
    }
    setNotice(null)
    setSelected({ x, y })
  }

  const place = async () => {
    if (!selected || !canPlace || busy) return
    const { x, y } = selected
    const i = y * season.width + x
    if (cells.current[i]) return setNotice({ text: t('cellTaken'), ok: false })
    setBusy(true)
    // Subito sulla tela; se il server rifiuta si ricarica lo stato vero
    cells.current[i] = color + 1
    paintCell(x, y, color + 1)
    setFilled((n) => n + 1)
    const result = await placeMosaicPixel(season.id, x, y, color)
    setBusy(false)
    setSelected(null)
    if (result.ok) {
      setLeft(result.left ?? Math.max(0, left - 1))
      if (mine === 0) setContributors((n) => n + 1)
      setMine((n) => n + 1)
      setNotice({ text: t('placed'), ok: true })
      return
    }
    if (result.error === 'no_pixels') setLeft(0)
    setNotice({ text: t.has(`error_${result.error}`) ? t(`error_${result.error}`) : t('error_saveError'), ok: false })
    await reload()
  }

  const download = () => {
    const source = canvasRef.current
    if (!source) return
    const scale = Math.max(1, Math.floor(1024 / season.width))
    const out = document.createElement('canvas')
    out.width = season.width * scale
    out.height = season.height * scale
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(source, 0, 0, out.width, out.height)
    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `kumani-mosaic-${season.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  const percent = Math.floor((filled / size) * 100)
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }), [locale])
  const zoomIndex = ZOOMS.indexOf(zoom)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Tela */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
            <Radio className={`h-3.5 w-3.5 ${live ? 'text-emerald-600' : 'text-gray-400'}`} /> {live ? t('live') : t('connecting')}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom(ZOOMS[Math.max(0, zoomIndex - 1)])}
              disabled={zoomIndex <= 0}
              aria-label={t('zoomOut')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-xs font-bold text-gray-600">{zoom}×</span>
            <button
              type="button"
              onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)])}
              disabled={zoomIndex >= ZOOMS.length - 1}
              aria-label={t('zoomIn')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={download}
              aria-label={t('download')}
              title={t('download')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[75vh] overflow-auto rounded-2xl border border-[var(--gold)]/30 bg-white p-2 shadow-sm">
          <div className="relative" style={{ width: `${zoom * 100}%` }}>
            <canvas
              ref={canvasRef}
              width={season.width}
              height={season.height}
              onClick={pick}
              className="block w-full cursor-crosshair touch-manipulation"
              style={{ imageRendering: 'pixelated', aspectRatio: `${season.width} / ${season.height}` }}
            />
            {cellPx >= 8 && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: 'linear-gradient(to right, rgba(0,0,0,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.08) 1px, transparent 1px)',
                  backgroundSize: `${100 / season.width}% ${100 / season.height}%`,
                }}
              />
            )}
            {selected && (
              <div
                className="pointer-events-none absolute animate-pulse ring-2 ring-[var(--ink)] ring-offset-1"
                style={{
                  left: `${(selected.x / season.width) * 100}%`,
                  top: `${(selected.y / season.height) * 100}%`,
                  width: `${100 / season.width}%`,
                  height: `${100 / season.height}%`,
                  backgroundColor: MOSAIC_PALETTE[color],
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Pannello laterale */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
          <p className="text-lg font-bold text-[var(--ink)]">{season.title}</p>
          {season.theme && <p className="mt-0.5 text-sm text-[var(--muted)]">{season.theme}</p>}
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" style={{ width: `${Math.max(percent, filled ? 1 : 0)}%` }} />
          </div>
          <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{t('progress', { filled, total: size, percent })}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{t('contributors', { count: contributors })}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{t('seasonEnds', { date: dateFormat.format(new Date(season.ends_at)) })}</p>
          <p className="mt-3 text-sm text-gray-700">{t('mine', { count: mine })}</p>
        </div>

        {!status.eligible ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-bold">
              <Hourglass className="h-4 w-4" /> {t('tooNewTitle')}
            </p>
            <p className="mt-1">{status.blocked ? t('error_not_allowed') : t('tooNew', { days: status.login_days, min: status.min_login_days })}</p>
            {!status.blocked && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-100">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, (status.login_days / Math.max(1, status.min_login_days)) * 100)}%` }} />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
            <p className="font-bold text-[var(--ink)]">{t('left', { count: left })}</p>
            {left === 0 && countdown !== null && <p className="mt-1 text-sm text-[var(--muted)]">{t('nextIn', { time: clock(countdown) })}</p>}
            {status.allowance.bonus > 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" /> {t('bonusEarned', { count: status.allowance.bonus })}
              </p>
            ) : (
              status.allowance.bonus_available > 0 && <p className="mt-2 text-xs text-[var(--muted)]">{t('bonusHint', { count: status.allowance.bonus_available })}</p>
            )}

            {canPlace && (
              <>
                <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-gray-500">{t('palette')}</p>
                <div className="grid grid-cols-8 gap-1.5">
                  {MOSAIC_PALETTE.map((hex, index) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setColor(index)}
                      aria-label={hex}
                      className={`aspect-square rounded-md border ${color === index ? 'border-[var(--ink)] ring-2 ring-[var(--ink)] ring-offset-1' : 'border-black/10'}`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-gray-700">{selected ? t('selected', { x: selected.x + 1, y: selected.y + 1 }) : t('pickCell')}</p>
                <button
                  type="button"
                  onClick={place}
                  disabled={!selected || busy}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
                >
                  <Check className="h-4 w-4 text-[var(--gold-bright)]" /> {t('place')}
                </button>
              </>
            )}
          </div>
        )}

        {notice && (
          <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{notice.text}</p>
        )}
      </div>
    </div>
  )
}

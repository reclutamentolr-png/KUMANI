'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Award, Crown, Download, Flag, LoaderCircle, Play, RotateCcw, Share2 } from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { getMosaicTimeline } from '@/app/actions/mosaic'
import { MOSAIC_BADGES, MOSAIC_EMPTY_RGB, MOSAIC_LUT, MOSAICIST_TILES, decodeTimeline, type MosaicBadges, type MosaicTile } from '@/lib/mosaic'
import { renderMosaicShareCard } from '@/lib/mosaicShareCard'

type SeasonInfo = { id: string; title: string; width: number; height: number; contributors: number; mine: number }

const BADGE_ICON = { cofounder: Flag, last_tile: Crown, mosaicist: Award }

// Riconoscimenti della stagione: quelli presi in oro, gli altri in grigio
export function MosaicBadgesList({ badges, compact = false }: { badges: MosaicBadges; compact?: boolean }) {
  const t = useTranslations('mosaic')
  return (
    <div className={compact ? 'flex flex-wrap gap-1.5' : 'space-y-2'}>
      {MOSAIC_BADGES.map((key) => {
        const Icon = BADGE_ICON[key]
        const earned = badges[key]
        if (compact && !earned) return null
        return compact ? (
          <span key={key} className="inline-flex items-center gap-1 rounded-full border border-[var(--gold)]/50 bg-[var(--gold)]/10 px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
            <Icon className="h-3.5 w-3.5 text-[var(--gold)]" /> {t(`badge_${key}`)}
          </span>
        ) : (
          <div key={key} className={`flex items-start gap-3 rounded-xl border p-3 ${earned ? 'border-[var(--gold)]/50 bg-[var(--gold)]/10' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${earned ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-gray-200 text-gray-400'}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className={`text-sm font-bold ${earned ? 'text-[var(--ink)]' : 'text-gray-500'}`}>{t(`badge_${key}`)}</p>
              <p className="text-xs text-[var(--muted)]">{t(`badge_${key}_desc`, { count: MOSAICIST_TILES })}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Timelapse: l'opera si ricompone in circa 20 secondi, tessera dopo tessera
export function MosaicTimelapse({ season, onClose }: { season: SeasonInfo; onClose: () => void }) {
  const t = useTranslations('mosaic')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frame = useRef<number | null>(null)
  const [tiles, setTiles] = useState<MosaicTile[] | null>(null)
  const [shown, setShown] = useState(0)
  const [playing, setPlaying] = useState(false)

  const play = useCallback((list: MosaicTile[]) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    if (frame.current) cancelAnimationFrame(frame.current)
    const [er, eg, eb] = MOSAIC_EMPTY_RGB
    ctx.fillStyle = `rgb(${er},${eg},${eb})`
    ctx.fillRect(0, 0, season.width, season.height)
    const duration = Math.min(20000, Math.max(4000, list.length * 40))
    const start = performance.now()
    let drawn = 0
    setPlaying(true)
    const step = (now: number) => {
      const target = Math.min(list.length, Math.ceil(((now - start) / duration) * list.length))
      for (; drawn < target; drawn++) {
        const tile = list[drawn]
        const [r, g, b] = MOSAIC_LUT[tile.color]
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(tile.x, tile.y, 1, 1)
      }
      setShown(drawn)
      if (drawn < list.length) frame.current = requestAnimationFrame(step)
      else setPlaying(false)
    }
    frame.current = requestAnimationFrame(step)
  }, [season.width, season.height])

  useEffect(() => {
    let active = true
    getMosaicTimeline(season.id).then((data) => {
      if (!active) return
      const list = decodeTimeline(data)
      setTiles(list)
      play(list)
    })
    return () => {
      active = false
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [season.id, play])

  return (
    <Sheet title={t('timelapseTitle', { title: season.title })} onClose={onClose}>
      <div className="overflow-hidden rounded-xl border border-[var(--gold)]/30 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={season.width}
          height={season.height}
          className="block w-full"
          style={{ imageRendering: 'pixelated', aspectRatio: `${season.width} / ${season.height}` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          {tiles === null ? t('timelapseLoading') : t('timelapseCount', { shown, total: tiles.length })}
        </p>
        <button
          type="button"
          onClick={() => tiles && play(tiles)}
          disabled={!tiles?.length || playing}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {playing ? <Play className="h-4 w-4 text-[var(--gold-bright)]" /> : <RotateCcw className="h-4 w-4 text-[var(--gold-bright)]" />} {t('timelapseReplay')}
        </button>
      </div>
    </Sheet>
  )
}

// Card da condividere: le mie tessere evidenziate (di serie) oppure l'opera pulita
export function MosaicShare({ season, onClose }: { season: SeasonInfo; onClose: () => void }) {
  const t = useTranslations('mosaic')
  const [tiles, setTiles] = useState<MosaicTile[] | null>(null)
  const [highlight, setHighlight] = useState(true)
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)

  useEffect(() => {
    let active = true
    getMosaicTimeline(season.id).then((data) => active && setTiles(decodeTimeline(data)))
    return () => {
      active = false
    }
  }, [season.id])

  const { title, width, height, contributors } = season
  useEffect(() => {
    if (!tiles) return
    let active = true
    const mine = tiles.filter((tile) => tile.mine).length
    renderMosaicShareCard({
      title,
      width,
      height,
      tiles,
      highlight,
      createdBy: t('cardCreatedBy', { count: contributors }),
      myLine: mine > 0 ? t('cardMine', { count: mine }) : null,
      site: window.location.host,
    }).then((blob) => {
      if (!active || !blob) return
      // La nuova immagine sostituisce la vecchia, che solo allora si libera
      const url = URL.createObjectURL(blob)
      setImage((previous) => {
        if (previous) URL.revokeObjectURL(previous.url)
        return { blob, url }
      })
    })
    return () => {
      active = false
    }
  }, [tiles, highlight, title, width, height, contributors, t])

  // Chiudendo la finestra si libera l'ultima immagine
  const lastUrl = useRef<string | null>(null)
  useEffect(() => {
    lastUrl.current = image?.url ?? null
  }, [image])
  useEffect(() => () => {
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current)
  }, [])

  const share = async () => {
    if (!image) return
    const file = new File([image.blob], 'kumani-mosaic.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: t('cardShareText') })
      } catch {
        // Annullato.
      }
      return
    }
    download()
  }

  const download = () => {
    if (!image) return
    const link = document.createElement('a')
    link.href = image.url
    link.download = 'kumani-mosaic.png'
    link.click()
  }

  const hasMine = !!tiles?.some((tile) => tile.mine)

  return (
    <Sheet title={t('shareTitle')} onClose={onClose}>
      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl bg-[var(--ink)]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={season.title} className="h-full w-full object-contain" />
        ) : (
          <LoaderCircle className="h-6 w-6 animate-spin text-[var(--gold-bright)]" />
        )}
      </div>
      {hasMine && (
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
          {t('shareHighlight')}
        </label>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={share} disabled={!image} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
          <Share2 className="h-4 w-4 text-[var(--gold-bright)]" /> {t('share')}
        </button>
        <button type="button" onClick={download} disabled={!image} className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 disabled:opacity-40">
          <Download className="h-4 w-4" /> {t('download')}
        </button>
      </div>
    </Sheet>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Clapperboard, Share2 } from 'lucide-react'
import { decodeCanvas, paintCells, type MosaicArchiveSeason } from '@/lib/mosaic'
import { MosaicBadgesList, MosaicShare, MosaicTimelapse } from './MosaicExtras'

// Opere delle stagioni concluse: immagine, numeri, riconoscimenti, timelapse
// e card da condividere.
export default function MosaicArchive({ seasons }: { seasons: MosaicArchiveSeason[] }) {
  const t = useTranslations('mosaic')
  const locale = useLocale()
  const [open, setOpen] = useState<{ season: MosaicArchiveSeason; kind: 'timelapse' | 'share' } | null>(null)
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }), [locale])

  if (seasons.length === 0) {
    return <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('archiveEmpty')}</p>
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {seasons.map((season) => {
          const total = season.width * season.height
          return (
            <div key={season.id} className="flex flex-col overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-white shadow-sm">
              <div className="bg-[var(--ink)] p-3">
                <ArchiveCanvas season={season} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-lg font-bold text-[var(--ink)]">{season.title}</p>
                {season.theme && <p className="text-sm text-[var(--muted)]">{season.theme}</p>}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {dateFormat.format(new Date(season.starts_at))} – {dateFormat.format(new Date(season.ends_at))}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{t('progress', { filled: season.filled, total, percent: Math.floor((season.filled / total) * 100) })}</p>
                <p className="text-xs text-[var(--muted)]">{t('cardCreatedBy', { count: season.contributors })}</p>
                {season.mine > 0 && <p className="mt-1 text-xs font-semibold text-[var(--gold)]">{t('cardMine', { count: season.mine })}</p>}
                <div className="mt-3">
                  <MosaicBadgesList badges={season.badges} compact />
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setOpen({ season, kind: 'timelapse' })}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700"
                  >
                    <Clapperboard className="h-4 w-4" /> {t('timelapse')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen({ season, kind: 'share' })}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white"
                  >
                    <Share2 className="h-4 w-4 text-[var(--gold-bright)]" /> {t('share')}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {open?.kind === 'timelapse' && <MosaicTimelapse season={open.season} onClose={() => setOpen(null)} />}
      {open?.kind === 'share' && <MosaicShare season={open.season} onClose={() => setOpen(null)} />}
    </>
  )
}

function ArchiveCanvas({ season }: { season: MosaicArchiveSeason }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) paintCells(ctx, decodeCanvas(season.canvas, season.width * season.height), season.width, season.height, [38, 38, 38])
  }, [season])
  return (
    <canvas
      ref={ref}
      width={season.width}
      height={season.height}
      className="block w-full"
      style={{ imageRendering: 'pixelated', aspectRatio: `${season.width} / ${season.height}` }}
    />
  )
}

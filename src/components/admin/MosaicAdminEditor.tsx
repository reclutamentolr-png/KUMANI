'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Brush, Eraser, ImageUp, LoaderCircle, Lock, Minus, SquareDashedMousePointer, Plus, Save, Trash2, Undo2, Users, X } from 'lucide-react'
import {
  adminClearMosaicUser,
  adminGetMosaicEditor,
  adminMosaicAddZone,
  adminMosaicAreaPeople,
  adminMosaicClearArea,
  adminMosaicDeleteZone,
  adminMosaicPaint,
  adminMosaicSetTemplate,
  type MosaicAdminSeason,
} from '@/app/actions/admin'
import { MOSAIC_PALETTE, bytesToBase64, cellRgb, decodeCanvas, imageToTemplate, paintCells, type MosaicZone } from '@/lib/mosaic'

type Rect = { x: number; y: number; w: number; h: number }
type Mode = 'select' | 'paint' | 'erase'
const ZOOMS = [1, 2, 4, 8]
const MAX_PENDING = 20000

const when = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(iso))

// Editor dello Staff per una stagione del Mosaic: selezione di un'area
// (chi ha piazzato, pulizia, zona protetta), disegno libero, sagoma guida.
export default function MosaicAdminEditor({
  season,
  focus,
  onClose,
  onChanged,
}: {
  season: MosaicAdminSeason
  focus?: Rect | null
  onClose: () => void
  onChanged: () => void
}) {
  const { width, height } = season
  const size = width * height
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cells = useRef<Uint8Array>(new Uint8Array(size))
  const pending = useRef<Map<number, number>>(new Map())
  const drag = useRef<{ x: number; y: number } | null>(null)

  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zones, setZones] = useState<(MosaicZone & { id: string })[]>([])
  const [template, setTemplate] = useState<Uint8Array | null>(null)
  const [templateDirty, setTemplateDirty] = useState(false)
  const [showGuide, setShowGuide] = useState(true)
  const [mode, setMode] = useState<Mode>('select')
  const [color, setColor] = useState(4)
  const [zoom, setZoom] = useState(1)
  const [selection, setSelection] = useState<Rect | null>(focus ?? null)
  const [pendingCount, setPendingCount] = useState(0)
  const [people, setPeople] = useState<Record<string, unknown>[] | null>(null)
  const [working, setWorking] = useState(false)

  const guide = showGuide ? template : null

  const paintAll = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const view = new Uint8Array(cells.current)
    pending.current.forEach((c, i) => (view[i] = c < 0 ? 0 : c + 1))
    paintCells(ctx, view, width, height, undefined, guide)
  }, [width, height, guide])

  const templateDirtyRef = useRef(false)
  const load = useCallback(async (force = false) => {
    const result = await adminGetMosaicEditor(season.id)
    if (!result.data) {
      setError(result.error ?? 'Tela non disponibile')
      return
    }
    cells.current = decodeCanvas(result.data.canvas, size)
    setZones(result.data.zones)
    // Una sagoma caricata ma non ancora salvata resta dov'è
    if (!templateDirtyRef.current || force) {
      setTemplate(result.data.template ? decodeCanvas(result.data.template, size) : null)
      setTemplateDirty(false)
      templateDirtyRef.current = false
    }
    setLoaded(true)
  }, [season.id, size])

  useEffect(() => {
    // Caricamento dal server (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  useEffect(() => {
    if (loaded) paintAll()
  }, [loaded, paintAll])

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(width - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * width)))
    const y = Math.min(height - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * height)))
    return { x, y }
  }

  const brush = (x: number, y: number) => {
    const i = y * width + x
    if (!pending.current.has(i) && pending.current.size >= MAX_PENDING) return
    const value = mode === 'erase' ? -1 : color
    pending.current.set(i, value)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      const [r, g, b] = cellRgb(value < 0 ? 0 : value + 1, guide?.[i] ?? 0)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
    setPendingCount(pending.current.size)
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = cellAt(e)
    drag.current = { x, y }
    if (mode === 'select') {
      setPeople(null)
      setSelection({ x, y, w: 1, h: 1 })
    } else brush(x, y)
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return
    const { x, y } = cellAt(e)
    if (mode === 'select') {
      const start = drag.current
      setSelection({ x: Math.min(start.x, x), y: Math.min(start.y, y), w: Math.abs(x - start.x) + 1, h: Math.abs(y - start.y) + 1 })
    } else brush(x, y)
  }
  const onUp = () => {
    drag.current = null
  }

  const run = async (action: () => Promise<{ success: boolean; error?: string | null }>, after?: () => Promise<void> | void) => {
    setWorking(true)
    let result: { success: boolean; error?: string | null }
    try {
      result = await action()
    } catch {
      result = { success: false, error: 'rete non raggiungibile' }
    } finally {
      setWorking(false)
    }
    if (!result.success) return notify('Errore: ' + (result.error ?? ''))
    await after?.()
  }

  const savePaint = () => {
    const list = [...pending.current].map(([i, c]) => ({ x: i % width, y: Math.floor(i / width), c }))
    run(
      () => adminMosaicPaint(season.id, list),
      async () => {
        pending.current.clear()
        setPendingCount(0)
        await load()
        paintAll()
        onChanged()
      },
    )
  }

  const discardPaint = () => {
    pending.current.clear()
    setPendingCount(0)
    paintAll()
  }

  const showPeople = async () => {
    if (!selection) return
    setPeople(null)
    const result = await adminMosaicAreaPeople(season.id, selection)
    setPeople(result.rows)
  }

  const clearArea = () => {
    if (!selection || !confirm(`Togliere tutte le tessere nell'area ${selection.w}×${selection.h}? Le caselle tornano libere.`)) return
    run(
      () => adminMosaicClearArea(season.id, selection),
      async () => {
        await load()
        paintAll()
        setPeople(null)
        onChanged()
      },
    )
  }

  const addZone = () => {
    if (!selection) return
    const label = prompt('Nome della zona protetta (facoltativo, es. "Logo KUMANI"):')
    if (label === null) return
    run(() => adminMosaicAddZone(season.id, selection, label), load)
  }

  const clearUser = (userId: string, label: string) => {
    if (!confirm(`Togliere tutte le tessere di ${label} da questa stagione?`)) return
    run(
      () => adminClearMosaicUser(season.id, userId),
      async () => {
        await load()
        paintAll()
        await showPeople()
        onChanged()
      },
    )
  }

  const onTemplateFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      setTemplate(imageToTemplate(image, width, height))
      setTemplateDirty(true)
      templateDirtyRef.current = true
      setShowGuide(true)
      URL.revokeObjectURL(url)
    }
    image.onerror = () => URL.revokeObjectURL(url)
    image.src = url
  }

  const saveTemplate = (value: Uint8Array | null) =>
    run(() => adminMosaicSetTemplate(season.id, value ? bytesToBase64(value) : null), () => load(true))

  const zoomIndex = ZOOMS.indexOf(zoom)
  const selectionStyle = useMemo(
    () =>
      selection && {
        left: `${(selection.x / width) * 100}%`,
        top: `${(selection.y / height) * 100}%`,
        width: `${(selection.w / width) * 100}%`,
        height: `${(selection.h / height) * 100}%`,
      },
    [selection, width, height],
  )

  const tool = (value: Mode, label: string, Icon: typeof Brush) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${mode === value ? 'bg-[var(--ink)] text-white' : 'border border-gray-300 text-gray-700'}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
  const small = 'flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50'

  return (
    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {tool('select', 'Seleziona area', SquareDashedMousePointer)}
          {tool('paint', 'Disegna', Brush)}
          {tool('erase', 'Cancella', Eraser)}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setZoom(ZOOMS[Math.max(0, zoomIndex - 1)])} disabled={zoomIndex <= 0} className={`${small} border-gray-300`}>
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-xs font-bold text-gray-600">{zoom}×</span>
          <button type="button" onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zoomIndex + 1)])} disabled={zoomIndex >= ZOOMS.length - 1} className={`${small} border-gray-300`}>
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onClose} className={`${small} border-gray-300 text-gray-700`}>
            <X className="h-3.5 w-3.5" /> Chiudi tela
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {mode !== 'select' && (
        <div className="flex flex-wrap gap-1">
          {MOSAIC_PALETTE.map((hex, index) => (
            <button
              key={hex}
              type="button"
              onClick={() => {
                setColor(index)
                setMode('paint')
              }}
              aria-label={hex}
              className={`h-6 w-6 rounded border ${mode === 'paint' && color === index ? 'ring-2 ring-[var(--ink)] ring-offset-1' : 'border-black/10'}`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      )}

      <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white p-2">
        <div className="relative" style={{ width: `${zoom * 100}%` }}>
          {!loaded && <LoaderCircle className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-[var(--gold)]" />}
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="block w-full touch-none cursor-crosshair"
            style={{ imageRendering: 'pixelated', aspectRatio: `${width} / ${height}` }}
          />
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="pointer-events-none absolute border border-blue-600"
              style={{
                left: `${(zone.x / width) * 100}%`,
                top: `${(zone.y / height) * 100}%`,
                width: `${(zone.w / width) * 100}%`,
                height: `${(zone.h / height) * 100}%`,
                backgroundColor: 'rgba(37,99,235,.10)',
              }}
            />
          ))}
          {selectionStyle && <div className="pointer-events-none absolute border-2 border-dashed border-red-600 bg-red-500/10" style={selectionStyle} />}
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <span className="font-semibold">{pendingCount} caselle modificate (non ancora salvate)</span>
          <button type="button" onClick={savePaint} disabled={working} className={`${small} border-transparent bg-[var(--ink)] text-white`}>
            {working ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salva disegno
          </button>
          <button type="button" onClick={discardPaint} className={`${small} border-gray-300 text-gray-700`}>
            <Undo2 className="h-3.5 w-3.5" /> Annulla
          </button>
          <span className="text-xs">Le tessere dello Staff non hanno autore e possono coprire quelle esistenti.</span>
        </div>
      )}

      {mode === 'select' && selection && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3">
          <p className="text-sm font-semibold text-gray-900">
            Area selezionata: da ({selection.x + 1}, {selection.y + 1}), {selection.w}×{selection.h} caselle
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={showPeople} className={`${small} border-gray-300 text-gray-700`}>
              <Users className="h-3.5 w-3.5" /> Chi ha piazzato qui
            </button>
            <button type="button" onClick={clearArea} disabled={working} className={`${small} border-red-200 text-red-600`}>
              <Eraser className="h-3.5 w-3.5" /> Togli le tessere dell&apos;area
            </button>
            <button type="button" onClick={addZone} disabled={working} className={`${small} border-blue-200 text-blue-700`}>
              <Lock className="h-3.5 w-3.5" /> Crea zona protetta
            </button>
          </div>
          {people &&
            (people.length === 0 ? (
              <p className="text-xs text-gray-500">Nessuna tessera di utenti in quest&apos;area.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {people.map((row) => {
                    const label = String(row.name || row.email || row.user_id)
                    return (
                      <tr key={String(row.user_id)}>
                        <td className="py-1.5">
                          <p className="font-medium text-gray-900">{label}</p>
                          {row.email ? <p className="text-xs text-gray-500">{String(row.email)}</p> : null}
                        </td>
                        <td className="py-1.5 text-right text-xs text-gray-600">
                          {String(row.pixels)} qui · {when(String(row.last_at))}
                        </td>
                        <td className="py-1.5 text-right">
                          <button type="button" onClick={() => clearUser(String(row.user_id), label)} className={`${small} ml-auto border-red-200 text-red-600`}>
                            <Eraser className="h-3.5 w-3.5" /> Tutte le sue tessere
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-sm font-semibold text-gray-900">Zone protette</p>
          {zones.length === 0 ? (
            <p className="text-xs text-gray-500">Nessuna. Seleziona un&apos;area e premi &quot;Crea zona protetta&quot;: lì potrà piazzare tessere solo lo Staff.</p>
          ) : (
            <ul className="space-y-1.5">
              {zones.map((zone) => (
                <li key={zone.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <Lock className="mr-1 inline h-3.5 w-3.5 text-blue-600" />
                    {zone.label || 'Zona'} · ({zone.x + 1}, {zone.y + 1}) {zone.w}×{zone.h}
                  </span>
                  <button
                    type="button"
                    onClick={() => confirm('Eliminare la zona protetta? Le tessere già presenti restano.') && run(() => adminMosaicDeleteZone(zone.id), load)}
                    className={`${small} border-red-200 text-red-600`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          <p className="mb-1 text-sm font-semibold text-gray-900">Sagoma guida</p>
          <p className="mb-2 text-xs text-gray-500">
            Carica un&apos;immagine (meglio PNG con sfondo trasparente): viene ridotta a {width}×{height} caselle con i colori della tavolozza e
            mostrata leggera sotto le caselle vuote. Toccando una casella della sagoma si propone il colore previsto.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className={`${small} cursor-pointer border-gray-300 text-gray-700`}>
              <ImageUp className="h-3.5 w-3.5" /> Carica immagine
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onTemplateFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            {template && (
              <label className="flex items-center gap-1.5 text-xs text-gray-700">
                <input type="checkbox" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} /> Mostra
              </label>
            )}
            {templateDirty && template && (
              <button type="button" onClick={() => saveTemplate(template)} disabled={working} className={`${small} border-transparent bg-[var(--ink)] text-white`}>
                <Save className="h-3.5 w-3.5" /> Salva sagoma
              </button>
            )}
            {template && (
              <button
                type="button"
                onClick={() => (templateDirty ? load(true) : confirm('Togliere la sagoma guida dalla stagione?') && saveTemplate(null))}
                className={`${small} border-red-200 text-red-600`}
              >
                <Trash2 className="h-3.5 w-3.5" /> {templateDirty ? 'Annulla' : 'Togli sagoma'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

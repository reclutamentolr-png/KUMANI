'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, Minus, Pause, Pencil, Play, Plus, RotateCcw, ScrollText } from 'lucide-react'

// Gobbo della regia (come KUMANI LUMEN, in piccolo): il testo da dire scorre
// sopra l'anteprima, vicino alla videocamera, così leggendo si guarda quasi in
// camera. Lo vede solo chi presenta: non fa parte del video della diretta. Il
// testo resta salvato in questo browser, per ogni webinar.

const SPEEDS = [10, 15, 20, 28, 36, 46, 58]
const SIZES = [20, 24, 28, 34, 40, 48]
const storageKey = (id: string) => `kumani:webinar:prompter:${id}`

type Saved = { text: string; speed: number; size: number }

function readSaved(id: string): Saved {
  try {
    const raw = localStorage.getItem(storageKey(id))
    const s = raw ? (JSON.parse(raw) as Partial<Saved>) : {}
    return { text: typeof s.text === 'string' ? s.text : '', speed: Number(s.speed) || 2, size: Number(s.size) || 2 }
  } catch {
    return { text: '', speed: 2, size: 2 }
  }
}

export default function WebinarPrompter({ webinarId }: { webinarId: string }) {
  const t = useTranslations('webinar')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [speed, setSpeed] = useState(2)
  const [size, setSize] = useState(2)
  const [playing, setPlaying] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const pos = useRef(0)
  const loaded = useRef(false)

  // Testo e impostazioni salvati in questo browser
  useEffect(() => {
    const saved = readSaved(webinarId)
    // Dati del browser: si leggono solo dopo il primo disegno
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(saved.text)
    setSpeed(Math.min(SPEEDS.length - 1, saved.speed))
    setSize(Math.min(SIZES.length - 1, saved.size))
    if (!saved.text) setEditing(true)
    loaded.current = true
  }, [webinarId])
  useEffect(() => {
    if (!loaded.current) return
    try {
      localStorage.setItem(storageKey(webinarId), JSON.stringify({ text, speed, size }))
    } catch {
      // Memoria del browser non disponibile: il testo resta finché la pagina è aperta
    }
  }, [webinarId, text, speed, size])

  // Scorrimento: pixel al secondo, si ferma da solo alla fine
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const box = boxRef.current
      if (box) {
        pos.current = Math.min(box.scrollHeight - box.clientHeight, pos.current + ((now - last) / 1000) * SPEEDS[speed])
        box.scrollTop = pos.current
        if (pos.current >= box.scrollHeight - box.clientHeight - 1) {
          setPlaying(false)
          return
        }
      }
      last = now
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed])

  const nudge = (delta: number) => {
    const box = boxRef.current
    if (!box) return
    pos.current = Math.max(0, Math.min(box.scrollHeight - box.clientHeight, box.scrollTop + delta))
    box.scrollTop = pos.current
  }
  const restart = () => {
    setPlaying(false)
    pos.current = 0
    if (boxRef.current) boxRef.current.scrollTop = 0
  }

  const ctrl = 'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/20 disabled:opacity-40'

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--gold)]/40 bg-[var(--paper)] px-4 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
      >
        <ScrollText className="h-4 w-4" aria-hidden /> {t('prompterOpen')}
      </button>
    )
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-[#0d0c0a] text-white shadow-lg" aria-label={t('prompterTitle')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="mr-auto flex items-center gap-2 text-sm font-bold text-[var(--gold-bright)]">
          <ScrollText className="h-4 w-4" aria-hidden /> {t('prompterTitle')}
        </span>
        {!editing && (
          <>
            <button type="button" className={ctrl} onClick={() => setPlaying((p) => !p)} disabled={!text.trim()} aria-label={playing ? t('prompterPause') : t('prompterPlay')}>
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {playing ? t('prompterPause') : t('prompterPlay')}
            </button>
            <button type="button" className={ctrl} onClick={restart} aria-label={t('prompterRestart')} title={t('prompterRestart')}>
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
            <span className="flex items-center gap-1 rounded-full bg-white/5 px-1" title={t('prompterSpeed')}>
              <button type="button" className={ctrl} onClick={() => setSpeed((v) => Math.max(0, v - 1))} aria-label={t('prompterSlower')}>
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <span className="w-14 text-center text-xs font-bold tabular-nums">
                {t('prompterSpeedShort')} {speed + 1}
              </span>
              <button type="button" className={ctrl} onClick={() => setSpeed((v) => Math.min(SPEEDS.length - 1, v + 1))} aria-label={t('prompterFaster')}>
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/5 px-1" title={t('prompterSize')}>
              <button type="button" className={ctrl} onClick={() => setSize((v) => Math.max(0, v - 1))} aria-label={t('prompterSmaller')}>
                A−
              </button>
              <button type="button" className={ctrl} onClick={() => setSize((v) => Math.min(SIZES.length - 1, v + 1))} aria-label={t('prompterBigger')}>
                A+
              </button>
            </span>
          </>
        )}
        <button
          type="button"
          className={ctrl}
          onClick={() => {
            setPlaying(false)
            setEditing((e) => !e)
          }}
        >
          <Pencil className="h-4 w-4" aria-hidden /> {editing ? t('prompterDone') : t('prompterEdit')}
        </button>
        <button type="button" className={ctrl} onClick={() => setOpen(false)} aria-label={t('prompterClose')}>
          <ChevronUp className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {editing ? (
        <div className="p-3">
          <label htmlFor={`prompter-${webinarId}`} className="mb-1 block text-xs text-white/60">
            {t('prompterHint')}
          </label>
          <textarea
            id={`prompter-${webinarId}`}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 20000))}
            rows={8}
            className="w-full rounded-2xl border border-white/15 bg-white/5 p-3 text-base leading-relaxed text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            placeholder={t('prompterPlaceholder')}
          />
        </div>
      ) : (
        <div className="relative">
          {/* Linea di lettura: si legge la riga all'altezza dei segni oro */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[38%] z-[1] flex justify-between px-1">
            <span className="text-[var(--gold-bright)]">▶</span>
            <span className="text-[var(--gold-bright)]">◀</span>
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-10 bg-gradient-to-b from-[#0d0c0a] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-12 bg-gradient-to-t from-[#0d0c0a] to-transparent" />
          <div
            ref={boxRef}
            onScroll={(e) => {
              if (!playing) pos.current = e.currentTarget.scrollTop
            }}
            className="h-56 overflow-y-auto px-7 sm:h-64"
            style={{ fontSize: SIZES[size], lineHeight: 1.35 }}
          >
            <div className="h-[38%] min-h-20" />
            <p className="whitespace-pre-wrap font-semibold">{text || t('prompterEmpty')}</p>
            <div className="h-40" />
          </div>
          <div className="absolute bottom-2 right-2 z-[2] flex flex-col gap-1">
            <button type="button" className={ctrl} onClick={() => nudge(-SIZES[size] * 2)} aria-label={t('prompterBack')}>
              <ChevronUp className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" className={ctrl} onClick={() => nudge(SIZES[size] * 2)} aria-label={t('prompterForward')}>
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

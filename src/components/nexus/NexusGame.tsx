'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Clock, Flame, Lightbulb, LoaderCircle, PartyPopper, Play, Share2 } from 'lucide-react'
import { checkNexusWord, finishNexus, revealNexusLetter } from '@/app/actions/nexus'
import { renderNexusShareCard } from '@/lib/nexusShareCard'
import NexusKeyboard from './NexusKeyboard'
import NexusDuelButton from './NexusDuelButton'
import type { NexusDir, NexusResult, NexusSlot, NexusStatus } from '@/lib/nexus/types'

// KUMANI NEXUS, il cruciverba del giorno: si tocca una casella (toccandola di
// nuovo si cambia verso), si scrive con la tastiera qui sotto (o quella del
// computer). Quando una parola è piena si controlla sul server: se è giusta
// resta fissata. A griglia finita il risultato si salva e si condivide.
// I progressi restano su questo dispositivo fino a mezzanotte.

type Saved = { letters: string[][]; locked: string[]; hints: number; seconds: number; started?: boolean }
type Cell = { r: number; c: number }

const key = (r: number, c: number) => `${r},${c}`

const cellsOf = (slot: NexusSlot): Cell[] =>
  Array.from({ length: slot.len }, (_, k) => ({ r: slot.row + (slot.dir === 'd' ? k : 0), c: slot.col + (slot.dir === 'a' ? k : 0) }))

const formatTime = (total: number) => {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export default function NexusGame({ status }: { status: NexusStatus }) {
  const t = useTranslations('nexus')
  const uiLocale = useLocale()
  const { puzzle } = status
  const size = puzzle.size
  const storageKey = `kumani_nexus:${puzzle.day}:${puzzle.locale}`

  const emptyGrid = useCallback(() => Array.from({ length: size }, () => Array(size).fill('')), [size])
  const [letters, setLetters] = useState<string[][]>(emptyGrid)
  const [locked, setLocked] = useState<Set<string>>(new Set())
  const [hints, setHints] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [cursor, setCursor] = useState<Cell>({ r: puzzle.slots[0]?.row ?? 0, c: puzzle.slots[0]?.col ?? 0 })
  const [dir, setDir] = useState<NexusDir>(puzzle.slots[0]?.dir ?? 'a')
  const [wrong, setWrong] = useState<string | null>(null)
  const [result, setResult] = useState<NexusResult | null>(status.result)
  const [streak, setStreak] = useState(status.streak)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(false)
  // Il tempo parte solo dopo «Inizia»
  const [started, setStarted] = useState(false)
  const checking = useRef(new Set<string>())
  const finishing = useRef(false)

  // Per ogni casella, le parole che ci passano
  const slotsAt = useMemo(() => {
    const map = new Map<string, { a?: NexusSlot; d?: NexusSlot }>()
    for (const slot of puzzle.slots)
      for (const cell of cellsOf(slot)) {
        const entry = map.get(key(cell.r, cell.c)) ?? {}
        entry[slot.dir] = slot
        map.set(key(cell.r, cell.c), entry)
      }
    return map
  }, [puzzle.slots])

  const activeSlot = slotsAt.get(key(cursor.r, cursor.c))?.[dir] ?? slotsAt.get(key(cursor.r, cursor.c))?.[dir === 'a' ? 'd' : 'a'] ?? puzzle.slots[0]
  const activeCells = useMemo(() => new Set(cellsOf(activeSlot).map((cell) => key(cell.r, cell.c))), [activeSlot])
  const done = result !== null

  // Progressi salvati su questo dispositivo
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Saved | null
      if (saved && Array.isArray(saved.letters) && saved.letters.length === size) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setLetters(saved.letters)
        setLocked(new Set(saved.locked ?? []))
        setHints(saved.hints ?? 0)
        setSeconds(saved.seconds ?? 0)
        setStarted(saved.started ?? (saved.seconds ?? 0) > 0)
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // memoria del browser non disponibile: si parte da capo
    }
    setRestored(true)
  }, [storageKey, size])

  useEffect(() => {
    if (!restored) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ letters, locked: [...locked], hints, seconds, started } satisfies Saved))
    } catch {
      // vale solo per questa visita
    }
  }, [restored, storageKey, letters, locked, hints, seconds, started])

  // Cronometro: corre solo con la pagina in vista
  useEffect(() => {
    if (done || !restored || !started) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [done, restored, started])

  const finish = useCallback(
    async (grid: string[][], usedHints: number, time: number) => {
      if (finishing.current) return
      finishing.current = true
      setBusy(true)
      const res = await finishNexus(puzzle.day, puzzle.locale, grid, time, usedHints).catch(() => ({ error: 'saveError' }))
      setBusy(false)
      if ('error' in res) {
        finishing.current = false
        setError(t('error_save'))
        return
      }
      setResult(res.result)
      setStreak(res.streak)
    },
    [puzzle.day, puzzle.locale, t]
  )

  // Tutte le parole fissate: si salva il risultato
  useEffect(() => {
    if (!restored || done || puzzle.slots.length === 0) return
    const solved = puzzle.slots.every((slot) => cellsOf(slot).every((x) => locked.has(key(x.r, x.c))))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (solved) finish(letters, hints, seconds)
  }, [restored, done, puzzle.slots, locked, letters, hints, seconds, finish])

  // Controllo delle parole piene che toccano una casella
  const checkAround = useCallback(
    (cell: Cell, grid: string[][], lockedNow: Set<string>) => {
      const around = slotsAt.get(key(cell.r, cell.c)) ?? {}
      for (const slot of [around.a, around.d]) {
        if (!slot || checking.current.has(slot.id)) continue
        const cells = cellsOf(slot)
        if (cells.every((x) => lockedNow.has(key(x.r, x.c)))) continue
        const guess = cells.map((x) => grid[x.r][x.c]).join('')
        if (guess.length !== slot.len) continue
        checking.current.add(slot.id)
        checkNexusWord(puzzle.day, puzzle.locale, slot.id, guess)
          .then((ok) => {
            if (!ok) {
              setWrong(slot.id)
              setTimeout(() => setWrong((w) => (w === slot.id ? null : w)), 2200)
              return
            }
            setLocked((prev) => {
              const next = new Set(prev)
              cells.forEach((x) => next.add(key(x.r, x.c)))
              return next
            })
          })
          .catch(() => setError(t('error_check')))
          .finally(() => checking.current.delete(slot.id))
      }
    },
    [slotsAt, puzzle.day, puzzle.locale, t]
  )

  const select = (cell: Cell) => {
    const here = slotsAt.get(key(cell.r, cell.c))
    if (!here) return
    if (cell.r === cursor.r && cell.c === cursor.c && here.a && here.d) setDir(dir === 'a' ? 'd' : 'a')
    else if (!here[dir]) setDir(here.a ? 'a' : 'd')
    setCursor(cell)
  }

  const moveInSlot = (from: Cell, step: 1 | -1): Cell | null => {
    const cells = cellsOf(activeSlot)
    const index = cells.findIndex((x) => x.r === from.r && x.c === from.c)
    for (let i = index + step; i >= 0 && i < cells.length; i += step) if (!locked.has(key(cells[i].r, cells[i].c))) return cells[i]
    return null
  }

  const type = (letter: string) => {
    if (done) return
    const cells = cellsOf(activeSlot)
    let index = cells.findIndex((x) => x.r === cursor.r && x.c === cursor.c)
    if (index < 0) return
    // Caselle già giuste: se si scrive la stessa lettera si va avanti (chi
    // scrive la parola intera), altrimenti la lettera va nella prossima libera
    while (index < cells.length && locked.has(key(cells[index].r, cells[index].c))) {
      if (letters[cells[index].r][cells[index].c] === letter) {
        setCursor(cells[Math.min(index + 1, cells.length - 1)])
        return
      }
      index++
    }
    if (index >= cells.length) return
    const target = cells[index]
    const grid = letters.map((row) => [...row])
    grid[target.r][target.c] = letter
    setLetters(grid)
    setError(null)
    // Avanti alla casella successiva della parola
    setCursor(cells[Math.min(index + 1, cells.length - 1)])
    checkAround(target, grid, locked)
  }

  const erase = () => {
    if (done) return
    const grid = letters.map((row) => [...row])
    const here = key(cursor.r, cursor.c)
    if (!locked.has(here) && grid[cursor.r][cursor.c]) {
      grid[cursor.r][cursor.c] = ''
    } else {
      const prev = moveInSlot(cursor, -1)
      if (!prev) return
      grid[prev.r][prev.c] = ''
      setCursor(prev)
    }
    setLetters(grid)
  }

  const goSlot = (step: 1 | -1) => {
    const index = puzzle.slots.findIndex((s) => s.id === activeSlot.id)
    const next = puzzle.slots[(index + step + puzzle.slots.length) % puzzle.slots.length]
    const cells = cellsOf(next)
    setDir(next.dir)
    setCursor(cells.find((x) => !locked.has(key(x.r, x.c)) && !letters[x.r][x.c]) ?? cells[0])
  }

  const hint = async () => {
    if (done || busy) return
    const target = !locked.has(key(cursor.r, cursor.c)) ? cursor : cellsOf(activeSlot).find((x) => !locked.has(key(x.r, x.c)))
    if (!target) return
    setBusy(true)
    const letter = await revealNexusLetter(puzzle.day, puzzle.locale, target.r, target.c).catch(() => null)
    setBusy(false)
    if (!letter) {
      setError(t('error_check'))
      return
    }
    const grid = letters.map((row) => [...row])
    grid[target.r][target.c] = letter
    const nextLocked = new Set(locked).add(key(target.r, target.c))
    setLetters(grid)
    setLocked(nextLocked)
    setHints(hints + 1)
    checkAround(target, grid, nextLocked)
  }

  // Tastiera del computer
  useEffect(() => {
    if (done || !started) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        type(e.key.toUpperCase())
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        erase()
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        goSlot(e.shiftKey ? -1 : 1)
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
        const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        const wanted: NexusDir = dr !== 0 ? 'd' : 'a'
        if (wanted !== dir && slotsAt.get(key(cursor.r, cursor.c))?.[wanted]) {
          setDir(wanted)
          return
        }
        for (let r = cursor.r + dr, c = cursor.c + dc; r >= 0 && c >= 0 && r < size && c < size; r += dr, c += dc)
          if (puzzle.open[r][c]) {
            select({ r, c })
            break
          }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const share = async () => {
    const date = new Date(`${puzzle.day}T12:00:00Z`).toLocaleDateString(uiLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    const time = formatTime(result?.seconds ?? seconds)
    const blob = await renderNexusShareCard({
      open: puzzle.open,
      date,
      time,
      line: t('cardLine', { streak, hints: result?.hints ?? hints }),
      footer: t('cardFooter'),
      site: window.location.host,
    }).catch(() => null)
    if (!blob) return
    const file = new File([blob], 'kumani-nexus.png', { type: 'image/png' })
    const text = t('shareText', { time })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text })
      } catch {
        // Annullato.
      }
      return
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'kumani-nexus.png'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const dateLabel = new Date(`${puzzle.day}T12:00:00Z`).toLocaleDateString(uiLocale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const clueTag = `${activeSlot.num} ${activeSlot.dir === 'a' ? '→' : '↓'}`

  if (done && result) {
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold-bright)] text-[var(--ink)]">
          <PartyPopper className="h-8 w-8" />
        </span>
        <h2 className="text-3xl font-extrabold text-[var(--ink)]">{t('doneTitle')}</h2>
        <p className="text-base text-gray-600">{t('doneText', { time: formatTime(result.seconds) })}</p>
        <div className="grid w-full grid-cols-3 gap-2">
          {[
            { big: String(streak), small: t('statStreak', { n: streak }) },
            { big: formatTime(result.seconds), small: t('statTime') },
            { big: String(result.hints), small: t('statHints', { n: result.hints }) },
          ].map((stat) => (
            <div key={stat.small} className="rounded-2xl border border-[var(--gold)]/25 bg-white px-2 py-3">
              <div className="text-2xl font-extrabold text-[var(--ink)]">{stat.big}</div>
              <div className="text-xs font-semibold text-gray-600">{stat.small}</div>
            </div>
          ))}
        </div>
        <div className="flex w-full flex-col items-center gap-3 rounded-3xl bg-[var(--ink)] p-5 text-white">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--gold-bright)]">{t('cardTitle')}</p>
          <div className="grid w-40 gap-[3px]" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} aria-hidden>
            {puzzle.open.flatMap((row, r) => row.map((isOpen, c) => <span key={key(r, c)} className={`aspect-square rounded-[3px] ${isOpen ? 'bg-[var(--gold-bright)]' : 'bg-white/10'}`} />))}
          </div>
          <p className="text-sm font-bold first-letter:uppercase">{dateLabel}</p>
        </div>
        <button
          type="button"
          onClick={share}
          className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--gold-bright)] px-4 text-base font-extrabold text-[var(--ink)] hover:brightness-105"
        >
          <Share2 className="h-5 w-5" /> {t('share')}
        </button>
        <NexusDuelButton gridLocale={puzzle.locale} />
        <p className="text-sm text-gray-500">{t('nextGrid')}</p>
      </section>
    )
  }

  // Prima di iniziare: la griglia resta coperta e il tempo fermo
  if (!started) {
    const across = puzzle.slots.filter((s) => s.dir === 'a').length
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-8 text-center">
        <div className="grid w-44 gap-[3px] rounded-2xl bg-[var(--ink)] p-1.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} aria-hidden>
          {puzzle.open.flatMap((row, r) => row.map((isOpen, c) => <span key={key(r, c)} className={`aspect-square rounded-[3px] ${isOpen ? 'bg-white' : 'bg-[var(--ink)]'}`} />))}
        </div>
        <p className="text-sm font-bold text-[var(--ink)] first-letter:uppercase">{dateLabel}</p>
        <p className="text-base text-gray-600">{t('startText', { words: puzzle.slots.length, across, down: puzzle.slots.length - across })}</p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          disabled={!restored}
          className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-4 text-base font-extrabold text-[var(--gold-bright)] disabled:opacity-60"
        >
          <Play className="h-5 w-5" /> {t('start')}
        </button>
        <p className="flex items-center gap-1.5 text-sm text-gray-500">
          <Flame className="h-4 w-4 text-[var(--gold)]" /> {t('streak', { n: streak })}
        </p>
      </section>
    )
  }

  // Definizione scelta (sul telefono resta sopra la tastiera)
  const clueBar = (
    <div className={`flex items-center gap-1.5 rounded-2xl p-1.5 text-white transition-colors ${wrong ? 'bg-rose-800' : 'bg-[var(--ink)]'}`}>
            <button type="button" onClick={() => goSlot(-1)} aria-label={t('prevClue')} className="flex h-11 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/70 hover:bg-white/10">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="shrink-0 rounded-lg bg-[var(--gold-bright)] px-2 py-1 text-sm font-extrabold text-[var(--ink)]">{clueTag}</span>
            <p className="min-w-0 flex-1 px-1 text-[15px] font-semibold leading-snug" aria-live="polite">
              {activeSlot.clue} <span className="text-white/60">({activeSlot.len})</span>
              {wrong && <span className="block text-sm font-bold text-rose-100">{t('wrong')}</span>}
            </p>
            <button
              type="button"
              onClick={hint}
              disabled={busy}
              aria-label={t('hint')}
              title={t('hint')}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--gold-bright)]/50 text-[var(--gold-bright)] hover:bg-white/10 disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Lightbulb className="h-5 w-5" />}
            </button>
            <button type="button" onClick={() => goSlot(1)} aria-label={t('nextClue')} className="flex h-11 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-white/70 hover:bg-white/10">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
  )

  return (
    <section className="mx-auto max-w-4xl px-3 pb-72 pt-3 sm:px-6 sm:pb-10">
      <div className="mb-3 flex items-center justify-between text-sm font-bold text-[var(--ink)]">
        <span className="flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-[var(--gold)]" /> {t('streak', { n: streak })}
        </span>
        <span className="hidden first-letter:uppercase sm:inline">{dateLabel}</span>
        <span className="flex items-center gap-1.5 tabular-nums">
          <Clock className="h-4 w-4 text-[var(--gold)]" /> {formatTime(seconds)}
        </span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="mx-auto w-full max-w-[420px] shrink-0">
          {/* La griglia */}
          <div className="grid gap-[3px] rounded-2xl bg-[var(--ink)] p-1.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} role="grid" aria-label={t('gridLabel')}>
            {puzzle.open.flatMap((row, r) =>
              row.map((isOpen, c) => {
                if (!isOpen) return <span key={key(r, c)} className="aspect-square" aria-hidden />
                const k = key(r, c)
                const isCursor = cursor.r === r && cursor.c === c
                const inSlot = activeCells.has(k)
                const isWrong = wrong !== null && (slotsAt.get(k)?.a?.id === wrong || slotsAt.get(k)?.d?.id === wrong)
                const bg = isCursor ? 'bg-[var(--gold-bright)]' : isWrong ? 'bg-rose-200' : inSlot ? 'bg-[var(--gold-pale)]' : 'bg-white'
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => select({ r, c })}
                    aria-label={t('cellLabel', { row: r + 1, col: c + 1, letter: letters[r][c] || '–' })}
                    className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-[5px] text-[clamp(1.1rem,6vw,1.75rem)] font-extrabold transition-colors ${bg} ${
                      locked.has(k) ? 'text-emerald-800' : 'text-[var(--ink)]'
                    } ${isCursor ? 'shadow-[inset_0_0_0_2px_var(--ink)]' : ''}`}
                  >
                    {puzzle.numbers[r][c] > 0 && <span className="absolute left-1 top-0.5 text-[10px] font-bold leading-none text-[var(--ink)]/70">{puzzle.numbers[r][c]}</span>}
                    {letters[r][c]}
                  </button>
                )
              })
            )}
          </div>

          {/* La definizione della parola scelta */}
          <div className="mt-3 hidden sm:block">{clueBar}</div>
          {error && <p className="mt-2 hidden text-center text-sm font-semibold text-rose-700 sm:block">{error}</p>}
          <p className="mt-2 hidden text-center text-xs text-gray-500 sm:block">{t('keyboardHint')}</p>
        </div>

        {/* Tutte le definizioni */}
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {(['a', 'd'] as NexusDir[]).map((d) => (
            <div key={d} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--gold)]">{d === 'a' ? t('across') : t('down')}</h2>
              <ul className="space-y-1">
                {puzzle.slots
                  .filter((s) => s.dir === d)
                  .map((s) => {
                    const solved = cellsOf(s).every((x) => locked.has(key(x.r, x.c)))
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setDir(s.dir)
                            setCursor({ r: s.row, c: s.col })
                          }}
                          className={`flex w-full cursor-pointer gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${s.id === activeSlot.id ? 'bg-[var(--gold-pale)] font-semibold' : 'hover:bg-gray-50'} ${solved ? 'text-gray-400 line-through' : 'text-[var(--ink)]'}`}
                        >
                          <span className="w-5 shrink-0 font-bold">{s.num}</span>
                          <span>
                            {s.clue} ({s.len})
                          </span>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Tastiera sul telefono */}
      <NexusKeyboard
        onLetter={type}
        onDelete={erase}
        deleteLabel={t('delete')}
        top={
          <>
            {clueBar}
            {error && <p className="mt-1 text-center text-xs font-bold text-rose-700">{error}</p>}
          </>
        }
      />
    </section>
  )
}

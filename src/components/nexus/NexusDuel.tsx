'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Clock, Copy, Crown, Flag, Handshake, LoaderCircle, Play, Send, Share2, Swords, UserRound } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/client'
import { createNexusDuel, getNexusDuel, joinNexusDuel, leaveNexusDuel, playNexusDuel, startNexusDuel } from '@/app/actions/nexusDuel'
import { NEXUS_MAX_PLAYERS, slotCells, type NexusDir, type NexusDuelState, type NexusSlot } from '@/lib/nexus/types'
import { askConfirm } from '@/lib/confirm'
import NexusKeyboard from './NexusKeyboard'

// KUMANI NEXUS — la Sfida da 2 a 4 giocatori. Lo stato arriva dal server (le
// risposte non escono mai di lì); a ogni mossa il server manda un segnale sul
// canale della sfida e tutti i browser rileggono lo stato.

type Cell = { r: number; c: number }
const key = (r: number, c: number) => `${r},${c}`

// Un colore per posto: si distinguono anche per chiarezza, non solo per tinta
const SEAT = [
  { cell: 'bg-[var(--gold-bright)]', badge: 'bg-[var(--ink)] text-[var(--gold-bright)]', text: 'text-[#8A6417]', ring: 'shadow-[0_0_0_2px_var(--ink)]' },
  { cell: 'bg-teal-200', badge: 'bg-teal-800 text-white', text: 'text-teal-800', ring: 'shadow-[0_0_0_2px_#115e59]' },
  { cell: 'bg-violet-200', badge: 'bg-violet-800 text-white', text: 'text-violet-800', ring: 'shadow-[0_0_0_2px_#5b21b6]' },
  { cell: 'bg-orange-200', badge: 'bg-orange-800 text-white', text: 'text-orange-800', ring: 'shadow-[0_0_0_2px_#9a3412]' },
]

export default function NexusDuel({ initial }: { initial: NexusDuelState }) {
  const t = useTranslations('nexus')
  const locale = useLocale()
  const router = useRouter()
  const [state, setState] = useState<NexusDuelState>(initial)
  const [offset, setOffset] = useState(0)
  const [clock, setClock] = useState(() => Date.now())
  const [slotId, setSlotId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const [copied, setCopied] = useState(false)
  const [link, setLink] = useState('')

  const refresh = useCallback(async () => {
    const next = await getNexusDuel(state.code).catch(() => null)
    if (!next || 'error' in next) return
    setOffset(new Date(next.serverNow).getTime() - Date.now())
    setState(next)
  }, [state.code])

  // Indirizzo da mandare agli amici (dal browser: niente differenze col server)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLink(`${window.location.origin}${locale === 'it' ? '' : `/${locale}`}/marketplace/nexus/duello/${state.code}`)
  }, [locale, state.code])

  // Tempo reale: segnale della sfida, più una lettura di riserva
  useEffect(() => {
    if (state.status === 'finished') return
    const supabase = createClient()
    const channel = supabase
      .channel(state.channel)
      .on('broadcast', { event: 'update' }, () => refresh())
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    const fallback = setInterval(() => document.visibilityState === 'visible' && refresh(), 8000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(fallback)
      supabase.removeChannel(channel)
    }
  }, [state.channel, state.status, refresh])

  useEffect(() => {
    if (state.status !== 'live') return
    const tick = setInterval(() => setClock(Date.now()), 500)
    return () => clearInterval(tick)
  }, [state.status])

  const secondsLeft = state.turnEndsAt ? Math.max(0, Math.ceil((new Date(state.turnEndsAt).getTime() - (clock + offset)) / 1000)) : 0
  // Tempo scaduto: si chiede al server di passare il turno
  useEffect(() => {
    if (state.status === 'live' && state.turnEndsAt && secondsLeft === 0) {
      const timer = setTimeout(refresh, 1200)
      return () => clearTimeout(timer)
    }
  }, [state.status, state.turnEndsAt, secondsLeft, refresh])

  const claimOf = useMemo(() => new Map(state.claims.map((c) => [c.slotId, c])), [state.claims])
  // Di chi è ogni casella (l'ultima parola presa che ci passa)
  const ownerOf = useMemo(() => {
    const map = new Map<string, number>()
    for (const claim of state.claims) {
      const slot = state.puzzle.slots.find((s) => s.id === claim.slotId)
      if (slot) for (const { r, c } of slotCells(slot)) map.set(key(r, c), claim.seat)
    }
    return map
  }, [state.claims, state.puzzle.slots])
  const slotsAt = useMemo(() => {
    const map = new Map<string, { a?: NexusSlot; d?: NexusSlot }>()
    for (const slot of state.puzzle.slots)
      for (const { r, c } of slotCells(slot)) {
        const entry = map.get(key(r, c)) ?? {}
        entry[slot.dir] = slot
        map.set(key(r, c), entry)
      }
    return map
  }, [state.puzzle.slots])

  const nameOf = (seat: number | null) => state.players.find((p) => p.seat === seat)?.name ?? ''
  const myTurn = state.status === 'live' && state.mySeat !== null && state.turnSeat === state.mySeat
  const meLeft = state.players.find((p) => p.me)?.left ?? false
  const active = state.puzzle.slots.find((s) => s.id === slotId && !claimOf.has(s.id)) ?? null
  const activeCells = active ? slotCells(active) : []
  const fixed = (cell: Cell) => !!state.letters[cell.r]?.[cell.c]
  const letterAt = (cell: Cell) => state.letters[cell.r]?.[cell.c] || draft[key(cell.r, cell.c)] || ''
  const guess = activeCells.map(letterAt).join('')
  const ready = !!active && guess.length === active.len
  const crossings = activeCells.filter(fixed).length
  const doubled = activeCells.some((cell) => state.special.includes(key(cell.r, cell.c)))
  const preview = active ? (active.len + 3 * crossings) * (doubled ? 2 : 1) : 0

  const choose = (cell: Cell) => {
    const here = slotsAt.get(key(cell.r, cell.c))
    if (!here) return
    const options = [here.a, here.d].filter((s): s is NexusSlot => !!s && !claimOf.has(s.id))
    if (options.length === 0) return
    // Toccando di nuovo la stessa casella si passa all'altra parola
    const current = options.findIndex((s) => s.id === slotId)
    setSlotId(options[(current + 1) % options.length].id)
  }

  const type = (letter: string) => {
    if (!active || busy) return
    const next = activeCells.find((cell) => !fixed(cell) && !draft[key(cell.r, cell.c)])
    if (next) setDraft((d) => ({ ...d, [key(next.r, next.c)]: letter }))
  }
  const erase = () => {
    if (!active || busy) return
    const last = [...activeCells].reverse().find((cell) => !fixed(cell) && draft[key(cell.r, cell.c)])
    if (!last) return
    setDraft((d) => {
      const copy = { ...d }
      delete copy[key(last.r, last.c)]
      return copy
    })
  }

  const submit = async () => {
    if (!active || !ready || !myTurn || busy) return
    setBusy(true)
    setNotice(null)
    const res = await playNexusDuel(state.code, active.id, guess).catch(() => ({ error: 'error' }))
    setBusy(false)
    if ('error' in res) {
      setNotice({ text: res.error === 'notYourTurn' ? t('duel_notYourTurn') : res.error === 'taken' ? t('duel_taken') : t('error_check'), tone: 'error' })
    } else if (res.correct) {
      setNotice({ text: t('duel_correct', { points: res.points }), tone: 'ok' })
      setSlotId(null)
    } else {
      setNotice({ text: t('duel_wrong'), tone: 'error' })
      // La parola sbagliata si cancella
      setDraft((d) => {
        const copy = { ...d }
        for (const cell of activeCells) delete copy[key(cell.r, cell.c)]
        return copy
      })
    }
    await refresh()
  }

  // Tastiera del computer
  useEffect(() => {
    if (state.status !== 'live') return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        type(e.key.toUpperCase())
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        erase()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const run = async (action: () => Promise<{ ok: true } | { error: string }>, errorText: (error: string) => string) => {
    setBusy(true)
    const res = await action().catch(() => ({ error: 'error' }))
    setBusy(false)
    if ('error' in res) setNotice({ text: errorText(res.error), tone: 'error' })
    await refresh()
  }
  const join = () => run(() => joinNexusDuel(state.code), (e) => (e === 'full' ? t('duel_full') : t('error_load')))
  const start = () => run(() => startNexusDuel(state.code), () => t('duel_needTwo'))
  const leave = async () => {
    const message = state.status === 'live' ? t('duel_leaveConfirm') : state.isHost ? t('duel_cancelConfirm') : t('duel_exitConfirm')
    if (!(await askConfirm(message, { tone: 'danger' }))) return
    const exitLobby = state.status === 'waiting' && !state.isHost
    await run(() => leaveNexusDuel(state.code), () => t('error_save'))
    if (exitLobby) router.push(`${locale === 'it' ? '' : `/${locale}`}/marketplace/nexus`)
  }
  const rematch = async () => {
    setBusy(true)
    const res = await createNexusDuel(state.locale).catch(() => ({ error: 'error' }))
    if ('code' in res) {
      router.push(`${locale === 'it' ? '' : `/${locale}`}/marketplace/nexus/duello/${res.code}`)
      return
    }
    setBusy(false)
    setNotice({ text: t('error_save'), tone: 'error' })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // copia non disponibile
    }
  }

  const lastMoveText = (() => {
    const m = state.lastMove
    if (!m) return state.turnSeat === state.mySeat ? t('duel_firstMoveMine') : t('duel_firstMoveTheirs', { name: nameOf(state.turnSeat) })
    const mine = m.seat === state.mySeat
    const name = nameOf(m.seat)
    if (m.slotId === null) return mine ? t('duel_lastTimeoutMine') : t('duel_lastTimeoutTheirs', { name })
    if (!m.correct) return mine ? t('duel_lastWrongMine') : t('duel_lastWrongTheirs', { name })
    return mine ? t('duel_lastCorrectMine', { word: m.word ?? '', points: m.points }) : t('duel_lastCorrectTheirs', { name, word: m.word ?? '', points: m.points })
  })()

  const host = state.players.find((p) => p.seat === 0)

  // --- Non partecipi: unisciti (se la sfida aspetta) ---
  if (state.mySeat === null) {
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold-bright)] text-[var(--ink)]">
          <Swords className="h-8 w-8" />
        </span>
        <h2 className="text-2xl font-extrabold text-[var(--ink)]">{t('duel_invitedTitle', { name: host?.name ?? '' })}</h2>
        <p className="text-base text-gray-600">{t('duel_invitedText', { n: state.players.length })}</p>
        {state.canJoin ? (
          <button
            type="button"
            onClick={join}
            disabled={busy}
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-4 text-base font-extrabold text-[var(--gold-bright)] disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Handshake className="h-5 w-5" />} {t('duel_join')}
          </button>
        ) : (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">{t('duel_full')}</p>
        )}
        {notice && <p className="text-sm font-semibold text-rose-700">{notice.text}</p>}
      </section>
    )
  }

  // --- Sala d'attesa ---
  if (state.status === 'waiting') {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <div>
          <h2 className="text-2xl font-extrabold text-[var(--ink)]">{t('duel_title')}</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-gray-600">{t('duel_intro')}</p>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-[var(--ink)] p-5 text-white">
          <p className="text-sm font-semibold text-white/75">{t('duel_code')}</p>
          <p className="text-4xl font-extrabold tracking-[0.18em] text-[var(--gold-bright)]">{state.code}</p>
          <div className="flex w-full gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${t('duel_inviteText', { code: state.code })} ${link}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--gold-bright)] px-3 text-[15px] font-extrabold text-[var(--ink)]"
            >
              <Share2 className="h-5 w-5" /> {t('duel_whatsapp')}
            </a>
            <button
              type="button"
              onClick={copy}
              aria-label={t('duel_copy')}
              className="flex min-h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-[var(--gold-bright)]/50 text-[var(--gold-bright)]"
            >
              <Copy className="h-5 w-5" />
            </button>
          </div>
          {copied && <p className="text-sm text-white/75">{t('duel_copied')}</p>}
        </div>

        {/* Giocatori entrati */}
        <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
          <p className="mb-2 text-sm font-extrabold text-[var(--ink)]">{t('duel_players', { n: state.players.length, max: NEXUS_MAX_PLAYERS })}</p>
          <ul className="grid grid-cols-2 gap-2">
            {Array.from({ length: NEXUS_MAX_PLAYERS }, (_, seat) => {
              const p = state.players.find((x) => x.seat === seat)
              return (
                <li key={seat} className={`flex min-h-12 items-center gap-2 rounded-xl px-2.5 ${p ? 'bg-[var(--gold-pale)]/60' : 'border border-dashed border-gray-300'}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${p ? SEAT[seat].badge : 'bg-gray-100 text-gray-400'}`}>
                    {p ? p.name.slice(0, 1).toUpperCase() : <UserRound className="h-4 w-4" />}
                  </span>
                  <span className={`min-w-0 truncate text-sm ${p ? 'font-bold text-[var(--ink)]' : 'text-gray-500'}`}>
                    {p ? (p.me ? `${p.name} (${t('duel_youShort')})` : p.name) : t('duel_emptySeat')}
                  </span>
                </li>
              )
            })}
          </ul>
          {state.isHost && (
            <button
              type="button"
              onClick={start}
              disabled={busy || state.players.length < 2}
              className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-extrabold text-[var(--gold-bright)] disabled:cursor-default disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} {t('duel_start')}
            </button>
          )}
          <p className="mt-2 flex items-center justify-center gap-2 text-center text-sm text-gray-600" aria-live="polite">
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
            {state.isHost ? (state.players.length < 2 ? t('duel_waiting') : t('duel_readyHint')) : t('duel_waitHost', { name: host?.name ?? '' })}
          </p>
        </div>
        <DuelRules />
        {notice && <p className="text-center text-sm font-semibold text-rose-700">{notice.text}</p>}
        <button type="button" onClick={leave} disabled={busy} className="min-h-11 cursor-pointer text-sm font-semibold text-gray-500 hover:text-rose-700">
          {state.isHost ? t('duel_cancel') : t('duel_exit')}
        </button>
      </section>
    )
  }

  // --- Partita (in corso o finita) ---
  const finished = state.status === 'finished'
  const ranking = [...state.players].sort((a, b) => Number(a.left) - Number(b.left) || b.score - a.score)
  const iWon = state.mySeat !== null && state.winners.includes(state.mySeat)
  return (
    <section className="mx-auto max-w-4xl px-3 pb-56 pt-3 sm:px-6 sm:pb-10">
      {/* Punteggi e turno */}
      <div className={`grid gap-2 ${state.players.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
        {state.players.map((p) => {
          const turn = !finished && state.turnSeat === p.seat
          return (
            <div key={p.seat} className={`flex items-center gap-2 rounded-2xl bg-white px-2.5 py-2 ${turn ? SEAT[p.seat].ring : 'border border-gray-200'} ${p.left ? 'opacity-50' : ''}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${SEAT[p.seat].badge}`}>{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0">
                <span className="block text-xl font-extrabold leading-none text-[var(--ink)]">{p.score}</span>
                <span className={`block truncate text-xs font-bold ${SEAT[p.seat].text}`}>
                  {p.left ? `${p.name} · ${t('duel_leftShort')}` : turn ? (p.me ? t('duel_yourTurn') : t('duel_theirTurn', { name: p.name })) : p.me ? `${p.name} (${t('duel_youShort')})` : p.name}
                </span>
              </span>
            </div>
          )
        })}
      </div>

      {finished ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-3xl bg-[var(--ink)] p-5 text-center text-white">
          <Crown className="h-8 w-8 text-[var(--gold-bright)]" />
          <p className="text-2xl font-extrabold">
            {state.winners.length > 1 ? t('duel_draw') : iWon ? t('duel_won') : state.winners.length === 1 ? t('duel_lost', { name: nameOf(state.winners[0]) }) : t('duel_over')}
          </p>
          <ol className="w-full space-y-1.5 text-left">
            {ranking.map((p, i) => (
              <li key={p.seat} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <span className="w-5 font-extrabold text-[var(--gold-bright)]">{i + 1}</span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${SEAT[p.seat].badge}`}>{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {p.name}
                  {p.me ? ` (${t('duel_youShort')})` : ''}
                  {p.left ? ` · ${t('duel_leftShort')}` : ''}
                </span>
                <span className="font-extrabold">{p.score}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-white/75">{state.stalledOut ? t('duel_endStall') : t('duel_endSolution')}</p>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <button type="button" onClick={rematch} disabled={busy} className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--gold-bright)] px-4 font-extrabold text-[var(--ink)] disabled:opacity-60">
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />} {t('duel_rematch')}
            </button>
            <Link href="/marketplace/nexus" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/30 px-4 font-bold text-white hover:bg-white/10">
              {t('duel_backToDaily')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          <p className="min-w-0 flex-1 truncate rounded-xl border border-[var(--gold)]/20 bg-white px-3 py-2 text-[13px] text-[var(--ink)]" aria-live="polite">
            {lastMoveText}
          </p>
          <span className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 font-extrabold tabular-nums ${secondsLeft <= 10 ? 'bg-rose-100 text-rose-800' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
            <Clock className="h-4 w-4" /> 0:{String(secondsLeft).padStart(2, '0')}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="mx-auto w-full max-w-[440px] shrink-0">
          <div className="grid gap-[3px] rounded-2xl bg-[var(--ink)] p-1.5" style={{ gridTemplateColumns: `repeat(${state.puzzle.size}, minmax(0, 1fr))` }} role="grid" aria-label={t('gridLabel')}>
            {state.puzzle.open.flatMap((row, r) =>
              row.map((isOpen, c) => {
                if (!isOpen) return <span key={key(r, c)} className="aspect-square" aria-hidden />
                const k = key(r, c)
                const owner = ownerOf.get(k)
                const inActive = activeCells.some((cell) => cell.r === r && cell.c === c)
                const bg = inActive ? 'bg-[var(--gold-pale)] shadow-[inset_0_0_0_2px_var(--ink)]' : owner !== undefined ? SEAT[owner].cell : 'bg-white'
                const letter = letterAt({ r, c })
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => !finished && !meLeft && choose({ r, c })}
                    aria-label={t('cellLabel', { row: r + 1, col: c + 1, letter: letter || '–' })}
                    className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-[4px] text-[clamp(0.9rem,4.6vw,1.4rem)] font-extrabold text-[var(--ink)] ${bg}`}
                  >
                    {state.puzzle.numbers[r][c] > 0 && <span className="absolute left-0.5 top-0 text-[9px] font-bold leading-none opacity-70">{state.puzzle.numbers[r][c]}</span>}
                    {state.special.includes(k) && <span className="absolute bottom-0 right-0.5 text-[9px] font-extrabold text-[#8A6417]">×2</span>}
                    {letter}
                  </button>
                )
              })
            )}
          </div>

          {!finished && !meLeft && (
            <div className="mt-3 rounded-2xl bg-[var(--ink)] p-3 text-white">
              {active ? (
                <>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 rounded-lg bg-[var(--gold-bright)] px-2 py-1 text-sm font-extrabold text-[var(--ink)]">
                      {active.num} {active.dir === 'a' ? '→' : '↓'}
                    </span>
                    <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                      {active.clue} <span className="text-white/60">({active.len})</span>
                    </p>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--gold-bright)]">
                      {t('duel_preview', { points: preview, crossings })}
                      {doubled ? ' · ×2' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={submit}
                      disabled={!ready || !myTurn || busy}
                      className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--gold-bright)] px-4 text-sm font-extrabold text-[var(--ink)] disabled:cursor-default disabled:opacity-50"
                    >
                      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t('duel_submit')}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-white/80">{myTurn ? t('duel_pickWord') : t('duel_waitTurn', { name: nameOf(state.turnSeat) })}</p>
              )}
            </div>
          )}
          {notice && <p className={`mt-2 text-center text-sm font-semibold ${notice.tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{notice.text}</p>}
          {!finished && !meLeft && (
            <button type="button" onClick={leave} disabled={busy} className="mx-auto mt-3 flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-rose-700">
              <Flag className="h-4 w-4" /> {t('duel_leave')}
            </button>
          )}
        </div>

        {/* Definizioni */}
        <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {(['a', 'd'] as NexusDir[]).map((d) => (
            <div key={d} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-[0.15em] text-[var(--gold)]">{d === 'a' ? t('across') : t('down')}</h2>
              <ul className="space-y-1">
                {state.puzzle.slots
                  .filter((s) => s.dir === d)
                  .map((s) => {
                    const claim = claimOf.get(s.id)
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          disabled={!!claim || finished || meLeft}
                          onClick={() => setSlotId(s.id)}
                          className={`flex w-full cursor-pointer gap-2 rounded-lg px-2 py-1.5 text-left text-sm disabled:cursor-default ${s.id === active?.id ? 'bg-[var(--gold-pale)] font-semibold' : 'hover:bg-gray-50'} ${
                            claim ? `${SEAT[claim.seat].text} line-through` : 'text-[var(--ink)]'
                          }`}
                        >
                          <span className="w-5 shrink-0 font-bold">{s.num}</span>
                          <span className="flex-1">
                            {s.clue} ({s.len})
                          </span>
                          {claim && <span className="shrink-0 text-xs font-bold">+{claim.points}</span>}
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {!finished && !meLeft && <NexusKeyboard onLetter={type} onDelete={erase} deleteLabel={t('delete')} disabled={!active} />}
    </section>
  )
}

function DuelRules() {
  const t = useTranslations('nexus')
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
      <p className="text-[15px] font-extrabold text-[var(--ink)]">{t('duel_rulesTitle')}</p>
      {[t('duel_rule1'), t('duel_rule2'), t('duel_rule3'), t('duel_rule4')].map((rule, i) => (
        <p key={rule} className="flex gap-2.5 text-sm leading-snug text-[var(--ink)]">
          <b className="w-4 shrink-0 text-[#8A6417]">{i + 1}</b>
          <span>{rule}</span>
        </p>
      ))}
    </div>
  )
}

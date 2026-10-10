'use server'

import { randomUUID } from 'node:crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { buildNexus, rngFrom } from '@/lib/nexus/grid'
import {
  NEXUS_DUEL_SIZE,
  NEXUS_LOCALES,
  NEXUS_STALL_LIMIT,
  NEXUS_TURN_SECONDS,
  slotCells,
  type NexusDuelState,
  type NexusLocale,
} from '@/lib/nexus/types'

// KUMANI NEXUS — il duello. Tutte le regole stanno qui: la griglia si
// ricostruisce dal seme della sfida, le risposte non escono dal server.
// Il turno scaduto passa all'altro quando qualcuno rilegge lo stato.

type Duel = {
  id: string
  code: string
  locale: NexusLocale
  seed: string
  status: 'waiting' | 'live' | 'finished'
  host_id: string
  guest_id: string | null
  turn_id: string | null
  turn_ends_at: string | null
  stall: number
  host_score: number
  guest_score: number
  winner_id: string | null
}
type Move = { user_id: string; slot_id: string | null; correct: boolean; points: number; crossings: number }

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DUEL_COLUMNS = 'id, code, locale, seed, status, host_id, guest_id, turn_id, turn_ends_at, stall, host_score, guest_score, winner_id'

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

async function player() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'nexus'))) return null
  return user
}

const cleanCode = (code: string) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
const turnEnd = () => new Date(Date.now() + NEXUS_TURN_SECONDS * 1000).toISOString()

function gridOf(duel: Pick<Duel, 'seed' | 'locale'>) {
  const solution = buildNexus(`duel:${duel.seed}`, '', duel.locale, NEXUS_DUEL_SIZE)
  // Due caselle ×2, scelte tra gli incroci
  const count = new Map<string, number>()
  for (const slot of solution.puzzle.slots) for (const { r, c } of slotCells(slot)) count.set(`${r},${c}`, (count.get(`${r},${c}`) ?? 0) + 1)
  const crossings = [...count].filter(([, n]) => n > 1).map(([k]) => k)
  const pool = crossings.length >= 2 ? crossings : [...count.keys()]
  const rnd = rngFrom(`special:${duel.seed}`)
  const special: string[] = []
  while (special.length < Math.min(2, pool.length)) {
    const pick = pool[Math.floor(rnd() * pool.length)]
    if (!special.includes(pick)) special.push(pick)
  }
  return { ...solution, special }
}

async function signal(duelId: string) {
  await service()
    .rpc('nexus_duel_signal', { p_duel: duelId })
    .then(
      () => null,
      () => null
    )
}

async function loadDuel(code: string): Promise<Duel | null> {
  const { data } = await service().from('nexus_duels').select(DUEL_COLUMNS).eq('code', cleanCode(code)).maybeSingle<Duel>()
  return data ?? null
}

// Fine partita: tutte le parole prese o troppi turni a vuoto
async function maybeFinish(duel: Duel, claimed: number, totalSlots: number) {
  if (claimed < totalSlots && duel.stall < NEXUS_STALL_LIMIT) return duel
  const winner = duel.host_score === duel.guest_score ? null : duel.host_score > duel.guest_score ? duel.host_id : duel.guest_id
  const { data } = await service()
    .from('nexus_duels')
    .update({ status: 'finished', turn_id: null, turn_ends_at: null, winner_id: winner, updated_at: new Date().toISOString() })
    .eq('id', duel.id)
    .eq('status', 'live')
    .select(DUEL_COLUMNS)
    .maybeSingle<Duel>()
  return data ?? duel
}

// Turno scaduto: passa all'altro (una volta sola, anche con due letture insieme)
async function advanceIfExpired(duel: Duel, totalSlots: number, claimed: number): Promise<Duel> {
  if (duel.status !== 'live' || !duel.turn_ends_at || new Date(duel.turn_ends_at).getTime() > Date.now() || !duel.turn_id || !duel.guest_id) return duel
  const other = duel.turn_id === duel.host_id ? duel.guest_id : duel.host_id
  const { data } = await service()
    .from('nexus_duels')
    .update({ turn_id: other, turn_ends_at: turnEnd(), stall: duel.stall + 1, updated_at: new Date().toISOString() })
    .eq('id', duel.id)
    .eq('status', 'live')
    .eq('turn_ends_at', duel.turn_ends_at)
    .select(DUEL_COLUMNS)
    .maybeSingle<Duel>()
  if (!data) return (await loadDuel(duel.code)) ?? duel
  await service().from('nexus_duel_moves').insert({ duel_id: duel.id, user_id: duel.turn_id, slot_id: null, correct: false })
  const next = await maybeFinish(data, claimed, totalSlots)
  await signal(duel.id)
  return next
}

async function nameOf(userId: string | null): Promise<string> {
  if (!userId) return ''
  const { data } = await service().from('profiles').select('first_name').eq('id', userId).maybeSingle<{ first_name: string | null }>()
  return data?.first_name?.trim() || 'Kumano'
}

function stateOf(duel: Duel, userId: string, moves: Move[], names: { host: string; guest: string }): NexusDuelState {
  const grid = gridOf(duel)
  const me = duel.host_id === userId ? 'host' : duel.guest_id === userId ? 'guest' : null
  const claimsByMove = moves.filter((m) => m.correct && m.slot_id)
  // A partita finita si vede tutta la soluzione
  const letters = grid.letters.map((row) => row.map((ch) => (duel.status === 'finished' && me ? ch : '')))
  for (const move of claimsByMove) {
    const slot = grid.puzzle.slots.find((s) => s.id === move.slot_id)
    if (slot) for (const { r, c } of slotCells(slot)) letters[r][c] = grid.letters[r][c]
  }
  const last = moves[moves.length - 1]
  const result =
    duel.status !== 'finished' || !me ? null : duel.winner_id === null ? 'draw' : duel.winner_id === userId ? 'won' : 'lost'
  return {
    code: duel.code,
    channel: `nexus:${duel.id}`,
    locale: duel.locale,
    status: duel.status,
    me,
    canJoin: !me && duel.status === 'waiting' && !duel.guest_id,
    host: { name: names.host, score: duel.host_score },
    guest: duel.guest_id ? { name: names.guest, score: duel.guest_score } : null,
    myTurn: duel.status === 'live' && duel.turn_id === userId,
    turnEndsAt: duel.turn_ends_at,
    serverNow: new Date().toISOString(),
    stall: duel.stall,
    puzzle: { size: grid.puzzle.size, open: grid.puzzle.open, numbers: grid.puzzle.numbers, slots: me ? grid.puzzle.slots : [] },
    special: grid.special,
    claims: claimsByMove.map((m) => ({ slotId: m.slot_id!, mine: m.user_id === userId, points: m.points, crossings: m.crossings })),
    letters,
    lastMove: last
      ? {
          mine: last.user_id === userId,
          slotId: last.slot_id,
          correct: last.correct,
          points: last.points,
          word: last.correct && last.slot_id ? grid.answers[last.slot_id] ?? null : null,
        }
      : null,
    result,
  }
}

async function movesOf(duelId: string): Promise<Move[]> {
  const { data } = await service().from('nexus_duel_moves').select('user_id, slot_id, correct, points, crossings').eq('duel_id', duelId).order('id')
  return (data ?? []) as Move[]
}

export async function createNexusDuel(locale: string): Promise<{ code: string } | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  const lang: NexusLocale = (NEXUS_LOCALES as readonly string[]).includes(locale) ? (locale as NexusLocale) : 'it'
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
    const { error } = await service().from('nexus_duels').insert({ code, locale: lang, seed: randomUUID(), host_id: user.id })
    if (!error) {
      await awardToolPoint('nexus')
      return { code }
    }
    if (!error.message.includes('duplicate')) {
      console.error('[NexusDuel] create failed:', error.message)
      return { error: 'saveError' }
    }
  }
  return { error: 'saveError' }
}

export async function joinNexusDuel(code: string): Promise<{ ok: true } | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  const duel = await loadDuel(code)
  if (!duel) return { error: 'notFound' }
  if (duel.host_id === user.id || duel.guest_id === user.id) return { ok: true }
  if (duel.status !== 'waiting' || duel.guest_id) return { error: 'full' }
  // Chi ha creato la sfida gioca per primo
  const { data } = await service()
    .from('nexus_duels')
    .update({ guest_id: user.id, status: 'live', turn_id: duel.host_id, turn_ends_at: turnEnd(), updated_at: new Date().toISOString() })
    .eq('id', duel.id)
    .eq('status', 'waiting')
    .is('guest_id', null)
    .select('id')
    .maybeSingle()
  if (!data) return { error: 'full' }
  await awardToolPoint('nexus')
  await signal(duel.id)
  return { ok: true }
}

export async function getNexusDuel(code: string): Promise<NexusDuelState | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  let duel = await loadDuel(code)
  if (!duel) return { error: 'notFound' }
  const isPlayer = duel.host_id === user.id || duel.guest_id === user.id
  if (!isPlayer && duel.status !== 'waiting') return { error: 'full' }
  let moves = await movesOf(duel.id)
  if (isPlayer && duel.status === 'live') {
    const total = gridOf(duel).puzzle.slots.length
    const before = duel.turn_ends_at
    duel = await advanceIfExpired(duel, total, moves.filter((m) => m.correct).length)
    if (duel.turn_ends_at !== before) moves = await movesOf(duel.id)
  }
  const [host, guest] = await Promise.all([nameOf(duel.host_id), nameOf(duel.guest_id)])
  return stateOf(duel, user.id, moves, { host, guest })
}

export async function playNexusDuel(code: string, slotId: string, guess: string): Promise<{ correct: boolean; points: number } | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  const duel = await loadDuel(code)
  if (!duel || (duel.host_id !== user.id && duel.guest_id !== user.id)) return { error: 'notFound' }
  if (duel.status !== 'live') return { error: 'notLive' }
  if (duel.turn_id !== user.id || !duel.turn_ends_at || new Date(duel.turn_ends_at).getTime() < Date.now() - 2000) return { error: 'notYourTurn' }

  const grid = gridOf(duel)
  const slot = grid.puzzle.slots.find((s) => s.id === slotId)
  const word = String(guess ?? '').toUpperCase()
  if (!slot || !/^[A-Z]+$/.test(word) || word.length !== slot.len) return { error: 'invalid' }
  const moves = await movesOf(duel.id)
  const claimed = moves.filter((m) => m.correct && m.slot_id)
  if (claimed.some((m) => m.slot_id === slotId)) return { error: 'taken' }

  const correct = grid.answers[slotId] === word
  let points = 0
  let crossings = 0
  if (correct) {
    // Incroci con le parole già prese (da chiunque)
    const taken = new Set<string>()
    for (const move of claimed) {
      const other = grid.puzzle.slots.find((s) => s.id === move.slot_id)
      if (other) for (const { r, c } of slotCells(other)) taken.add(`${r},${c}`)
    }
    const cells = slotCells(slot).map(({ r, c }) => `${r},${c}`)
    crossings = cells.filter((k) => taken.has(k)).length
    points = slot.len + 3 * crossings
    if (cells.some((k) => grid.special.includes(k))) points *= 2
  }

  const isHost = duel.host_id === user.id
  const other = isHost ? duel.guest_id : duel.host_id
  const { data: updated } = await service()
    .from('nexus_duels')
    .update({
      turn_id: other,
      turn_ends_at: turnEnd(),
      stall: correct ? 0 : duel.stall + 1,
      ...(isHost ? { host_score: duel.host_score + points } : { guest_score: duel.guest_score + points }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', duel.id)
    .eq('status', 'live')
    .eq('turn_id', user.id)
    .eq('turn_ends_at', duel.turn_ends_at)
    .select(DUEL_COLUMNS)
    .maybeSingle<Duel>()
  if (!updated) return { error: 'notYourTurn' }

  await service().from('nexus_duel_moves').insert({ duel_id: duel.id, user_id: user.id, slot_id: slotId, correct, points, crossings })
  await maybeFinish(updated, claimed.length + (correct ? 1 : 0), grid.puzzle.slots.length)
  await signal(duel.id)
  return { correct, points }
}

// Abbandono: vince l'altro (o la sfida si chiude se nessuno si era ancora unito)
export async function leaveNexusDuel(code: string): Promise<{ ok: true } | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  const duel = await loadDuel(code)
  if (!duel || (duel.host_id !== user.id && duel.guest_id !== user.id) || duel.status === 'finished') return { error: 'notFound' }
  const winner = duel.status === 'live' ? (duel.host_id === user.id ? duel.guest_id : duel.host_id) : null
  await service()
    .from('nexus_duels')
    .update({ status: 'finished', turn_id: null, turn_ends_at: null, winner_id: winner, updated_at: new Date().toISOString() })
    .eq('id', duel.id)
    .neq('status', 'finished')
  await signal(duel.id)
  return { ok: true }
}

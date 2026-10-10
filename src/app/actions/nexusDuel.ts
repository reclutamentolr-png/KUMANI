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
  NEXUS_MAX_PLAYERS,
  NEXUS_STALL_PER_PLAYER,
  nexusTurnSeconds,
  slotCells,
  type NexusDuelState,
  type NexusLocale,
} from '@/lib/nexus/types'

// KUMANI NEXUS — la Sfida da 2 a 4 giocatori. Tutte le regole stanno qui: la
// griglia si ricostruisce dal seme della sfida, le risposte non escono dal
// server. Il turno scaduto passa al successivo quando qualcuno rilegge lo stato.

type Duel = {
  id: string
  code: string
  locale: NexusLocale
  seed: string
  status: 'waiting' | 'live' | 'finished'
  host_id: string
  turn_id: string | null
  turn_ends_at: string | null
  stall: number
}
type Player = { user_id: string; seat: number; score: number; left_at: string | null }
type Move = { user_id: string; slot_id: string | null; correct: boolean; points: number; crossings: number }

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DUEL_COLUMNS = 'id, code, locale, seed, status, host_id, turn_id, turn_ends_at, stall'

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

const cleanCode = (code: string) =>
  String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
const active = (players: Player[]) => players.filter((p) => !p.left_at).sort((a, b) => a.seat - b.seat)
const turnEnd = (players: Player[]) => new Date(Date.now() + nexusTurnSeconds(active(players).length) * 1000).toISOString()
const now = () => new Date().toISOString()

// Il prossimo giocatore ancora in partita, in ordine di posto
function nextTurn(players: Player[], current: string | null): string | null {
  const list = active(players)
  if (list.length === 0) return null
  const seat = players.find((p) => p.user_id === current)?.seat ?? -1
  return (list.find((p) => p.seat > seat) ?? list[0]).user_id
}

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

async function playersOf(duelId: string): Promise<Player[]> {
  const { data } = await service().from('nexus_duel_players').select('user_id, seat, score, left_at').eq('duel_id', duelId).order('seat')
  return (data ?? []) as Player[]
}

async function movesOf(duelId: string): Promise<Move[]> {
  const { data } = await service().from('nexus_duel_moves').select('user_id, slot_id, correct, points, crossings').eq('duel_id', duelId).order('id')
  return (data ?? []) as Move[]
}

async function finish(duel: Duel) {
  await service()
    .from('nexus_duels')
    .update({ status: 'finished', turn_id: null, turn_ends_at: null, updated_at: now() })
    .eq('id', duel.id)
    .neq('status', 'finished')
}

// Fine partita: parole tutte prese, troppi turni a vuoto o un solo giocatore rimasto
async function maybeFinish(duel: Duel, players: Player[], claimed: number, totalSlots: number): Promise<boolean> {
  const left = active(players).length
  if (claimed < totalSlots && duel.stall < NEXUS_STALL_PER_PLAYER * Math.max(left, 1) && left >= 2) return false
  await finish(duel)
  return true
}

// Turno scaduto: passa al prossimo (una volta sola, anche con due letture insieme)
async function advanceIfExpired(duel: Duel, players: Player[], claimed: number, totalSlots: number) {
  if (duel.status !== 'live' || !duel.turn_ends_at || new Date(duel.turn_ends_at).getTime() > Date.now()) return false
  const { data } = await service()
    .from('nexus_duels')
    .update({ turn_id: nextTurn(players, duel.turn_id), turn_ends_at: turnEnd(players), stall: duel.stall + 1, updated_at: now() })
    .eq('id', duel.id)
    .eq('status', 'live')
    .eq('turn_ends_at', duel.turn_ends_at)
    .select(DUEL_COLUMNS)
    .maybeSingle<Duel>()
  if (!data) return true
  if (duel.turn_id) await service().from('nexus_duel_moves').insert({ duel_id: duel.id, user_id: duel.turn_id, slot_id: null, correct: false })
  await maybeFinish(data, players, claimed, totalSlots)
  await signal(duel.id)
  return true
}

async function namesOf(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data } = await service().from('profiles').select('id, first_name').in('id', ids)
  return new Map((data ?? []).map((p) => [p.id as string, ((p.first_name as string | null) ?? '').trim() || 'Kumano']))
}

function stateOf(duel: Duel, userId: string, players: Player[], moves: Move[], names: Map<string, string>): NexusDuelState {
  const grid = gridOf(duel)
  const mine = players.find((p) => p.user_id === userId) ?? null
  const seatOf = new Map(players.map((p) => [p.user_id, p.seat]))
  const claims = moves.filter((m) => m.correct && m.slot_id)
  const finished = duel.status === 'finished'
  // A partita finita si vede tutta la soluzione
  const letters = grid.letters.map((row) => row.map((ch) => (finished && mine ? ch : '')))
  for (const move of claims) {
    const slot = grid.puzzle.slots.find((s) => s.id === move.slot_id)
    if (slot) for (const { r, c } of slotCells(slot)) letters[r][c] = grid.letters[r][c]
  }
  const stillIn = active(players)
  const best = Math.max(...stillIn.map((p) => p.score), -1)
  const last = moves[moves.length - 1]
  return {
    code: duel.code,
    channel: `nexus:${duel.id}`,
    locale: duel.locale,
    status: duel.status,
    mySeat: mine?.seat ?? null,
    isHost: duel.host_id === userId,
    canJoin: !mine && duel.status === 'waiting' && players.length < NEXUS_MAX_PLAYERS,
    players: players.map((p) => ({ seat: p.seat, name: names.get(p.user_id) ?? 'Kumano', score: p.score, me: p.user_id === userId, left: !!p.left_at })),
    turnSeat: duel.turn_id ? (seatOf.get(duel.turn_id) ?? null) : null,
    turnEndsAt: duel.turn_ends_at,
    serverNow: now(),
    stalledOut: finished && duel.stall >= NEXUS_STALL_PER_PLAYER * Math.max(stillIn.length, 1),
    puzzle: { size: grid.puzzle.size, open: grid.puzzle.open, numbers: grid.puzzle.numbers, slots: mine ? grid.puzzle.slots : [] },
    special: grid.special,
    claims: claims.map((m) => ({ slotId: m.slot_id!, seat: seatOf.get(m.user_id) ?? 0, points: m.points, crossings: m.crossings })),
    letters,
    lastMove: last
      ? {
          seat: seatOf.get(last.user_id) ?? 0,
          slotId: last.slot_id,
          correct: last.correct,
          points: last.points,
          word: last.correct && last.slot_id ? (grid.answers[last.slot_id] ?? null) : null,
        }
      : null,
    winners: finished ? stillIn.filter((p) => p.score === best).map((p) => p.seat) : [],
  }
}

export async function createNexusDuel(locale: string): Promise<{ code: string } | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  const lang: NexusLocale = (NEXUS_LOCALES as readonly string[]).includes(locale) ? (locale as NexusLocale) : 'it'
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
    const { data, error } = await service().from('nexus_duels').insert({ code, locale: lang, seed: randomUUID(), host_id: user.id }).select('id').single()
    if (!error && data) {
      await service().from('nexus_duel_players').insert({ duel_id: data.id, user_id: user.id, seat: 0 })
      await awardToolPoint('nexus')
      return { code }
    }
    if (!error?.message.includes('duplicate')) {
      console.error('[NexusDuel] create failed:', error?.message)
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
  const players = await playersOf(duel.id)
  if (players.some((p) => p.user_id === user.id)) return { ok: true }
  if (duel.status !== 'waiting') return { error: 'full' }
  // Primo posto libero (due ingressi insieme: il secondo prova il posto dopo)
  for (let seat = 0; seat < NEXUS_MAX_PLAYERS; seat++) {
    if (players.some((p) => p.seat === seat)) continue
    const { error } = await service().from('nexus_duel_players').insert({ duel_id: duel.id, user_id: user.id, seat })
    if (!error) {
      await awardToolPoint('nexus')
      await signal(duel.id)
      return { ok: true }
    }
  }
  return { error: 'full' }
}

// Chi ha creato la sfida la avvia quando ci sono almeno 2 giocatori
export async function startNexusDuel(code: string): Promise<{ ok: true } | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  const duel = await loadDuel(code)
  if (!duel || duel.host_id !== user.id) return { error: 'notFound' }
  const players = await playersOf(duel.id)
  if (duel.status !== 'waiting' || players.length < 2) return { error: 'notReady' }
  const { data } = await service()
    .from('nexus_duels')
    .update({ status: 'live', turn_id: duel.host_id, turn_ends_at: turnEnd(players), updated_at: now() })
    .eq('id', duel.id)
    .eq('status', 'waiting')
    .select('id')
    .maybeSingle()
  if (!data) return { error: 'notReady' }
  await signal(duel.id)
  return { ok: true }
}

export async function getNexusDuel(code: string): Promise<NexusDuelState | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  let duel = await loadDuel(code)
  if (!duel) return { error: 'notFound' }
  let players = await playersOf(duel.id)
  const isPlayer = players.some((p) => p.user_id === user.id)
  if (!isPlayer && duel.status !== 'waiting') return { error: 'full' }
  let moves = await movesOf(duel.id)
  if (isPlayer && duel.status === 'live') {
    const total = gridOf(duel).puzzle.slots.length
    if (await advanceIfExpired(duel, players, moves.filter((m) => m.correct).length, total)) {
      duel = (await loadDuel(code)) ?? duel
      ;[players, moves] = await Promise.all([playersOf(duel.id), movesOf(duel.id)])
    }
  }
  const names = await namesOf(players.map((p) => p.user_id))
  return stateOf(duel, user.id, players, moves, names)
}

export async function playNexusDuel(code: string, slotId: string, guess: string): Promise<{ correct: boolean; points: number } | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  const duel = await loadDuel(code)
  if (!duel) return { error: 'notFound' }
  const players = await playersOf(duel.id)
  const me = players.find((p) => p.user_id === user.id && !p.left_at)
  if (!me) return { error: 'notFound' }
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

  // Il turno passa (solo se è ancora il mio: niente doppie mosse)
  const { data: updated } = await service()
    .from('nexus_duels')
    .update({ turn_id: nextTurn(players, user.id), turn_ends_at: turnEnd(players), stall: correct ? 0 : duel.stall + 1, updated_at: now() })
    .eq('id', duel.id)
    .eq('status', 'live')
    .eq('turn_id', user.id)
    .eq('turn_ends_at', duel.turn_ends_at)
    .select(DUEL_COLUMNS)
    .maybeSingle<Duel>()
  if (!updated) return { error: 'notYourTurn' }

  await service().from('nexus_duel_moves').insert({ duel_id: duel.id, user_id: user.id, slot_id: slotId, correct, points, crossings })
  if (points > 0) await service().from('nexus_duel_players').update({ score: me.score + points }).eq('duel_id', duel.id).eq('user_id', user.id)
  await maybeFinish(updated, players, claimed.length + (correct ? 1 : 0), grid.puzzle.slots.length)
  await signal(duel.id)
  return { correct, points }
}

// Uscita: prima dell'avvio chi ha creato la sfida la chiude, gli altri escono;
// a partita in corso si esce e gli altri continuano (da soli si vince).
export async function leaveNexusDuel(code: string): Promise<{ ok: true } | { error: string }> {
  const user = await player()
  if (!user) return { error: 'access' }
  const duel = await loadDuel(code)
  if (!duel || duel.status === 'finished') return { error: 'notFound' }
  const players = await playersOf(duel.id)
  if (!players.some((p) => p.user_id === user.id)) return { error: 'notFound' }

  if (duel.status === 'waiting') {
    if (duel.host_id === user.id) await finish(duel)
    else await service().from('nexus_duel_players').delete().eq('duel_id', duel.id).eq('user_id', user.id)
  } else {
    await service().from('nexus_duel_players').update({ left_at: now() }).eq('duel_id', duel.id).eq('user_id', user.id)
    const after = players.map((p) => (p.user_id === user.id ? { ...p, left_at: now() } : p))
    if (active(after).length < 2) await finish(duel)
    else if (duel.turn_id === user.id) {
      await service()
        .from('nexus_duels')
        .update({ turn_id: nextTurn(after, user.id), turn_ends_at: turnEnd(after), updated_at: now() })
        .eq('id', duel.id)
        .eq('turn_id', user.id)
    }
  }
  await signal(duel.id)
  return { ok: true }
}

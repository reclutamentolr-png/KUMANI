'use server'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { isToolOnline } from '@/lib/toolOnline'
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

// KUMANI NEXUS — la Sfida da 2 a 4 giocatori. La crea un Kumano; dal link
// entrano iscritti e ospiti (con un nome e un codice segreto che resta nel
// loro browser). Tutte le regole stanno qui: la griglia si ricostruisce dal
// seme della sfida, le risposte non escono dal server. Il turno scaduto passa
// al successivo quando qualcuno rilegge lo stato.

type Duel = {
  id: string
  code: string
  locale: NexusLocale
  seed: string
  status: 'waiting' | 'live' | 'finished'
  host_id: string
  turn_player: string | null
  turn_ends_at: string | null
  stall: number
}
type Player = { id: string; user_id: string | null; token_hash: string | null; nickname: string; seat: number; score: number; left_at: string | null }
type Move = { player_id: string; slot_id: string | null; correct: boolean; points: number; crossings: number }

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DUEL_COLUMNS = 'id, code, locale, seed, status, host_id, turn_player, turn_ends_at, stall'

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Chi sta guardando: un Kumano collegato o nessuno (ospite)
async function viewer() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const cleanCode = (code: string) =>
  String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
const cleanName = (name: string) =>
  String(name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
const active = (players: Player[]) => players.filter((p) => !p.left_at).sort((a, b) => a.seat - b.seat)
const turnEnd = (players: Player[]) => new Date(Date.now() + nexusTurnSeconds(active(players).length) * 1000).toISOString()
const now = () => new Date().toISOString()

// Il mio posto nella sfida: dall'account o dal codice segreto dell'ospite
function findMe(players: Player[], userId: string | null, token: string | null | undefined): Player | null {
  if (userId) {
    const mine = players.find((p) => p.user_id === userId)
    if (mine) return mine
  }
  if (token && token.length >= 20) {
    const h = hash(token)
    return players.find((p) => p.token_hash === h) ?? null
  }
  return null
}

// Il prossimo giocatore ancora in partita, in ordine di posto
function nextTurn(players: Player[], currentId: string | null): string | null {
  const list = active(players)
  if (list.length === 0) return null
  const seat = players.find((p) => p.id === currentId)?.seat ?? -1
  return (list.find((p) => p.seat > seat) ?? list[0]).id
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
  const clean = cleanCode(code)
  if (clean.length !== 6) return null
  const { data } = await service().from('nexus_duels').select(DUEL_COLUMNS).eq('code', clean).maybeSingle<Duel>()
  return data ?? null
}

async function playersOf(duelId: string): Promise<Player[]> {
  const { data } = await service().from('nexus_duel_players').select('id, user_id, token_hash, nickname, seat, score, left_at').eq('duel_id', duelId).order('seat')
  return (data ?? []) as Player[]
}

async function movesOf(duelId: string): Promise<Move[]> {
  const { data } = await service().from('nexus_duel_moves').select('player_id, slot_id, correct, points, crossings').eq('duel_id', duelId).order('id')
  return (data ?? []) as Move[]
}

async function profileName(userId: string): Promise<string> {
  const { data } = await service().from('profiles').select('first_name').eq('id', userId).maybeSingle<{ first_name: string | null }>()
  return cleanName(data?.first_name ?? '') || 'Kumano'
}

async function finish(duel: Duel) {
  await service()
    .from('nexus_duels')
    .update({ status: 'finished', turn_player: null, turn_ends_at: null, updated_at: now() })
    .eq('id', duel.id)
    .neq('status', 'finished')
}

// Fine partita: parole tutte prese, troppi turni a vuoto o un solo giocatore rimasto
async function maybeFinish(duel: Duel, players: Player[], claimed: number, totalSlots: number) {
  const left = active(players).length
  if (claimed < totalSlots && duel.stall < NEXUS_STALL_PER_PLAYER * Math.max(left, 1) && left >= 2) return
  await finish(duel)
}

// Turno scaduto: passa al prossimo (una volta sola, anche con due letture insieme)
async function advanceIfExpired(duel: Duel, players: Player[], claimed: number, totalSlots: number) {
  if (duel.status !== 'live' || !duel.turn_ends_at || new Date(duel.turn_ends_at).getTime() > Date.now()) return false
  const { data } = await service()
    .from('nexus_duels')
    .update({ turn_player: nextTurn(players, duel.turn_player), turn_ends_at: turnEnd(players), stall: duel.stall + 1, updated_at: now() })
    .eq('id', duel.id)
    .eq('status', 'live')
    .eq('turn_ends_at', duel.turn_ends_at)
    .select(DUEL_COLUMNS)
    .maybeSingle<Duel>()
  if (!data) return true
  if (duel.turn_player) await service().from('nexus_duel_moves').insert({ duel_id: duel.id, player_id: duel.turn_player, slot_id: null, correct: false })
  await maybeFinish(data, players, claimed, totalSlots)
  await signal(duel.id)
  return true
}

async function stateOf(duel: Duel, me: Player | null, loggedIn: boolean, players: Player[], moves: Move[]): Promise<NexusDuelState> {
  const grid = gridOf(duel)
  const seatOf = new Map(players.map((p) => [p.id, p.seat]))
  const claims = moves.filter((m) => m.correct && m.slot_id)
  const finished = duel.status === 'finished'
  // A partita finita si vede tutta la soluzione
  const letters = grid.letters.map((row) => row.map((ch) => (finished && me ? ch : '')))
  for (const move of claims) {
    const slot = grid.puzzle.slots.find((s) => s.id === move.slot_id)
    if (slot) for (const { r, c } of slotCells(slot)) letters[r][c] = grid.letters[r][c]
  }
  const stillIn = active(players)
  const best = Math.max(...stillIn.map((p) => p.score), -1)
  const last = moves[moves.length - 1]
  // Chi non è iscritto: a fine partita l'invito a iscriversi, con il codice di chi ha creato la sfida
  let hostReferral: string | null = null
  if (!loggedIn) {
    const { data } = await service().from('profiles').select('referral_code').eq('id', duel.host_id).maybeSingle<{ referral_code: string | null }>()
    hostReferral = data?.referral_code ?? null
  }
  return {
    code: duel.code,
    channel: `nexus:${duel.id}`,
    locale: duel.locale,
    status: duel.status,
    mySeat: me?.seat ?? null,
    isHost: !!me && me.user_id === duel.host_id,
    loggedIn,
    hostReferral,
    canJoin: !me && duel.status === 'waiting' && players.length < NEXUS_MAX_PLAYERS,
    players: players.map((p) => ({ seat: p.seat, name: p.nickname, score: p.score, me: p.id === me?.id, left: !!p.left_at })),
    turnSeat: duel.turn_player ? (seatOf.get(duel.turn_player) ?? null) : null,
    turnEndsAt: duel.turn_ends_at,
    serverNow: now(),
    stalledOut: finished && duel.stall >= NEXUS_STALL_PER_PLAYER * Math.max(stillIn.length, 1),
    puzzle: { size: grid.puzzle.size, open: grid.puzzle.open, numbers: grid.puzzle.numbers, slots: me ? grid.puzzle.slots : [] },
    special: grid.special,
    claims: claims.map((m) => ({ slotId: m.slot_id!, seat: seatOf.get(m.player_id) ?? 0, points: m.points, crossings: m.crossings })),
    letters,
    lastMove: last
      ? {
          seat: seatOf.get(last.player_id) ?? 0,
          slotId: last.slot_id,
          correct: last.correct,
          points: last.points,
          word: last.correct && last.slot_id ? (grid.answers[last.slot_id] ?? null) : null,
        }
      : null,
    winners: finished ? stillIn.filter((p) => p.score === best).map((p) => p.seat) : [],
  }
}

// La crea solo un Kumano con accesso al servizio
export async function createNexusDuel(locale: string): Promise<{ code: string } | { error: string }> {
  const { supabase, user } = await viewer()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'nexus'))) return { error: 'access' }
  const lang: NexusLocale = (NEXUS_LOCALES as readonly string[]).includes(locale) ? (locale as NexusLocale) : 'it'
  const nickname = await profileName(user.id)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
    const { data, error } = await service().from('nexus_duels').insert({ code, locale: lang, seed: randomUUID(), host_id: user.id }).select('id').single()
    if (!error && data) {
      await service().from('nexus_duel_players').insert({ duel_id: data.id, user_id: user.id, nickname, seat: 0 })
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

// Si entra dal link: iscritti con il loro nome, ospiti con quello che scrivono.
// All'ospite torna il codice segreto da tenere nel browser.
export async function joinNexusDuel(code: string, nickname: string, token?: string | null): Promise<{ ok: true; token?: string } | { error: string }> {
  if (!(await isToolOnline('nexus'))) return { error: 'offline' }
  const { user } = await viewer()
  const duel = await loadDuel(code)
  if (!duel) return { error: 'notFound' }
  const players = await playersOf(duel.id)
  if (findMe(players, user?.id ?? null, token)) return { ok: true }
  if (duel.status !== 'waiting') return { error: 'full' }

  const name = user ? await profileName(user.id) : cleanName(nickname)
  if (!name) return { error: 'name' }
  const guestToken = user ? null : randomBytes(24).toString('base64url')
  // Primo posto libero (due ingressi insieme: il secondo prova il posto dopo)
  for (let seat = 0; seat < NEXUS_MAX_PLAYERS; seat++) {
    if (players.some((p) => p.seat === seat)) continue
    const { error } = await service()
      .from('nexus_duel_players')
      .insert({ duel_id: duel.id, user_id: user?.id ?? null, token_hash: guestToken ? hash(guestToken) : null, nickname: name, seat })
    if (!error) {
      if (user) await awardToolPoint('nexus')
      await signal(duel.id)
      return guestToken ? { ok: true, token: guestToken } : { ok: true }
    }
  }
  return { error: 'full' }
}

// Chi ha creato la sfida la avvia quando ci sono almeno 2 giocatori
export async function startNexusDuel(code: string): Promise<{ ok: true } | { error: string }> {
  const { user } = await viewer()
  const duel = await loadDuel(code)
  if (!user || !duel || duel.host_id !== user.id) return { error: 'notFound' }
  const players = await playersOf(duel.id)
  const host = players.find((p) => p.user_id === user.id)
  if (duel.status !== 'waiting' || players.length < 2 || !host) return { error: 'notReady' }
  const { data } = await service()
    .from('nexus_duels')
    .update({ status: 'live', turn_player: host.id, turn_ends_at: turnEnd(players), updated_at: now() })
    .eq('id', duel.id)
    .eq('status', 'waiting')
    .select('id')
    .maybeSingle()
  if (!data) return { error: 'notReady' }
  await signal(duel.id)
  return { ok: true }
}

export async function getNexusDuel(code: string, token?: string | null): Promise<NexusDuelState | { error: string }> {
  const { user } = await viewer()
  let duel = await loadDuel(code)
  if (!duel) return { error: 'notFound' }
  let players = await playersOf(duel.id)
  const me = findMe(players, user?.id ?? null, token)
  if (!me && duel.status !== 'waiting') return { error: 'full' }
  let moves = await movesOf(duel.id)
  if (me && duel.status === 'live') {
    const total = gridOf(duel).puzzle.slots.length
    if (await advanceIfExpired(duel, players, moves.filter((m) => m.correct).length, total)) {
      duel = (await loadDuel(code)) ?? duel
      ;[players, moves] = await Promise.all([playersOf(duel.id), movesOf(duel.id)])
    }
  }
  return stateOf(duel, me ? (players.find((p) => p.id === me.id) ?? me) : null, !!user, players, moves)
}

export async function playNexusDuel(code: string, token: string | null, slotId: string, guess: string): Promise<{ correct: boolean; points: number } | { error: string }> {
  const { user } = await viewer()
  const duel = await loadDuel(code)
  if (!duel) return { error: 'notFound' }
  const players = await playersOf(duel.id)
  const me = findMe(players, user?.id ?? null, token)
  if (!me || me.left_at) return { error: 'notFound' }
  if (duel.status !== 'live') return { error: 'notLive' }
  if (duel.turn_player !== me.id || !duel.turn_ends_at || new Date(duel.turn_ends_at).getTime() < Date.now() - 2000) return { error: 'notYourTurn' }

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
    .update({ turn_player: nextTurn(players, me.id), turn_ends_at: turnEnd(players), stall: correct ? 0 : duel.stall + 1, updated_at: now() })
    .eq('id', duel.id)
    .eq('status', 'live')
    .eq('turn_player', me.id)
    .eq('turn_ends_at', duel.turn_ends_at)
    .select(DUEL_COLUMNS)
    .maybeSingle<Duel>()
  if (!updated) return { error: 'notYourTurn' }

  await service().from('nexus_duel_moves').insert({ duel_id: duel.id, player_id: me.id, slot_id: slotId, correct, points, crossings })
  if (points > 0) await service().from('nexus_duel_players').update({ score: me.score + points }).eq('id', me.id)
  await maybeFinish(updated, players, claimed.length + (correct ? 1 : 0), grid.puzzle.slots.length)
  await signal(duel.id)
  return { correct, points }
}

// Uscita: prima dell'avvio chi ha creato la sfida la chiude, gli altri escono;
// a partita in corso si esce e gli altri continuano (da soli si vince).
export async function leaveNexusDuel(code: string, token: string | null): Promise<{ ok: true } | { error: string }> {
  const { user } = await viewer()
  const duel = await loadDuel(code)
  if (!duel || duel.status === 'finished') return { error: 'notFound' }
  const players = await playersOf(duel.id)
  const me = findMe(players, user?.id ?? null, token)
  if (!me) return { error: 'notFound' }

  if (duel.status === 'waiting') {
    if (me.user_id === duel.host_id) await finish(duel)
    else await service().from('nexus_duel_players').delete().eq('id', me.id)
  } else {
    await service().from('nexus_duel_players').update({ left_at: now() }).eq('id', me.id)
    const after = players.map((p) => (p.id === me.id ? { ...p, left_at: now() } : p))
    if (active(after).length < 2) await finish(duel)
    else if (duel.turn_player === me.id) {
      await service()
        .from('nexus_duels')
        .update({ turn_player: nextTurn(after, me.id), turn_ends_at: turnEnd(after), updated_at: now() })
        .eq('id', duel.id)
        .eq('turn_player', me.id)
    }
  }
  await signal(duel.id)
  return { ok: true }
}

'use server'

import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/translationOverrides'
import {
  iceServers,
  newSession,
  pullTracks,
  pushTracks,
  realtimeConfigured,
  renegotiate,
  type SessionDescription,
} from '@/lib/cloudflareRealtime'
import {
  HOST_AWAY_MS,
  VIEWER_ACTIVE_MS,
  WEBINAR_CODE_RE,
  WEBINAR_MESSAGE_GAP_MS,
  WEBINAR_MESSAGE_MAX,
  WEBINAR_NAME_MAX,
  WEBINAR_SEATS,
  webinarChannel,
  type HostTrackKind,
  type HostTracks,
  type LiveState,
  type WebinarMessage,
  type WebinarViewerRow,
} from '@/lib/webinar'

// KUMANI Webinar (in prova). Chi presenta: Staff e tester (poi il piano Pro).
// Chi guarda: chiunque abbia il link, con un segreto tenuto dal browser.
// Il video passa da Cloudflare: qui si aprono le sessioni e si tiene lo stato.

type Fail = { error: string }

type WebinarRow = {
  id: string
  host_id: string
  code: string
  channel_key: string
  title: string
  starts_at: string
  seats: number
  status: 'scheduled' | 'live' | 'ended'
  host_session: string | null
  host_tracks: HostTracks | null
  host_seen_at: string | null
  host_paused: boolean
  cam_on: boolean
  screen_on: boolean
  speaker_id: string | null
  speaker_session: string | null
  speaker_track: string | null
  started_at: string | null
}

type ViewerRow = {
  id: string
  webinar_id: string
  name: string
  session_id: string | null
  hand_raised_at: string | null
  last_message_at: string | null
  banned: boolean
}

const WEBINAR_COLUMNS =
  'id, host_id, code, channel_key, title, starts_at, seats, status, host_session, host_tracks, host_seen_at, host_paused, cam_on, screen_on, speaker_id, speaker_session, speaker_track, started_at'

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const cleanText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : ''
const isSdp = (d: unknown): d is SessionDescription =>
  !!d && typeof d === 'object' && ((d as SessionDescription).type === 'offer' || (d as SessionDescription).type === 'answer') && typeof (d as SessionDescription).sdp === 'string' && (d as SessionDescription).sdp.length < 100_000

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(10)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

// Avviso «qualcosa è cambiato» a chi è nel webinar: il browser poi chiede
// lo stato vero al server (così un messaggio falso non cambia nulla)
async function ping(channelKey: string, event: 'state' | 'chat') {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ topic: webinarChannel(channelKey), event, payload: { at: Date.now() } }] }),
      cache: 'no-store',
    })
  } catch {
    // Senza avviso i browser se ne accorgono al controllo successivo
  }
}

// ── Chi può presentare ─────────────────────────────────────────────────

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// In prova: Staff (admin) e tester scelti
export async function canHostWebinars(userId: string): Promise<boolean> {
  const db = serviceClient()
  const [{ data: profile }, { data: staff }, { data: tester }] = await Promise.all([
    db.from('profiles').select('is_admin').eq('id', userId).maybeSingle(),
    db.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle(),
    db.from('webinar_testers').select('user_id').eq('user_id', userId).maybeSingle(),
  ])
  return profile?.is_admin === true || !!staff || !!tester
}

async function hostOf(id: string): Promise<{ userId: string; webinar: WebinarRow } | Fail> {
  const userId = await currentUserId()
  if (!userId) return { error: 'auth' }
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return { error: 'not_found' }
  const { data } = await serviceClient().from('webinars').select(WEBINAR_COLUMNS).eq('id', id).maybeSingle<WebinarRow>()
  if (!data || data.host_id !== userId) return { error: 'not_found' }
  if (!(await canHostWebinars(userId))) return { error: 'not_allowed' }
  return { userId, webinar: data }
}

// ── Stato condiviso ────────────────────────────────────────────────────

async function liveState(w: WebinarRow): Promise<LiveState> {
  const db = serviceClient()
  const since = new Date(Date.now() - VIEWER_ACTIVE_MS).toISOString()
  const [{ count }, { data: speaker }, { data: hidden }] = await Promise.all([
    db.from('webinar_viewers').select('id', { count: 'exact', head: true }).eq('webinar_id', w.id).eq('banned', false).gte('last_seen', since),
    w.speaker_id ? db.from('webinar_viewers').select('id, name').eq('id', w.speaker_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from('webinar_messages').select('id').eq('webinar_id', w.id).eq('hidden', true).order('id', { ascending: false }).limit(100),
  ])
  const seen = w.host_seen_at ? new Date(w.host_seen_at).getTime() : 0
  return {
    status: w.status,
    hostSession: w.status === 'live' ? w.host_session : null,
    tracks: w.status === 'live' ? (w.host_tracks ?? {}) : {},
    hostAway: w.status === 'live' && (w.host_paused || Date.now() - seen > HOST_AWAY_MS),
    camOn: w.cam_on,
    screenOn: w.screen_on,
    speaker: speaker && w.status === 'live' ? { id: speaker.id, name: speaker.name, session: w.speaker_session, track: w.speaker_track } : null,
    viewers: count ?? 0,
    hiddenIds: (hidden ?? []).map((m) => m.id as number),
  }
}

async function messagesAfter(webinarId: string, afterId: number): Promise<WebinarMessage[]> {
  let query = serviceClient()
    .from('webinar_messages')
    .select('id, name, body, is_host, created_at')
    .eq('webinar_id', webinarId)
    .eq('hidden', false)
  query = afterId > 0 ? query.gt('id', afterId).order('id', { ascending: true }).limit(100) : query.order('id', { ascending: false }).limit(50)
  const { data } = await query
  const rows = (data ?? []).map((m) => ({ id: m.id as number, name: m.name as string, body: m.body as string, isHost: m.is_host as boolean, at: m.created_at as string }))
  return afterId > 0 ? rows : rows.reverse()
}

// ── Organizzare ────────────────────────────────────────────────────────

export async function createWebinar(input: { title: string; description?: string; startsAt: string }): Promise<{ id: string } | Fail> {
  const userId = await currentUserId()
  if (!userId) return { error: 'auth' }
  if (!(await canHostWebinars(userId))) return { error: 'not_allowed' }
  const title = cleanText(input.title, 120)
  const description = cleanText(input.description, 1000) || null
  const starts = new Date(input.startsAt)
  if (!title) return { error: 'title' }
  if (Number.isNaN(starts.getTime()) || starts.getTime() < Date.now() - 24 * 3600_000 || starts.getTime() > Date.now() + 366 * 24 * 3600_000) {
    return { error: 'date' }
  }
  const db = serviceClient()
  const { count } = await db.from('webinars').select('id', { count: 'exact', head: true }).eq('host_id', userId).neq('status', 'ended')
  if ((count ?? 0) >= 20) return { error: 'too_many' }
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from('webinars')
      .insert({ host_id: userId, code: randomCode(), title, description, starts_at: starts.toISOString(), seats: WEBINAR_SEATS })
      .select('id')
      .single()
    if (!error && data) return { id: data.id as string }
    if (error && error.code !== '23505') break
  }
  return { error: 'save_failed' }
}

export async function deleteWebinar(id: string): Promise<{ success: true } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  await serviceClient().from('webinars').delete().eq('id', id)
  if (host.webinar.status === 'live') await ping(host.webinar.channel_key, 'state')
  return { success: true }
}

export async function hostIce(id: string): Promise<{ ice: RTCIceServer[] } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  if (!realtimeConfigured()) return { error: 'not_configured' }
  return { ice: await iceServers() }
}

// Va in diretta (o ripubblica dopo un problema di rete): le tracce del browser
// arrivano a Cloudflare con l'offerta, la risposta torna al browser
export async function hostPublish(
  id: string,
  offer: SessionDescription,
  tracks: { mid: string; kind: HostTrackKind }[],
  flags: { camOn: boolean; screenOn: boolean }
): Promise<{ answer: SessionDescription } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  const w = host.webinar
  if (w.status === 'ended') return { error: 'ended' }
  if (!isSdp(offer) || !Array.isArray(tracks) || tracks.length === 0 || tracks.length > 3) return { error: 'invalid' }
  const kinds = new Set<HostTrackKind>(['audio', 'video', 'screen'])
  const suffix = randomBytes(4).toString('hex')
  const named = tracks.map((t) => ({ ...t, trackName: `${t.kind}-${suffix}` }))
  if (named.some((t) => !kinds.has(t.kind) || typeof t.mid !== 'string' || !t.mid)) return { error: 'invalid' }
  try {
    const sessionId = await newSession()
    const res = await pushTracks(
      sessionId,
      offer,
      named.map((t) => ({ location: 'local', mid: t.mid, trackName: t.trackName }))
    )
    if (!res.sessionDescription || res.errorCode) return { error: 'realtime' }
    const hostTracks: HostTracks = {}
    for (const t of named) hostTracks[t.kind] = t.trackName
    const now = new Date().toISOString()
    await serviceClient()
      .from('webinars')
      .update({
        status: 'live',
        started_at: w.started_at ?? now,
        host_session: sessionId,
        host_tracks: hostTracks,
        host_seen_at: now,
        host_paused: false,
        cam_on: !!flags?.camOn,
        screen_on: !!flags?.screenOn,
      })
      .eq('id', id)
    await ping(w.channel_key, 'state')
    return { answer: res.sessionDescription }
  } catch {
    return { error: 'realtime' }
  }
}

// Segnale di vita di chi presenta (ogni 5 secondi e a ogni cambio): risponde
// con chi è collegato, le mani alzate e i messaggi nuovi
export async function hostBeat(
  id: string,
  flags: { paused: boolean; camOn: boolean; screenOn: boolean },
  afterId: number
): Promise<{ state: LiveState; viewers: WebinarViewerRow[]; messages: WebinarMessage[] } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  let w = host.webinar
  if (w.status === 'live') {
    const update = { host_seen_at: new Date().toISOString(), host_paused: !!flags.paused, cam_on: !!flags.camOn, screen_on: !!flags.screenOn }
    const changed = w.host_paused !== update.host_paused || w.cam_on !== update.cam_on || w.screen_on !== update.screen_on
    await serviceClient().from('webinars').update(update).eq('id', id)
    w = { ...w, ...update }
    if (changed) await ping(w.channel_key, 'state')
  }
  const since = new Date(Date.now() - VIEWER_ACTIVE_MS).toISOString()
  const [state, messages, { data: viewers }] = await Promise.all([
    liveState(w),
    messagesAfter(id, Math.max(0, Number(afterId) || 0)),
    serviceClient()
      .from('webinar_viewers')
      .select('id, name, hand_raised_at')
      .eq('webinar_id', id)
      .eq('banned', false)
      .gte('last_seen', since)
      .order('joined_at', { ascending: true })
      .limit(500),
  ])
  return {
    state,
    messages,
    viewers: (viewers ?? []).map((v) => ({ id: v.id as string, name: v.name as string, hand: !!v.hand_raised_at, speaking: v.id === w.speaker_id })),
  }
}

export async function hostEnd(id: string): Promise<{ success: true } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  await serviceClient()
    .from('webinars')
    .update({ status: 'ended', ended_at: new Date().toISOString(), host_session: null, host_tracks: {}, speaker_id: null, speaker_session: null, speaker_track: null })
    .eq('id', id)
  await ping(host.webinar.channel_key, 'state')
  return { success: true }
}

export async function hostSendMessage(id: string, body: string): Promise<{ success: true } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  const text = cleanText(body, WEBINAR_MESSAGE_MAX)
  if (!text) return { error: 'empty' }
  const db = serviceClient()
  const { data: profile } = await db.from('profiles').select('first_name, last_name').eq('id', host.userId).maybeSingle()
  const name = cleanText([profile?.first_name, profile?.last_name].filter(Boolean).join(' '), WEBINAR_NAME_MAX) || 'Host'
  await db.from('webinar_messages').insert({ webinar_id: id, is_host: true, name, body: text })
  await ping(host.webinar.channel_key, 'chat')
  return { success: true }
}

// Moderazione: togliere qualcuno dal webinar o nascondere un messaggio
export async function hostModerate(id: string, action: { ban?: string; hide?: number }): Promise<{ success: true } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  const db = serviceClient()
  if (typeof action.ban === 'string') {
    await db.from('webinar_viewers').update({ banned: true, hand_raised_at: null }).eq('id', action.ban).eq('webinar_id', id)
    await db.from('webinar_messages').update({ hidden: true }).eq('viewer_id', action.ban).eq('webinar_id', id)
    if (host.webinar.speaker_id === action.ban) {
      await db.from('webinars').update({ speaker_id: null, speaker_session: null, speaker_track: null }).eq('id', id)
    }
  }
  if (typeof action.hide === 'number') {
    await db.from('webinar_messages').update({ hidden: true }).eq('id', action.hide).eq('webinar_id', id)
  }
  await ping(host.webinar.channel_key, 'state')
  return { success: true }
}

// Dà (o toglie) la parola a uno spettatore
export async function hostSetSpeaker(id: string, viewerId: string | null): Promise<{ success: true } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  const db = serviceClient()
  if (viewerId) {
    const { data: viewer } = await db.from('webinar_viewers').select('id, banned').eq('id', viewerId).eq('webinar_id', id).maybeSingle()
    if (!viewer || viewer.banned) return { error: 'not_found' }
    await db.from('webinar_viewers').update({ hand_raised_at: null }).eq('id', viewerId)
  }
  await db.from('webinars').update({ speaker_id: viewerId, speaker_session: null, speaker_track: null }).eq('id', id)
  await ping(host.webinar.channel_key, 'state')
  return { success: true }
}

// Chi presenta ascolta chi ha la parola (sessione di ascolto tenuta dal browser)
export async function hostPull(
  id: string,
  sessionId: string | null,
  trackName: string
): Promise<{ sessionId: string; offer: SessionDescription; tracks: { mid: string; trackName: string }[] } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  const w = host.webinar
  if (!w.speaker_session || w.speaker_track !== trackName) return { error: 'not_found' }
  try {
    const session = typeof sessionId === 'string' && /^[0-9a-f]{20,64}$/i.test(sessionId) ? sessionId : await newSession()
    const res = await pullTracks(session, [{ location: 'remote', sessionId: w.speaker_session, trackName }])
    if (!res.sessionDescription) return { error: 'realtime' }
    return { sessionId: session, offer: res.sessionDescription, tracks: (res.tracks ?? []).filter((t) => t.mid).map((t) => ({ mid: t.mid!, trackName: t.trackName ?? trackName })) }
  } catch {
    return { error: 'realtime' }
  }
}

export async function hostAnswer(id: string, sessionId: string, answer: SessionDescription): Promise<{ success: true } | Fail> {
  const host = await hostOf(id)
  if ('error' in host) return host
  if (!isSdp(answer) || typeof sessionId !== 'string') return { error: 'invalid' }
  try {
    await renegotiate(sessionId, answer)
    return { success: true }
  } catch {
    return { error: 'realtime' }
  }
}

// ── Guardare ───────────────────────────────────────────────────────────

async function webinarByCode(code: string): Promise<WebinarRow | null> {
  if (typeof code !== 'string' || !WEBINAR_CODE_RE.test(code)) return null
  const { data } = await serviceClient().from('webinars').select(WEBINAR_COLUMNS).eq('code', code).maybeSingle<WebinarRow>()
  return data ?? null
}

async function viewerOf(code: string, token: string): Promise<{ webinar: WebinarRow; viewer: ViewerRow } | Fail> {
  const webinar = await webinarByCode(code)
  if (!webinar) return { error: 'not_found' }
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return { error: 'not_joined' }
  const { data: viewer } = await serviceClient()
    .from('webinar_viewers')
    .select('id, webinar_id, name, session_id, hand_raised_at, last_message_at, banned')
    .eq('webinar_id', webinar.id)
    .eq('token_hash', hashToken(token))
    .maybeSingle<ViewerRow>()
  if (!viewer) return { error: 'not_joined' }
  if (viewer.banned) return { error: 'banned' }
  return { webinar, viewer }
}

export async function joinWebinar(
  code: string,
  name: string,
  token: string | null
): Promise<{ token: string; viewerId: string; channelKey: string; ice: RTCIceServer[]; state: LiveState } | Fail> {
  const webinar = await webinarByCode(code)
  if (!webinar) return { error: 'not_found' }
  if (webinar.status === 'ended') return { error: 'ended' }
  const cleanName = cleanText(name, WEBINAR_NAME_MAX)
  if (!cleanName) return { error: 'name' }
  const db = serviceClient()
  const secret = typeof token === 'string' && token.length >= 20 && token.length <= 100 ? token : randomBytes(24).toString('base64url')
  const tokenHash = hashToken(secret)
  const { data: existing } = await db
    .from('webinar_viewers')
    .select('id, banned')
    .eq('webinar_id', webinar.id)
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (existing?.banned) return { error: 'banned' }

  // Posti: contano solo le persone collegate adesso (chi rientra non perde il posto)
  const since = new Date(Date.now() - VIEWER_ACTIVE_MS).toISOString()
  let seats = db.from('webinar_viewers').select('id', { count: 'exact', head: true }).eq('webinar_id', webinar.id).eq('banned', false).gte('last_seen', since)
  if (existing) seats = seats.neq('id', existing.id)
  const { count } = await seats
  if ((count ?? 0) >= webinar.seats) return { error: 'full' }

  const userId = await currentUserId()
  let viewerId = existing?.id as string | undefined
  if (viewerId) {
    await db.from('webinar_viewers').update({ name: cleanName, last_seen: new Date().toISOString() }).eq('id', viewerId)
  } else {
    const { data, error } = await db
      .from('webinar_viewers')
      .insert({ webinar_id: webinar.id, token_hash: tokenHash, name: cleanName, user_id: userId })
      .select('id')
      .single()
    if (error || !data) return { error: 'save_failed' }
    viewerId = data.id as string
  }
  const [state, ice] = await Promise.all([liveState(webinar), realtimeConfigured() ? iceServers() : Promise.resolve([])])
  await ping(webinar.channel_key, 'state')
  return { token: secret, viewerId, channelKey: webinar.channel_key, ice, state }
}

// Segnale di vita di chi guarda (ogni 10 secondi e a ogni avviso)
export async function viewerPoll(
  code: string,
  token: string,
  afterId: number
): Promise<{ state: LiveState; messages: WebinarMessage[]; me: { hand: boolean; speaking: boolean } } | Fail> {
  const found = await viewerOf(code, token)
  if ('error' in found) return found
  const { webinar, viewer } = found
  await serviceClient().from('webinar_viewers').update({ last_seen: new Date().toISOString() }).eq('id', viewer.id)
  const [state, messages] = await Promise.all([liveState(webinar), messagesAfter(webinar.id, Math.max(0, Number(afterId) || 0))])
  return { state, messages, me: { hand: !!viewer.hand_raised_at, speaking: webinar.speaker_id === viewer.id } }
}

// Riceve le tracce della diretta: chi presenta e chi ha la parola
export async function viewerPull(
  code: string,
  token: string,
  trackNames: string[],
  fresh: boolean
): Promise<{ sessionId: string; offer: SessionDescription; tracks: { mid: string; trackName: string }[]; notReady: number } | Fail> {
  const found = await viewerOf(code, token)
  if ('error' in found) return found
  const { webinar: w, viewer } = found
  if (w.status !== 'live' || !w.host_session) return { error: 'not_live' }
  const hostNames = Object.values(w.host_tracks ?? {})
  const wanted: { location: 'remote'; sessionId: string; trackName: string }[] = []
  for (const name of Array.isArray(trackNames) ? trackNames.slice(0, 4) : []) {
    if (hostNames.includes(name)) wanted.push({ location: 'remote', sessionId: w.host_session, trackName: name })
    else if (w.speaker_session && name === w.speaker_track && w.speaker_id !== viewer.id) wanted.push({ location: 'remote', sessionId: w.speaker_session, trackName: name })
  }
  if (wanted.length === 0) return { error: 'invalid' }
  try {
    let sessionId = !fresh && viewer.session_id ? viewer.session_id : null
    if (!sessionId) {
      sessionId = await newSession()
      await serviceClient().from('webinar_viewers').update({ session_id: sessionId }).eq('id', viewer.id)
    }
    const res = await pullTracks(sessionId, wanted)
    // Tracce non ancora arrivate a Cloudflare (chi presenta si sta collegando):
    // il browser riprova tra poco
    const notReady = (res.tracks ?? []).filter((t) => t.errorCode || !t.mid).length
    if (!res.sessionDescription) return notReady ? { error: 'not_ready' } : { error: 'realtime' }
    return {
      sessionId,
      offer: res.sessionDescription,
      tracks: (res.tracks ?? []).filter((t) => t.mid && !t.errorCode).map((t) => ({ mid: t.mid!, trackName: t.trackName ?? '' })),
      notReady,
    }
  } catch {
    return { error: 'realtime' }
  }
}

export async function viewerAnswer(code: string, token: string, answer: SessionDescription): Promise<{ success: true } | Fail> {
  const found = await viewerOf(code, token)
  if ('error' in found) return found
  if (!isSdp(answer) || !found.viewer.session_id) return { error: 'invalid' }
  try {
    await renegotiate(found.viewer.session_id, answer)
    return { success: true }
  } catch {
    return { error: 'realtime' }
  }
}

export async function viewerSend(code: string, token: string, body: string): Promise<{ success: true } | Fail> {
  const found = await viewerOf(code, token)
  if ('error' in found) return found
  const { webinar, viewer } = found
  if (webinar.status === 'ended') return { error: 'ended' }
  const text = cleanText(body, WEBINAR_MESSAGE_MAX)
  if (!text) return { error: 'empty' }
  if (viewer.last_message_at && Date.now() - new Date(viewer.last_message_at).getTime() < WEBINAR_MESSAGE_GAP_MS) return { error: 'too_fast' }
  const db = serviceClient()
  await db.from('webinar_viewers').update({ last_message_at: new Date().toISOString() }).eq('id', viewer.id)
  await db.from('webinar_messages').insert({ webinar_id: webinar.id, viewer_id: viewer.id, name: viewer.name, body: text })
  await ping(webinar.channel_key, 'chat')
  return { success: true }
}

export async function viewerHand(code: string, token: string, up: boolean): Promise<{ success: true } | Fail> {
  const found = await viewerOf(code, token)
  if ('error' in found) return found
  await serviceClient()
    .from('webinar_viewers')
    .update({ hand_raised_at: up ? new Date().toISOString() : null })
    .eq('id', found.viewer.id)
  await ping(found.webinar.channel_key, 'state')
  return { success: true }
}

// Chi ha avuto la parola accende il microfono: la sua voce va a tutti
export async function viewerSpeak(code: string, token: string, offer: SessionDescription, mid: string): Promise<{ answer: SessionDescription } | Fail> {
  const found = await viewerOf(code, token)
  if ('error' in found) return found
  const { webinar: w, viewer } = found
  if (w.status !== 'live' || w.speaker_id !== viewer.id) return { error: 'not_allowed' }
  if (!isSdp(offer) || typeof mid !== 'string' || !mid) return { error: 'invalid' }
  try {
    const sessionId = await newSession()
    const trackName = `voice-${randomBytes(4).toString('hex')}`
    const res = await pushTracks(sessionId, offer, [{ location: 'local', mid, trackName }])
    if (!res.sessionDescription) return { error: 'realtime' }
    await serviceClient().from('webinars').update({ speaker_session: sessionId, speaker_track: trackName }).eq('id', w.id).eq('speaker_id', viewer.id)
    await ping(w.channel_key, 'state')
    return { answer: res.sessionDescription }
  } catch {
    return { error: 'realtime' }
  }
}

export async function viewerStopSpeak(code: string, token: string): Promise<{ success: true } | Fail> {
  const found = await viewerOf(code, token)
  if ('error' in found) return found
  const { webinar: w, viewer } = found
  if (w.speaker_id !== viewer.id) return { success: true }
  // La sessione della voce si chiude da sola quando il browser chiude il collegamento
  await serviceClient().from('webinars').update({ speaker_id: null, speaker_session: null, speaker_track: null }).eq('id', w.id)
  await ping(w.channel_key, 'state')
  return { success: true }
}

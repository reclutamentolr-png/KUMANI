import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { pushDb } from '@/lib/push'
import { loadExportEvents, type ExportEvent } from '@/lib/calendarExport'
import { SITE_URL } from '@/lib/siteUrl'
import { getSessionIsAdmin } from '@/lib/session'

// Google Calendar collegato con l'API: con il permesso dell'utente KUMANI crea
// nel suo Google un calendario «KUMANI» e lo tiene uguale all'agenda (gli
// stessi impegni del link .ics), subito dopo ogni modifica. Il permesso
// (calendar.app.created) vale solo per i calendari creati da KUMANI: gli altri
// calendari della persona non si vedono e non si toccano.
// Ogni evento ha un id fisso ricavato dall'impegno KUMANI, così un secondo
// aggiornamento non crea doppioni; un'impronta del contenuto evita di riscrivere
// ciò che non è cambiato.

const SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar.app.created'
const SCOPES = ['openid', 'email', SCOPE_CALENDAR]
const API = 'https://www.googleapis.com/calendar/v3'
export const GOOGLE_CALENDAR_REDIRECT = `${SITE_URL}/api/google-calendar/callback`

export const googleCalendarConfigured = () =>
  Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_TOKEN_KEY)

// Finché Google non ha verificato l'app possono collegarsi solo gli utenti di
// prova: il pulsante lo vede lo Staff. GOOGLE_CALENDAR_SYNC=on lo apre a tutti.
export async function googleCalendarAllowed(userId: string): Promise<boolean> {
  if (!googleCalendarConfigured()) return false
  if (process.env.GOOGLE_CALENDAR_SYNC === 'on') return true
  return getSessionIsAdmin(userId)
}

// --- Token cifrato nel database (AES-256-GCM, chiave GOOGLE_TOKEN_KEY in base64) ---

const tokenKey = () => {
  const key = Buffer.from(process.env.GOOGLE_TOKEN_KEY ?? '', 'base64')
  if (key.length !== 32) throw new Error('GOOGLE_TOKEN_KEY must be 32 bytes in base64')
  return key
}

function encrypt(text: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', tokenKey(), iv)
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.')
}

function decrypt(value: string): string {
  const [, iv, tag, data] = value.split('.')
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

// --- Accesso con Google (OAuth) ---

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: GOOGLE_CALENDAR_REDIRECT,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    // Sempre la richiesta del permesso: così Google ridà il refresh token
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

class GoogleRevokedError extends Error {}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!, ...body }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; id_token?: string; scope?: string; error?: string }
  // Permesso tolto dall'utente su Google (o token scaduto): va ricollegato
  if (json.error === 'invalid_grant') throw new GoogleRevokedError('revoked')
  if (!res.ok || !json.access_token) throw new Error(`google token ${res.status} ${json.error ?? ''}`.trim())
  return json
}

// Collegamento: salva il permesso (cifrato) e l'indirizzo Google mostrato nella pagina
export async function connectGoogleCalendar(userId: string, code: string, locale: string): Promise<'ok' | 'scope'> {
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: GOOGLE_CALENDAR_REDIRECT })
  if (!tokens.scope?.split(' ').includes(SCOPE_CALENDAR) || !tokens.refresh_token) return 'scope'
  // L'id_token arriva direttamente da Google: basta leggerne l'email
  let email: string | null = null
  try {
    email = JSON.parse(Buffer.from(tokens.id_token!.split('.')[1], 'base64url').toString('utf8')).email ?? null
  } catch {}
  const db = pushDb()
  const { data: previous } = await db.from('google_calendar_links').select('calendar_id, google_email').eq('user_id', userId).maybeSingle()
  const { error } = await db.from('google_calendar_links').upsert({
    user_id: userId,
    refresh_token: encrypt(tokens.refresh_token),
    google_email: email,
    // Stesso account Google: si riusa il calendario già creato
    calendar_id: previous && previous.google_email === email ? previous.calendar_id : null,
    locale,
    connected_at: new Date().toISOString(),
    last_error: null,
  })
  if (error) throw error
  return 'ok'
}

// --- Chiamate al calendario ---

async function gapi<T = unknown>(token: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: T | null }> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
  const data = res.status === 204 ? null : ((await res.json().catch(() => null)) as T | null)
  return { status: res.status, data }
}

const ok = (status: number) => status >= 200 && status < 300
const calendarPath = (id: string) => `/calendars/${encodeURIComponent(id)}`

async function ensureCalendar(token: string, userId: string, calendarId: string | null): Promise<string> {
  if (calendarId) {
    const { status } = await gapi(token, 'GET', calendarPath(calendarId))
    if (ok(status)) return calendarId
    if (status !== 404) throw new Error(`google calendar ${status}`)
  }
  // Mai creato, o cancellato dall'utente in Google: se ne crea uno nuovo
  const { status, data } = await gapi<{ id: string }>(token, 'POST', '/calendars', { summary: 'KUMANI', description: `${SITE_URL}/app/memolife`, timeZone: 'Europe/Rome' })
  if (!ok(status) || !data?.id) throw new Error(`google calendar create ${status}`)
  await pushDb().from('google_calendar_links').update({ calendar_id: data.id }).eq('user_id', userId)
  return data.id
}

// Id evento ammessi da Google: lettere a-v e cifre (l'esadecimale va bene)
const eventId = (uid: string) => createHash('sha256').update(uid).digest('hex')

function eventBody(e: ExportEvent) {
  const at = (p: ExportEvent['start']) => (e.allDay ? { date: p.date } : { dateTime: `${p.date}T${p.time}:00`, timeZone: 'Europe/Rome' })
  const body = { summary: e.summary, description: e.description, start: at(e.start), end: at(e.end), source: { title: 'KUMANI', url: e.url } }
  const print = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16)
  return { ...body, id: eventId(e.uid), status: 'confirmed', extendedProperties: { private: { kumani: print } } }
}

// Poche chiamate alla volta, per stare nei limiti di Google
async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(run))
}

export type GoogleSyncResult = 'ok' | 'none' | 'revoked' | 'error'

export async function syncGoogleCalendar(userId: string): Promise<GoogleSyncResult> {
  if (!googleCalendarConfigured()) return 'none'
  const db = pushDb()
  const { data: link } = await db.from('google_calendar_links').select('refresh_token, calendar_id, locale').eq('user_id', userId).maybeSingle()
  if (!link) return 'none'
  try {
    const { access_token: token } = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(link.refresh_token as string) })
    const calendarId = await ensureCalendar(token!, userId, link.calendar_id as string | null)
    const path = calendarPath(calendarId)
    const { from, events } = await loadExportEvents(db, userId, (link.locale as string) || 'it')

    // Eventi già nel calendario KUMANI (da un mese fa in poi)
    const existing = new Map<string, string | undefined>()
    let pageToken: string | undefined
    do {
      const query = new URLSearchParams({ timeMin: `${from}T00:00:00Z`, maxResults: '2500', fields: 'items(id,extendedProperties),nextPageToken', ...(pageToken ? { pageToken } : {}) })
      const { status, data } = await gapi<{ items?: { id: string; extendedProperties?: { private?: { kumani?: string } } }[]; nextPageToken?: string }>(token!, 'GET', `${path}/events?${query}`)
      if (!ok(status)) throw new Error(`google list ${status}`)
      for (const item of data?.items ?? []) existing.set(item.id, item.extendedProperties?.private?.kumani)
      pageToken = data?.nextPageToken
    } while (pageToken)

    const wanted = events.map(eventBody)
    const wantedIds = new Set(wanted.map((e) => e.id))
    let failed = 0
    await inBatches(wanted, 5, async (body) => {
      if (existing.has(body.id)) {
        if (existing.get(body.id) === body.extendedProperties.private.kumani) return
        const res = await gapi(token!, 'PUT', `${path}/events/${body.id}`, body)
        if (!ok(res.status)) failed++
        return
      }
      const res = await gapi(token!, 'POST', `${path}/events`, body)
      // Id già usato da un evento cancellato in passato: si riporta in vita
      if (res.status === 409) {
        const again = await gapi(token!, 'PUT', `${path}/events/${body.id}`, body)
        if (!ok(again.status)) failed++
      } else if (!ok(res.status)) failed++
    })
    await inBatches([...existing.keys()].filter((id) => !wantedIds.has(id)), 5, async (id) => {
      const res = await gapi(token!, 'DELETE', `${path}/events/${id}`)
      if (!ok(res.status) && res.status !== 404 && res.status !== 410) failed++
    })

    await db.from('google_calendar_links').update({ last_sync_at: new Date().toISOString(), last_error: failed ? `${failed} events failed` : null }).eq('user_id', userId)
    return failed ? 'error' : 'ok'
  } catch (error) {
    if (error instanceof GoogleRevokedError) {
      // Permesso tolto da Google: il collegamento non vale più
      await db.from('google_calendar_links').delete().eq('user_id', userId)
      return 'revoked'
    }
    console.error('[google-calendar] sync', userId, error)
    await db.from('google_calendar_links').update({ last_error: String(error instanceof Error ? error.message : error).slice(0, 300) }).eq('user_id', userId)
    return 'error'
  }
}

// Aggiornamento «di passaggio» (apertura dell'agenda): al massimo ogni 15 minuti
export async function syncGoogleCalendarIfStale(userId: string, minutes = 15): Promise<void> {
  if (!googleCalendarConfigured()) return
  const { data: link } = await pushDb().from('google_calendar_links').select('last_sync_at').eq('user_id', userId).maybeSingle()
  if (!link) return
  if (link.last_sync_at && Date.now() - new Date(link.last_sync_at as string).getTime() < minutes * 60_000) return
  await syncGoogleCalendar(userId)
}

// Scollega: toglie il calendario KUMANI dal Google dell'utente e il permesso
export async function disconnectGoogleCalendar(userId: string): Promise<void> {
  const db = pushDb()
  const { data: link } = await db.from('google_calendar_links').select('refresh_token, calendar_id').eq('user_id', userId).maybeSingle()
  if (!link) return
  try {
    const refresh = decrypt(link.refresh_token as string)
    const { access_token: token } = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh })
    if (link.calendar_id) await gapi(token!, 'DELETE', calendarPath(link.calendar_id as string))
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, { method: 'POST', signal: AbortSignal.timeout(10000) })
  } catch (error) {
    // Permesso già tolto o Google non raggiungibile: si scollega comunque
    if (!(error instanceof GoogleRevokedError)) console.error('[google-calendar] disconnect', userId, error)
  }
  await db.from('google_calendar_links').delete().eq('user_id', userId)
}

export async function googleCalendarStatus(userId: string) {
  const { data } = await pushDb().from('google_calendar_links').select('google_email, last_sync_at, last_error').eq('user_id', userId).maybeSingle()
  return data as { google_email: string | null; last_sync_at: string | null; last_error: string | null } | null
}

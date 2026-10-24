import { NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { pushDb } from '@/lib/push'
import { loadAgenda } from '@/lib/agenda-server'
import { addDays, todayKey, type AgendaEvent } from '@/lib/agenda'
import { SITE_URL } from '@/lib/siteUrl'

// Calendario KUMANI collegato (Google Calendar, iPhone, Outlook): il link
// personale e segreto restituisce gli impegni dell'utente in formato .ics,
// dall'ultimo mese ai prossimi sei. Solo lettura. Il token si crea o si
// rigenera da /calendario-collegato (calendar_feed_token); con un token
// sconosciuto la risposta è 404, senza dire altro.
export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')
const ymd = (key: string) => key.replace(/-/g, '')
// Righe .ics lunghe al massimo 75 caratteri (le successive iniziano con uno spazio)
const fold = (line: string) => {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ' ' + rest.slice(74)
  }
  out.push(rest)
  return out.join('\r\n')
}
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// Ora locale di Roma + minuti, senza passare dal fuso (data e ora «di calendario»)
function plusMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const d = new Date(`${date}T${time}:00Z`)
  d.setUTCMinutes(d.getUTCMinutes() + minutes)
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) }
}

function urlOf(e: AgendaEvent): string {
  const path =
    e.kind === 'convivium'
      ? e.organizing
        ? `/convivium/${e.refId}`
        : `/convivium/invito/${e.refId}`
      : e.kind === 'event'
        ? `/events/${e.refId}`
        : e.kind === 'trip'
          ? `/viaggi/${e.refId}`
          : e.garageVehicleId
            ? `/app/garage/${e.garageVehicleId}`
            : e.casaHomeId
              ? `/app/casa/${e.casaHomeId}`
              : e.kind === 'bill'
                ? '/app/spendly'
                : e.kind === 'deadline'
                  ? '/app/life-calendar'
                  : '/app/memolife'
  return SITE_URL + path
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, '').toLowerCase()
  if (!/^[a-f0-9]{48}$/.test(token)) return new NextResponse('Not found', { status: 404 })
  const db = pushDb()
  const { data: feed } = await db.from('calendar_feeds').select('user_id, locale').eq('token', token).maybeSingle()
  if (!feed) return new NextResponse('Not found', { status: 404 })
  const userId = feed.user_id as string
  const locale = (feed.locale as string) || 'it'
  await db.from('calendar_feeds').update({ last_fetched_at: new Date().toISOString() }).eq('user_id', userId)

  // Le fonti che l'utente può usare (come nell'agenda dell'app)
  const access = async (tool: string) => {
    const { data } = await db.rpc('tool_access', { p_user_id: userId, p_tool: tool }).maybeSingle<{ allowed: boolean }>()
    return !!data?.allowed
  }
  const [memolife, spendly, lifeCalendar] = await Promise.all([access('memolife'), access('spendly'), access('life-calendar')])
  const today = todayKey()
  const from = addDays(today, -30)
  const to = addDays(today, 183)
  const items = await loadAgenda(db, userId, { from, to, sources: { memolife, spendly, lifeCalendar }, overdueSince: from })
  const t = await getTranslations({ locale, namespace: 'agenda' })

  const label = (e: AgendaEvent) =>
    e.kind === 'convivium'
      ? t(e.organizing ? 'conviviumHosting' : e.conviviumMaybe ? 'conviviumMaybe' : 'source_convivium')
      : e.kind === 'event'
        ? e.organizing
          ? t('eventOrganizing')
          : t('source_event')
        : e.kind === 'trip'
          ? 'KUMANI Travel'
          : e.casaHomeId
            ? 'KUMANI Casa'
            : t(`source_${e.kind}`)

  const now = new Date()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KUMANI//Calendario//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:KUMANI',
    'X-WR-TIMEZONE:Europe/Rome',
    // Suggerimento di aggiornamento (Google decide comunque da sé)
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]
  const add = (uid: string, start: string[], end: string[], summary: string, description: string, url: string) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@kumani.io`, `DTSTAMP:${stamp(now)}`, ...start, ...end, fold(`SUMMARY:${esc(summary)}`), fold(`DESCRIPTION:${esc(description)}`), fold(`URL:${url}`), 'END:VEVENT')
  }

  // Viaggi: un solo evento di più giorni (dalla partenza al rientro)
  const trips = new Map<string, { title: string; start?: string; end?: string }>()
  for (const e of items) {
    if (e.kind === 'trip') {
      const trip = trips.get(e.refId) ?? { title: e.title }
      if (e.tripEdge === 'end') trip.end = e.date
      else trip.start = e.date
      trips.set(e.refId, trip)
      continue
    }
    if (e.done) continue
    const amount = e.amount !== null ? ` · ${new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(e.amount)}` : ''
    const url = urlOf(e)
    const description = `${label(e)}\n${url}`
    if (e.time) {
      const minutes = e.kind === 'convivium' || e.kind === 'event' ? 120 : 60
      const end = plusMinutes(e.date, e.time, minutes)
      add(e.key, [`DTSTART;TZID=Europe/Rome:${ymd(e.date)}T${e.time.replace(':', '')}00`], [`DTEND;TZID=Europe/Rome:${ymd(end.date)}T${end.time.replace(':', '')}00`], e.title + amount, description, url)
    } else {
      add(e.key, [`DTSTART;VALUE=DATE:${ymd(e.date)}`], [`DTEND;VALUE=DATE:${ymd(addDays(e.date, 1))}`], e.title + amount, description, url)
    }
  }
  for (const [id, trip] of trips) {
    const start = trip.start ?? trip.end!
    const end = trip.end ?? trip.start!
    const url = `${SITE_URL}/viaggi/${id}`
    add(`trip:${id}`, [`DTSTART;VALUE=DATE:${ymd(start)}`], [`DTEND;VALUE=DATE:${ymd(addDays(end, 1))}`], trip.title, `KUMANI Travel\n${url}`, url)
  }
  lines.push('END:VCALENDAR')

  return new NextResponse(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="kumani.ics"',
      'Cache-Control': 'private, max-age=900',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

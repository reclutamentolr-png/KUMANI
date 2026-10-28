import { NextResponse } from 'next/server'
import { pushDb } from '@/lib/push'
import { loadExportEvents, type ExportEvent } from '@/lib/calendarExport'

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

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, '').toLowerCase()
  if (!/^[a-f0-9]{48}$/.test(token)) return new NextResponse('Not found', { status: 404 })
  const db = pushDb()
  const { data: feed } = await db.from('calendar_feeds').select('user_id, locale').eq('token', token).maybeSingle()
  if (!feed) return new NextResponse('Not found', { status: 404 })
  const userId = feed.user_id as string
  const locale = (feed.locale as string) || 'it'
  await db.from('calendar_feeds').update({ last_fetched_at: new Date().toISOString() }).eq('user_id', userId)

  const { events } = await loadExportEvents(db, userId, locale)

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

  const at = (p: ExportEvent['start'], allDay: boolean) => (allDay ? `;VALUE=DATE:${ymd(p.date)}` : `;TZID=Europe/Rome:${ymd(p.date)}T${p.time!.replace(':', '')}00`)
  for (const e of events) add(e.uid, [`DTSTART${at(e.start, e.allDay)}`], [`DTEND${at(e.end, e.allDay)}`], e.summary, e.description, e.url)
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

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OCCASION_EMOJI, formatCost, inviteCodeOk, type ConviviumPublic } from '@/lib/convivium'
import { SITE_URL } from '@/lib/siteUrl'

// «Aggiungi al calendario» dalla pagina dell'invito di Convivium: un file
// .ics (Google, Apple, Outlook) di due ore, con il posto e il link
export const dynamic = 'force-dynamic'

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.trim().toUpperCase()
  if (!inviteCodeOk(code)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const supabase = await createClient()
  const { data } = await supabase.rpc('convivium_public', { p_code: code, p_token: null })
  const event = data as ConviviumPublic | null
  if (!event || event.cancelled) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const start = new Date(event.starts_at)
  const end = new Date(start.getTime() + 2 * 3_600_000)
  const url = `${SITE_URL}/convivium/invito/${code}`
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KUMANI//Convivium//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:convivium-${code}@kumani.io`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${OCCASION_EMOJI[event.occasion]} ${event.title}`)}`,
    event.place ? `LOCATION:${esc(event.place)}` : '',
    `DESCRIPTION:${esc([event.cost_cents ? `${formatCost(event.cost_cents, 'it')}${event.cost_note ? ` · ${event.cost_note}` : ''}` : null, event.note, url].filter(Boolean).join('\n\n'))}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="convivium-${code}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}

import { getEvent } from '@/app/actions/events'
import { buildIcs } from '@/lib/events'
import { SITE_URL } from '@/lib/siteUrl'

// "Aggiungi al calendario": file .ics dell'evento. L'indirizzo esatto entra
// nel file solo se chi scarica lo può vedere (iscritto o organizzatore).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await getEvent(id)
  if (!event) return new Response('Not found', { status: 404 })

  const ics = buildIcs(event, `${SITE_URL}/events/${event.id}`)
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="kumani-event-${event.id.slice(0, 8)}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { EventCard } from '@/lib/events'

// Fascia "Prossimi eventi" della Home: eventi pubblicati e non ancora
// finiti, uguali per tutti (client anonimo, niente cookie dentro la cache).
const getAnonClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export const HOME_EVENTS_LIMIT = 3

const fetchHomeEvents = unstable_cache(
  async (): Promise<EventCard[] | null> => {
    // Events spento dallo Staff: niente fascia in Home
    const { data: online } = await getAnonClient().rpc('tool_online', { p_tool: 'events' })
    if (online === false) return null
    const { data, error } = await getAnonClient().rpc('event_list')
    if (error) return []
    const seenSeries = new Set<string>()
    const events: EventCard[] = []
    // Già ordinati per data; di una serie si mostra solo la prossima data
    for (const event of (data ?? []) as EventCard[]) {
      if (event.series_id) {
        if (seenSeries.has(event.series_id)) continue
        seenSeries.add(event.series_id)
      }
      events.push(event)
      if (events.length === HOME_EVENTS_LIMIT) break
    }
    return events
  },
  ['home-events'],
  { revalidate: 600 },
)

export function getHomeEvents(): Promise<EventCard[] | null> {
  return fetchHomeEvents()
}

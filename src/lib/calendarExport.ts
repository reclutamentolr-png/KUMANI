import type { SupabaseClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { loadAgenda } from '@/lib/agenda-server'
import { addDays, todayKey, type AgendaEvent } from '@/lib/agenda'
import { SITE_URL } from '@/lib/siteUrl'

// Impegni KUMANI «da esportare»: gli stessi per il link .ics (iPhone, Outlook,
// Google) e per Google Calendar collegato con l'API. Dall'ultimo mese ai
// prossimi sei, senza le cose già fatte; i viaggi sono un solo evento di più giorni.

export type ExportEvent = {
  uid: string
  summary: string
  description: string
  url: string
  // Con l'ora: data e ora di Roma; senza: giornata intera (fine esclusa)
  allDay: boolean
  start: { date: string; time?: string }
  end: { date: string; time?: string }
}

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

export async function loadExportEvents(db: SupabaseClient, userId: string, locale: string): Promise<{ from: string; to: string; events: ExportEvent[] }> {
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

  const events: ExportEvent[] = []
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
    const base = { uid: e.key, summary: e.title + amount, description: `${label(e)}\n${url}`, url }
    if (e.time) {
      const minutes = e.kind === 'convivium' || e.kind === 'event' ? 120 : 60
      events.push({ ...base, allDay: false, start: { date: e.date, time: e.time }, end: plusMinutes(e.date, e.time, minutes) })
    } else {
      events.push({ ...base, allDay: true, start: { date: e.date }, end: { date: addDays(e.date, 1) } })
    }
  }
  for (const [id, trip] of trips) {
    const start = trip.start ?? trip.end!
    const end = trip.end ?? trip.start!
    const url = `${SITE_URL}/viaggi/${id}`
    events.push({ uid: `trip:${id}`, summary: trip.title, description: `KUMANI Travel\n${url}`, url, allDay: true, start: { date: start }, end: { date: addDays(end, 1) } })
  }
  return { from, to, events }
}

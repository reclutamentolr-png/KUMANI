'use server'

import { createClient } from '@/lib/supabase/server'
import { awardToolPoint } from '@/lib/toolPoints'
import {
  EVENT_LANGUAGES,
  EVENT_MODES,
  EVENT_TYPES,
  zonedToUtc,
  type EventAttendee,
  type EventCard,
  type EventDetail,
  type EventFee,
  type EventPassItem,
  type OrganizedEvent,
  type OrganizerStatus,
} from '@/lib/events'

// KUMANI Events: le regole (chi organizza, approvazione, posti, 18+,
// commissioni) sono nelle funzioni SQL event_*; qui validazione e passaggio.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    console.error(`[Events] ${name} failed:`, error.message)
    return null
  }
  return data as T
}

export async function listEvents(): Promise<EventCard[]> {
  return (await rpc<EventCard[]>('event_list')) ?? []
}

export async function getEvent(eventId: string): Promise<EventDetail | null> {
  if (!UUID_RE.test(eventId)) return null
  return rpc<EventDetail>('event_detail', { p_event: eventId })
}

export async function getOrganizerStatus(): Promise<OrganizerStatus | null> {
  return rpc<OrganizerStatus>('event_my_organizer_status')
}

export async function listMyOrganized(): Promise<OrganizedEvent[]> {
  return (await rpc<OrganizedEvent[]>('event_my_organized')) ?? []
}

export async function listMyPasses(): Promise<EventPassItem[]> {
  return (await rpc<EventPassItem[]>('event_my_passes')) ?? []
}

export async function listMyFees(): Promise<EventFee[]> {
  return (await rpc<EventFee[]>('event_my_fees')) ?? []
}

export type EventFormInput = {
  title: string
  description: string
  type: string
  mode: string
  date: string
  time: string
  endDate: string
  endTime: string
  timezone: string
  venueName: string
  address: string
  city: string
  countryCode: string
  mapLink: string
  onlineLink: string
  languages: string[]
  capacity: string
  price: string
  is18plus: boolean
  kidsFriendly: boolean
  rulesAccepted: boolean
}

export async function saveEvent(eventId: string | null, input: EventFormInput): Promise<{ id?: string; status?: string; error?: string; max?: number }> {
  if (eventId && !UUID_RE.test(eventId)) return { error: 'invalid' }
  if (!(EVENT_TYPES as readonly string[]).includes(input.type) || !(EVENT_MODES as readonly string[]).includes(input.mode)) return { error: 'invalid' }
  if (!DATE_RE.test(input.date) || !TIME_RE.test(input.time)) return { error: 'invalid' }
  let timezone = input.timezone || 'Europe/Rome'
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone })
  } catch {
    timezone = 'Europe/Rome'
  }
  const startsAt = zonedToUtc(input.date, input.time, timezone)
  let endsAt: string | null = null
  if (input.endTime && TIME_RE.test(input.endTime)) {
    const endDate = DATE_RE.test(input.endDate) ? input.endDate : input.date
    endsAt = zonedToUtc(endDate, input.endTime, timezone)
  }
  const link = (value: string) => {
    const text = value.trim()
    if (!text) return null
    return /^https?:\/\//i.test(text) ? text : `https://${text}`
  }
  const price = Number(input.price.replace(/\s/g, '').replace(',', '.') || '0')
  if (!Number.isFinite(price) || price < 0 || price > 10000) return { error: 'price' }

  const payload = {
    title: input.title.trim().slice(0, 100),
    description: input.description.trim().slice(0, 3000),
    type: input.type,
    mode: input.mode,
    starts_at: startsAt,
    ends_at: endsAt,
    timezone,
    venue_name: input.venueName.trim().slice(0, 120),
    address: input.address.trim().slice(0, 200),
    city: input.mode === 'online' ? '' : input.city.trim().slice(0, 80),
    country_code: /^[A-Z]{2}$/i.test(input.countryCode) ? input.countryCode.toUpperCase() : '',
    map_link: input.mode === 'online' ? null : link(input.mapLink),
    online_link: input.mode === 'in_person' ? null : link(input.onlineLink),
    languages: input.languages.filter((l) => (EVENT_LANGUAGES as readonly string[]).includes(l)),
    capacity: Number.parseInt(input.capacity, 10) || 0,
    price: Math.round(price * 100) / 100,
    is_18plus: input.is18plus,
    kids_friendly: input.kidsFriendly,
    rules_accepted: input.rulesAccepted,
  }
  const result = await rpc<{ id?: string; status?: string; error?: string; max?: number }>('event_save', { p_event: eventId, p: payload })
  if (!result) return { error: 'saveError' }
  if (result.id && !eventId) await awardToolPoint('events')
  return result
}

export async function cancelEvent(eventId: string): Promise<string> {
  if (!UUID_RE.test(eventId)) return 'invalid'
  return (await rpc<string>('event_cancel', { p_event: eventId })) ?? 'saveError'
}

export async function registerToEvent(eventId: string): Promise<{ pass?: string; error?: string }> {
  if (!UUID_RE.test(eventId)) return { error: 'invalid' }
  return (await rpc<{ pass?: string; error?: string }>('event_register', { p_event: eventId })) ?? { error: 'saveError' }
}

export async function unregisterFromEvent(eventId: string): Promise<string> {
  if (!UUID_RE.test(eventId)) return 'invalid'
  return (await rpc<string>('event_unregister', { p_event: eventId })) ?? 'saveError'
}

export async function getAttendees(eventId: string): Promise<EventAttendee[]> {
  if (!UUID_RE.test(eventId)) return []
  return (await rpc<EventAttendee[]>('event_attendees', { p_event: eventId })) ?? []
}

export async function checkInPass(eventId: string, code: string): Promise<{ result: string; name?: string; at?: string }> {
  if (!UUID_RE.test(eventId)) return { result: 'invalid' }
  return (await rpc<{ result: string; name?: string; at?: string }>('event_checkin', { p_event: eventId, p_code: code.trim().slice(0, 300) })) ?? { result: 'invalid' }
}

export async function openPass(token: string): Promise<{ result: string; name?: string; event_id?: string; role?: string }> {
  if (!/^[A-Z0-9]{6,20}$/i.test(token)) return { result: 'invalid' }
  return (await rpc<{ result: string; name?: string; event_id?: string; role?: string }>('event_pass_open', { p_token: token })) ?? { result: 'invalid' }
}

export async function reportEvent(eventId: string, reason: string): Promise<string> {
  if (!UUID_RE.test(eventId)) return 'invalid'
  return (await rpc<string>('event_report', { p_event: eventId, p_reason: reason.slice(0, 1000) })) ?? 'saveError'
}

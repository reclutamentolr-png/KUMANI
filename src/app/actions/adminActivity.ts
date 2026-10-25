'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { getMarketplaceTools } from '@/lib/marketplaceTools'

// Admin → Attività del giorno: chi si è collegato in un giorno (ora di Roma),
// per quanto tempo, da quale dispositivo, quali servizi ha aperto, quanto
// tempo ci è rimasto e quali ha usato davvero (KU Karma). Lo Staff è escluso.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Nomi dei servizi con la pagina fuori dall'elenco del marketplace
const EXTRA_TITLES: Record<string, string> = {
  events: 'Kuman Events',
  chat: 'Chat',
  convivio: 'Convivio',
  listings: 'Bacheca annunci',
  spotlight: 'Spotlight',
  timebank: 'Banca del tempo',
}

export type ActivityTool = { tool: string; title: string; seconds: number; used: boolean }
export type ActivityPerson = {
  id: string
  name: string
  plan: string | null
  newToday: boolean
  devices: string[]
  sessions: number
  seconds: number
  first: string | null
  last: string | null
  tools: ActivityTool[]
}

// Mezzanotte di Roma del giorno indicato, in millisecondi UTC
function romeMidnight(day: string) {
  const guess = Date.parse(`${day}T00:00:00Z`)
  const offset = (t: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t))
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - t
  }
  return guess - offset(guess - offset(guess))
}

const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export async function adminDailyActivity(day: string) {
  if (!(await verifyAdmin('stats.read'))) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const from = new Date(romeMidnight(day)).toISOString()
  const to = new Date(romeMidnight(shiftDay(day, 1))).toISOString()

  const [{ data: sessions }, { data: opens }, { data: used }, { data: times }, { data: staff }] = await Promise.all([
    db().from('user_sessions').select('user_id, started_at, last_active_at, active_seconds, device').gte('last_active_at', from).lt('started_at', to).limit(5000),
    db().from('tool_opens').select('user_id, tool_name').eq('opened_on', day).limit(5000),
    db().from('daily_tool_points').select('user_id, tool_name').eq('awarded_on', day).limit(5000),
    db().from('tool_time').select('user_id, tool_name, active_seconds').eq('day', day).limit(5000),
    db().from('admin_users').select('user_id'),
  ])

  const people = new Map<string, ActivityPerson & { toolMap: Map<string, ActivityTool> }>()
  const person = (id: string) => {
    let p = people.get(id)
    if (!p) {
      p = { id, name: '', plan: null, newToday: false, devices: [], sessions: 0, seconds: 0, first: null, last: null, tools: [], toolMap: new Map() }
      people.set(id, p)
    }
    return p
  }
  const tool = (p: ActivityPerson & { toolMap: Map<string, ActivityTool> }, name: string) => {
    let t = p.toolMap.get(name)
    if (!t) {
      t = { tool: name, title: name, seconds: 0, used: false }
      p.toolMap.set(name, t)
    }
    return t
  }

  for (const s of sessions ?? []) {
    const p = person(s.user_id)
    p.sessions += 1
    p.seconds += s.active_seconds
    if (!p.devices.includes(s.device)) p.devices.push(s.device)
    if (!p.first || s.started_at < p.first) p.first = s.started_at
    if (!p.last || s.last_active_at > p.last) p.last = s.last_active_at
  }
  for (const o of opens ?? []) tool(person(o.user_id), o.tool_name)
  for (const u of used ?? []) tool(person(u.user_id), u.tool_name).used = true
  for (const t of times ?? []) tool(person(t.user_id), t.tool_name).seconds += t.active_seconds

  // Lo Staff non si conta (come nelle sessioni)
  const staffIds = new Set((staff ?? []).map((s) => s.user_id as string))
  const ids = [...people.keys()]
  const { data: profiles } = ids.length
    ? await db().from('profiles').select('id, first_name, last_name, username, subscription_plan, subscription_status, created_at, is_admin').in('id', ids)
    : { data: [] }
  const t = await getTranslations({ locale: 'it', namespace: 'marketplace' })
  const titles = new Map(getMarketplaceTools(t).map((x) => [x.toolName, x.title]))

  const list: ActivityPerson[] = []
  for (const pr of profiles ?? []) {
    if (pr.is_admin || staffIds.has(pr.id)) continue
    const p = people.get(pr.id)!
    p.name = [pr.first_name, pr.last_name].filter(Boolean).join(' ') || pr.username || '—'
    p.plan = pr.subscription_status === 'active' || pr.subscription_status === 'trialing' ? (pr.subscription_plan === 'pro' ? 'Pro' : 'Plus') : 'Free'
    p.newToday = Boolean(pr.created_at && pr.created_at >= from && pr.created_at < to)
    const { toolMap, ...rest } = p
    list.push({
      ...rest,
      tools: [...toolMap.values()].map((x) => ({ ...x, title: titles.get(x.tool) ?? EXTRA_TITLES[x.tool] ?? x.tool })).sort((a, b) => b.seconds - a.seconds || Number(b.used) - Number(a.used) || a.title.localeCompare(b.title)),
    })
  }
  list.sort((a, b) => b.seconds - a.seconds || b.tools.length - a.tools.length)

  // Servizi del giorno: persone diverse e tempo totale
  const byTool = new Map<string, { tool: string; title: string; people: number; seconds: number; used: number }>()
  for (const p of list) {
    for (const x of p.tools) {
      const row = byTool.get(x.tool) ?? { tool: x.tool, title: x.title, people: 0, seconds: 0, used: 0 }
      row.people += 1
      row.seconds += x.seconds
      if (x.used) row.used += 1
      byTool.set(x.tool, row)
    }
  }

  return {
    day,
    people: list,
    tools: [...byTool.values()].sort((a, b) => b.people - a.people || b.seconds - a.seconds),
    totals: {
      people: list.length,
      seconds: list.reduce((s, p) => s + p.seconds, 0),
      newToday: list.filter((p) => p.newToday).length,
      mobile: list.filter((p) => p.devices.includes('mobile')).length,
    },
  }
}

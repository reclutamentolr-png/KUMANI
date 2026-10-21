import { createClient as createServiceClient } from '@supabase/supabase-js'

// «Home di benvenuto» della dashboard: per chi è appena entrato, con qualsiasi
// piano (anche i primi 50 con il Base), «scegli cosa ti interessa di più» e
// «Inizia da qui». Si mostra nella vista Lite per 7 giorni dall'iscrizione
// (la vista di partenza dei nuovi iscritti è Lite).
// Qui anche gli accessi (giorni diversi con l'accesso), che servono per
// mostrare «Diventa Kumano verificato» dopo 7 accessi.
const WELCOME_DAYS = 7
export const VERIFIED_AFTER_LOGINS = 7

export type WelcomeSteps = {
  // 1. Ha scelto cosa gli serve (o ha già dei servizi preferiti)
  picked: boolean
  // 2. Ha aperto almeno un servizio
  tried: boolean
  // 3. Ha guardato il video di KUMANI o lo ha condiviso (o ha già invitato qualcuno)
  third: boolean
}

// newcomer: nuovo iscritto Gratis (primi 7 giorni), parte dalla vista Lite
export type WelcomeState = { show: boolean; newcomer: boolean; steps: WelcomeSteps; needs: string[]; loginDays: number }

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export async function getWelcomeState(input: {
  userId: string
  createdAt: string | null | undefined
  metadata: Record<string, unknown> | null | undefined
  favoritesCount: number
  // Da mostrare a questa persona (oggi: tutti i nuovi iscritti, qualunque piano)
  free: boolean
}): Promise<WelcomeState> {
  const db = service()
  const meta = input.metadata ?? {}
  const needs = Array.isArray(meta.needs) ? (meta.needs as unknown[]).filter((n): n is string => typeof n === 'string') : []
  const created = input.createdAt ? Date.parse(input.createdAt) : NaN
  const recent = Number.isFinite(created) && Date.now() - created < WELCOME_DAYS * 86_400_000
  // La vista (Lite, Completa, Icone) la decide la pagina: qui solo se è un nuovo iscritto Gratis
  const eligible = input.free && recent

  const count = (r: { count: number | null }) => r.count ?? 0
  const [logins, opened, pauses, invited] = await Promise.all([
    db.from('login_day_counts').select('days').eq('user_id', input.userId).maybeSingle(),
    eligible ? db.from('tool_opens').select('user_id', { count: 'exact', head: true }).eq('user_id', input.userId) : Promise.resolve({ count: 0 }),
    eligible ? db.from('wellness_pauses').select('id', { count: 'exact', head: true }).eq('user_id', input.userId).not('finished_at', 'is', null) : Promise.resolve({ count: 0 }),
    eligible ? db.from('profiles').select('id', { count: 'exact', head: true }).eq('sponsor_id', input.userId) : Promise.resolve({ count: 0 }),
  ])
  const steps: WelcomeSteps = {
    picked: needs.length > 0 || input.favoritesCount > 0,
    tried: count(opened) > 0,
    third: meta.welcome_third === true || count(pauses) > 0 || count(invited) > 0,
  }
  // A passi fatti resta il «Complimenti» finché non tocca «Vai alla mia Home»
  const closed = meta.welcome_closed === true
  return { show: eligible && !closed, newcomer: eligible, steps, needs, loginDays: (logins.data?.days as number | undefined) ?? 0 }
}

// Home a icone: giorni di uso per servizio negli ultimi 30 giorni (tool_opens:
// una riga per persona, servizio e giorno), per mettere in alto i più usati
export async function getToolUsage(userId: string): Promise<Record<string, number>> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const { data } = await service().from('tool_opens').select('tool_name').eq('user_id', userId).gte('opened_on', since).limit(2000)
  const usage: Record<string, number> = {}
  for (const row of (data ?? []) as { tool_name: string }[]) usage[row.tool_name] = (usage[row.tool_name] ?? 0) + 1
  return usage
}

'use server'

import { verifyAdmin } from '@/lib/verifyAdmin'
import { KUMANI_MAILBOXES } from '@/lib/contactInfo'
import { sendEmail } from '@/lib/email'

// Admin → Gestione Email: gli indirizzi @kumani.io (support, privacy, info)
// ricevono con Cloudflare Email Routing, che li inoltra alla casella Gmail di
// KUMANI; per rispondere con lo stesso indirizzo Gmail invia tramite l'SMTP
// di Resend. Qui si legge lo stato e si fanno i passaggi dalle due API.
//
// Permessi del token CLOUDFLARE_API_TOKEN: Zone → Zone: Read, Zone Settings: Edit, DNS: Edit,
// Email Routing Rules: Edit; Account → Email Routing Addresses: Edit.

const CF = 'https://api.cloudflare.com/client/v4'
const ZONE = () => process.env.CLOUDFLARE_ZONE || 'kumani.io'

type CfResult<T> = { ok: boolean; status: number; result?: T; error?: string }

async function cf<T>(path: string, init?: { method?: string; body?: unknown }): Promise<CfResult<T>> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) return { ok: false, status: 0, error: 'CLOUDFLARE_API_TOKEN mancante' }
  try {
    const res = await fetch(`${CF}${path}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean; result?: T; errors?: { code: number; message: string }[] } | null
    if (!res.ok || json?.success === false) {
      const message = json?.errors?.map((e) => e.message).join('; ') || `Errore ${res.status}`
      return { ok: false, status: res.status, error: res.status === 403 ? `Permesso mancante nel token Cloudflare (${message})` : message }
    }
    return { ok: true, status: res.status, result: json?.result }
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

async function zone() {
  const res = await cf<{ id: string; name: string; account: { id: string } }[]>(`/zones?name=${encodeURIComponent(ZONE())}`)
  const z = res.result?.[0]
  return z ? { id: z.id, name: z.name, accountId: z.account.id } : { error: res.error ?? `Dominio ${ZONE()} non trovato in Cloudflare` }
}

type Rule = {
  id: string
  name?: string
  enabled: boolean
  matchers: { type: string; field?: string; value?: string }[]
  actions: { type: string; value?: string[] }[]
}

const forwardsOf = (rule?: Rule | null) => rule?.actions.filter((a) => a.type === 'forward').flatMap((a) => a.value ?? []) ?? []

export type EmailAdminState = {
  missing: string[]
  zone?: string
  error?: string
  routing?: { enabled: boolean; status: string; error?: string }
  dnsIssues?: string[]
  destinations?: { id: string; email: string; verified: boolean }[]
  destinationsError?: string
  mailboxes: { address: string; label: string; ruleId?: string; enabled: boolean; forwardTo: string[] }[]
  rulesError?: string
  catchAll?: { enabled: boolean; forwardTo: string[] }
  resend: { configured: boolean; domain?: { name: string; status: string }; error?: string }
}

export async function adminEmailState(): Promise<{ success: boolean; state?: EmailAdminState; error?: string }> {
  if (!(await verifyAdmin('settings.read'))) return { success: false, error: 'Non autorizzato' }

  const missing = ['CLOUDFLARE_API_TOKEN', 'RESEND_API_KEY', 'EMAIL_FROM'].filter((k) => !process.env[k])
  const resend = await resendState()
  const base: EmailAdminState = {
    missing,
    mailboxes: KUMANI_MAILBOXES.map((m) => ({ address: m.address, label: m.label, enabled: false, forwardTo: [] })),
    resend,
  }
  if (!process.env.CLOUDFLARE_API_TOKEN) return { success: true, state: base }

  const z = await zone()
  if ('error' in z) return { success: true, state: { ...base, error: z.error } }

  const [routing, dns, destinations, rules, catchAll] = await Promise.all([
    cf<{ enabled: boolean; status: string }>(`/zones/${z.id}/email/routing`),
    cf<{ record?: { type: string; name: string; content: string }[]; errors?: { code: string; missing?: { type: string; name: string; content: string } }[] }>(
      `/zones/${z.id}/email/routing/dns`,
    ),
    cf<{ id: string; email: string; verified: string | null }[]>(`/accounts/${z.accountId}/email/routing/addresses?per_page=50`),
    cf<Rule[]>(`/zones/${z.id}/email/routing/rules?per_page=50`),
    cf<Rule>(`/zones/${z.id}/email/routing/rules/catch_all`),
  ])

  const ruleFor = (address: string) =>
    rules.result?.find((r) => r.matchers.some((m) => m.type === 'literal' && m.field === 'to' && m.value?.toLowerCase() === address))

  const dnsIssues = (dns.result?.errors ?? [])
    .map((e) => (e.missing ? `Manca il record ${e.missing.type} ${e.missing.name} → ${e.missing.content}` : e.code))
    .filter(Boolean)

  return {
    success: true,
    state: {
      ...base,
      zone: z.name,
      routing: routing.ok
        ? { enabled: Boolean(routing.result?.enabled), status: routing.result?.status ?? '—' }
        : { enabled: false, status: '—', error: routing.error },
      dnsIssues,
      destinations: destinations.result?.map((d) => ({ id: d.id, email: d.email, verified: Boolean(d.verified) })),
      destinationsError: destinations.ok ? undefined : destinations.error,
      mailboxes: base.mailboxes.map((m) => {
        const rule = ruleFor(m.address)
        return { ...m, ruleId: rule?.id, enabled: Boolean(rule?.enabled), forwardTo: forwardsOf(rule) }
      }),
      rulesError: rules.ok ? undefined : rules.error,
      catchAll: catchAll.ok ? { enabled: Boolean(catchAll.result?.enabled) && forwardsOf(catchAll.result).length > 0, forwardTo: forwardsOf(catchAll.result) } : undefined,
    },
  }
}

async function resendState(): Promise<EmailAdminState['resend']> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { configured: false }
  try {
    const res = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    if (!res.ok) return { configured: true, error: res.status === 401 ? 'La chiave Resend può solo inviare (non legge i domini)' : `Errore ${res.status}` }
    const body = (await res.json()) as { data?: { name: string; status: string }[] }
    const domain = body.data?.find((d) => ZONE().endsWith(d.name) || d.name.endsWith(ZONE()))
    return { configured: true, domain }
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : String(error) }
  }
}

type ActionResult = { success: boolean; error?: string; message?: string }

async function writer() {
  return Boolean(await verifyAdmin('settings.write'))
}

// 1. Attiva Email Routing (Cloudflare aggiunge da solo i record MX e SPF)
export async function adminEnableEmailRouting(): Promise<ActionResult> {
  if (!(await writer())) return { success: false, error: 'Non autorizzato' }
  const z = await zone()
  if ('error' in z) return { success: false, error: z.error }
  const res = await cf(`/zones/${z.id}/email/routing/dns`, { method: 'POST', body: { name: z.name } })
  if (!res.ok) {
    const legacy = await cf(`/zones/${z.id}/email/routing/enable`, { method: 'POST', body: {} })
    if (!legacy.ok) return { success: false, error: res.error }
  }
  return { success: true, message: 'Email Routing attivato: Cloudflare ha aggiunto i record MX e SPF.' }
}

// 2. Casella di destinazione: Cloudflare le manda un'email con il link di conferma
export async function adminAddEmailDestination(email: string): Promise<ActionResult> {
  if (!(await writer())) return { success: false, error: 'Non autorizzato' }
  const clean = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { success: false, error: 'Indirizzo email non valido' }
  if (clean.endsWith(`@${ZONE()}`)) return { success: false, error: `La destinazione deve essere fuori da ${ZONE()} (es. la Gmail di KUMANI)` }
  const z = await zone()
  if ('error' in z) return { success: false, error: z.error }
  const res = await cf(`/accounts/${z.accountId}/email/routing/addresses`, { method: 'POST', body: { email: clean } })
  if (!res.ok) return { success: false, error: res.error }
  return { success: true, message: `Cloudflare ha inviato un'email di conferma a ${clean}: apri il link, poi premi Aggiorna.` }
}

// 3. Collega support@, privacy@ e info@ alla casella scelta (crea o aggiorna le regole)
export async function adminConnectMailboxes(destination: string): Promise<ActionResult> {
  if (!(await writer())) return { success: false, error: 'Non autorizzato' }
  const z = await zone()
  if ('error' in z) return { success: false, error: z.error }
  const rules = await cf<Rule[]>(`/zones/${z.id}/email/routing/rules?per_page=50`)
  if (!rules.ok) return { success: false, error: rules.error }
  for (const m of KUMANI_MAILBOXES) {
    const existing = rules.result?.find((r) => r.matchers.some((x) => x.type === 'literal' && x.field === 'to' && x.value?.toLowerCase() === m.address))
    const body = {
      name: `KUMANI ${m.address}`,
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: m.address }],
      actions: [{ type: 'forward', value: [destination] }],
    }
    const res = existing
      ? await cf(`/zones/${z.id}/email/routing/rules/${existing.id}`, { method: 'PUT', body })
      : await cf(`/zones/${z.id}/email/routing/rules`, { method: 'POST', body })
    if (!res.ok) return { success: false, error: `${m.address}: ${res.error}` }
  }
  return { success: true, message: `I 3 indirizzi ora arrivano a ${destination}.` }
}

// Catch-all: qualsiasi altro indirizzo @kumani.io (es. errori di battitura)
export async function adminSetCatchAll(enabled: boolean, destination: string): Promise<ActionResult> {
  if (!(await writer())) return { success: false, error: 'Non autorizzato' }
  const z = await zone()
  if ('error' in z) return { success: false, error: z.error }
  const res = await cf(`/zones/${z.id}/email/routing/rules/catch_all`, {
    method: 'PUT',
    body: {
      name: 'KUMANI catch-all',
      enabled,
      matchers: [{ type: 'all' }],
      actions: enabled ? [{ type: 'forward', value: [destination] }] : [{ type: 'drop' }],
    },
  })
  if (!res.ok) return { success: false, error: res.error }
  return { success: true, message: enabled ? `Ogni altro indirizzo @${z.name} arriva a ${destination}.` : 'Gli altri indirizzi vengono scartati.' }
}

// 4. Prova: un'email da Resend a ciascun indirizzo, deve arrivare nella Gmail
export async function adminSendMailboxTest(address: string): Promise<ActionResult> {
  if (!(await writer())) return { success: false, error: 'Non autorizzato' }
  if (!KUMANI_MAILBOXES.some((m) => m.address === address)) return { success: false, error: 'Indirizzo non gestito' }
  const when = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
  const res = await sendEmail({
    to: address,
    subject: `Prova inoltro ${address} · ${when}`,
    text: `Email di prova inviata da Admin → Gestione Email il ${when}. Se la leggi nella Gmail di KUMANI, l'inoltro di ${address} funziona.`,
    html: `<p>Email di prova inviata da <b>Admin → Gestione Email</b> il ${when}.</p><p>Se la leggi nella Gmail di KUMANI, l'inoltro di <b>${address}</b> funziona.</p>`,
  })
  if (!res.sent) return { success: false, error: res.error === 'not_configured' ? 'RESEND_API_KEY o EMAIL_FROM mancanti' : `Invio non riuscito (${res.error})` }
  return { success: true, message: `Email di prova inviata a ${address}: controlla la Gmail tra qualche secondo.` }
}

// 5. Password SMTP per "Invia come" di Gmail: una chiave Resend che può solo
// inviare, dal solo dominio kumani.io. Si vede una volta sola.
export async function adminCreateGmailSmtpKey(): Promise<ActionResult & { token?: string }> {
  if (!(await writer())) return { success: false, error: 'Non autorizzato' }
  const key = process.env.RESEND_API_KEY
  if (!key) return { success: false, error: 'RESEND_API_KEY mancante' }
  const auth = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  try {
    const domains = await fetch('https://api.resend.com/domains', { headers: auth, signal: AbortSignal.timeout(10_000) })
    if (!domains.ok) return { success: false, error: 'La chiave Resend del sito non può creare altre chiavi: creala a mano in Resend → API Keys (Sending access).' }
    const list = ((await domains.json()) as { data?: { id: string; name: string }[] }).data ?? []
    const domain = list.find((d) => d.name === ZONE())
    const res = await fetch('https://api.resend.com/api-keys', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: `Gmail SMTP ${new Date().toISOString().slice(0, 10)}`, permission: 'sending_access', ...(domain ? { domain_id: domain.id } : {}) }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = (await res.json().catch(() => null)) as { token?: string; message?: string } | null
    if (!res.ok || !body?.token) return { success: false, error: body?.message ?? `Errore Resend ${res.status}` }
    return { success: true, token: body.token, message: 'Chiave creata: copiala ora, non sarà più visibile.' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

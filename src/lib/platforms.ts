import { createClient as createServiceClient } from '@supabase/supabase-js'
import { SITE_URL } from '@/lib/siteUrl'

// Admin → Piattaforme collegate: stato e consumi di Supabase, Resend,
// Vercel, Cloudflare e Stripe, letti dalle loro API con le chiavi del
// server. Solo lettura. Una piattaforma senza chiave risulta "da collegare"
// e indica quale variabile aggiungere.

export type PlatformStatus = 'ok' | 'warning' | 'error' | 'not_configured'

export type PlatformItem = {
  label: string
  value: string
  // Uso rispetto al limite, 0–100 (barra colorata)
  percent?: number
  hint?: string
}

export type PlatformReport = {
  id: 'supabase' | 'resend' | 'vercel' | 'cloudflare' | 'stripe'
  name: string
  status: PlatformStatus
  summary: string
  items: PlatformItem[]
  // Variabili d'ambiente mancanti per collegarla
  missing?: string[]
  dashboardUrl: string
  latencyMs?: number
  notes?: string[]
}

const TIMEOUT = 12_000

const bytes = (n: number) => {
  if (!Number.isFinite(n)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}
const pct = (used: number, limit: number) => (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : undefined)
const num = (n: number) => new Intl.NumberFormat('it-IT').format(n)
const level = (percents: (number | undefined)[]): PlatformStatus => {
  const max = Math.max(0, ...percents.filter((p): p is number => typeof p === 'number'))
  return max >= 90 ? 'error' : max >= 75 ? 'warning' : 'ok'
}

async function timed<T>(fn: () => PromiseLike<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now()
  const value = await fn()
  return { value, ms: Date.now() - start }
}

async function getJson(url: string, headers: Record<string, string>) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT), cache: 'no-store' })
  const body = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, body, headers: res.headers }
}

// ---------------- Supabase ----------------

// Limiti dei piani (supabase.com/pricing): il piano si imposta con SUPABASE_PLAN
const SUPABASE_PLANS = {
  free: { label: 'Free', db: 500 * 1024 ** 2, storage: 1024 ** 3, mau: 50_000 },
  pro: { label: 'Pro', db: 8 * 1024 ** 3, storage: 100 * 1024 ** 3, mau: 100_000 },
} as const

async function supabaseReport(): Promise<PlatformReport> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ref = url?.match(/https:\/\/([^.]+)\./)?.[1]
  const base: Pick<PlatformReport, 'id' | 'name' | 'dashboardUrl'> = {
    id: 'supabase',
    name: 'Supabase',
    dashboardUrl: ref ? `https://supabase.com/dashboard/project/${ref}` : 'https://supabase.com/dashboard',
  }
  if (!url || !key) return { ...base, status: 'not_configured', summary: 'Chiavi mancanti', items: [], missing: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] }

  const plan = SUPABASE_PLANS[(process.env.SUPABASE_PLAN === 'pro' ? 'pro' : 'free') as keyof typeof SUPABASE_PLANS]
  const client = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  try {
    const { value, ms } = await timed(() => client.rpc('admin_platform_db_stats'))
    if (value.error || !value.data) {
      return {
        ...base,
        status: 'warning',
        summary: 'Database raggiungibile, statistiche non disponibili',
        latencyMs: ms,
        items: [],
        notes: ['Esegui la migrazione 20261215100000_admin_platform_stats.sql per leggere spazio e utenti.'],
      }
    }
    const s = value.data as {
      db_bytes: number
      tables: { name: string; bytes: number; rows: number }[]
      storage: { bucket: string; bytes: number; files: number }[]
      users: number
      active_30d: number
      new_30d: number
    }
    const storageBytes = s.storage.reduce((sum, b) => sum + b.bytes, 0)
    const dbPct = pct(s.db_bytes, plan.db)
    const stPct = pct(storageBytes, plan.storage)
    const mauPct = pct(s.active_30d, plan.mau)
    return {
      ...base,
      status: level([dbPct, stPct, mauPct]),
      summary: `Piano ${plan.label} · risponde in ${ms} ms`,
      latencyMs: ms,
      items: [
        { label: 'Database', value: `${bytes(s.db_bytes)} di ${bytes(plan.db)}`, percent: dbPct },
        { label: 'File (Storage)', value: `${bytes(storageBytes)} di ${bytes(plan.storage)}`, percent: stPct },
        { label: 'Utenti attivi (30 giorni)', value: `${num(s.active_30d)} di ${num(plan.mau)}`, percent: mauPct },
        { label: 'Utenti registrati', value: `${num(s.users)} (${num(s.new_30d)} nuovi in 30 giorni)` },
        { label: 'Tabelle più grandi', value: s.tables.slice(0, 4).map((t) => `${t.name} ${bytes(t.bytes)}`).join(' · ') },
        ...(s.storage.length ? [{ label: 'Spazio per cartella', value: s.storage.slice(0, 4).map((b) => `${b.bucket} ${bytes(b.bytes)} (${num(b.files)} file)`).join(' · ') }] : []),
      ],
      notes: process.env.SUPABASE_PLAN ? undefined : ['Limiti del piano Free. Se passi a Pro imposta SUPABASE_PLAN=pro.'],
    }
  } catch (error) {
    return { ...base, status: 'error', summary: 'Database non raggiungibile', items: [{ label: 'Errore', value: String(error).slice(0, 160) }] }
  }
}

// ---------------- Resend ----------------

const RESEND_PLANS = {
  free: { label: 'Free', month: 3000, day: 100 },
  pro: { label: 'Pro', month: 50_000, day: 0 },
} as const

async function resendReport(): Promise<PlatformReport> {
  const base: Pick<PlatformReport, 'id' | 'name' | 'dashboardUrl'> = { id: 'resend', name: 'Resend', dashboardUrl: 'https://resend.com/emails' }
  const key = process.env.RESEND_API_KEY
  if (!key) return { ...base, status: 'not_configured', summary: 'Chiave mancante', items: [], missing: ['RESEND_API_KEY'] }
  const plan = RESEND_PLANS[(process.env.RESEND_PLAN === 'pro' ? 'pro' : 'free') as keyof typeof RESEND_PLANS]
  const auth = { Authorization: `Bearer ${key}` }
  const items: PlatformItem[] = []
  const notes: string[] = []
  let status: PlatformStatus = 'ok'
  let latencyMs: number | undefined

  // Domini: devono essere "verified" per inviare
  try {
    const { value: domains, ms } = await timed(() => getJson('https://api.resend.com/domains', auth))
    latencyMs = ms
    if (!domains.ok) {
      status = 'error'
      items.push({ label: 'Domini', value: `Errore ${domains.status}` })
    } else {
      const list = ((domains.body as { data?: { name: string; status: string; region?: string }[] })?.data ?? [])
      if (list.length === 0) status = 'warning'
      for (const d of list) {
        if (d.status !== 'verified') status = 'warning'
        items.push({ label: `Dominio ${d.name}`, value: d.status === 'verified' ? `Verificato${d.region ? ` · ${d.region}` : ''}` : `Da verificare (${d.status})` })
      }
    }
  } catch (error) {
    status = 'error'
    items.push({ label: 'Domini', value: String(error).slice(0, 120) })
  }

  // Email del mese: si contano scorrendo l'elenco delle email inviate
  try {
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).getTime()
    const dayStart = Date.now() - 86_400_000
    let month = 0
    let day = 0
    let after: string | null = null
    let pages = 0
    let supported = true
    for (; pages < 60; pages++) {
      const res = await getJson(`https://api.resend.com/emails?limit=100${after ? `&after=${after}` : ''}`, auth)
      if (!res.ok) {
        supported = false
        break
      }
      const data = (res.body as { data?: { id: string; created_at: string }[]; has_more?: boolean })?.data ?? []
      let older = false
      for (const e of data) {
        const at = Date.parse(e.created_at)
        if (at >= monthStart) month++
        else older = true
        if (at >= dayStart) day++
      }
      if (older || !(res.body as { has_more?: boolean })?.has_more || data.length === 0) break
      after = data[data.length - 1].id
    }
    if (supported) {
      const mPct = pct(month, plan.month)
      items.unshift({ label: 'Email inviate questo mese', value: `${num(month)} di ${num(plan.month)}`, percent: mPct })
      if (plan.day) items.splice(1, 0, { label: 'Ultime 24 ore', value: `${num(day)} di ${num(plan.day)}`, percent: pct(day, plan.day) })
      const worst = level([mPct, plan.day ? pct(day, plan.day) : undefined])
      if (worst !== 'ok' && status === 'ok') status = worst
      if (pages >= 60) notes.push('Conteggio fermato a 6.000 email: per il totale esatto guarda il pannello Resend.')
    } else {
      notes.push('Il conteggio delle email del mese non è disponibile con questa chiave: guardalo nel pannello Resend.')
    }
  } catch {
    notes.push('Conteggio delle email non riuscito.')
  }
  notes.push('Comprende anche le email di accesso inviate da Supabase tramite Resend.')
  if (!process.env.RESEND_PLAN) notes.push('Limiti del piano Free. Se passi a Pro imposta RESEND_PLAN=pro.')
  return { ...base, status, summary: `Piano ${plan.label}`, items, notes, latencyMs }
}

// ---------------- Vercel ----------------

async function vercelReport(): Promise<PlatformReport> {
  const project = process.env.VERCEL_PROJECT || 'kumani'
  const team = process.env.VERCEL_TEAM_ID
  const base: Pick<PlatformReport, 'id' | 'name' | 'dashboardUrl'> = { id: 'vercel', name: 'Vercel', dashboardUrl: 'https://vercel.com/dashboard' }
  const token = process.env.VERCEL_TOKEN
  if (!token) {
    return {
      ...base,
      status: 'not_configured',
      summary: 'Chiave mancante',
      items: process.env.VERCEL_ENV ? [{ label: 'Ambiente', value: process.env.VERCEL_ENV }] : [],
      missing: ['VERCEL_TOKEN', 'VERCEL_PROJECT (facoltativo, predefinito "kumani")', 'VERCEL_TEAM_ID (se il progetto è in un team)'],
    }
  }
  const q = team ? `teamId=${encodeURIComponent(team)}` : ''
  const auth = { Authorization: `Bearer ${token}` }
  try {
    const { value: proj, ms } = await timed(() => getJson(`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}?${q}`, auth))
    if (!proj.ok) return { ...base, status: 'error', summary: `Progetto non trovato (${proj.status})`, items: [], latencyMs: ms }
    const p = proj.body as { id: string; name: string; framework?: string; nodeVersion?: string; accountId?: string }
    const [deps, doms] = await Promise.all([
      getJson(`https://api.vercel.com/v6/deployments?projectId=${p.id}&limit=8${q ? `&${q}` : ''}`, auth),
      getJson(`https://api.vercel.com/v9/projects/${p.id}/domains?${q}`, auth),
    ])
    const deployments = ((deps.body as { deployments?: { state?: string; readyState?: string; target?: string | null; created: number; meta?: { githubCommitMessage?: string } }[] })?.deployments ?? [])
    const domains = ((doms.body as { domains?: { name: string; verified: boolean; redirect?: string | null }[] })?.domains ?? [])
    const prod = deployments.find((d) => d.target === 'production')
    const state = (d?: { state?: string; readyState?: string }) => d?.readyState ?? d?.state ?? '—'
    const failed = deployments.filter((d) => state(d) === 'ERROR').length
    const items: PlatformItem[] = [
      { label: 'Progetto', value: `${p.name}${p.framework ? ` · ${p.framework}` : ''}${p.nodeVersion ? ` · Node ${p.nodeVersion}` : ''}` },
      {
        label: 'Ultimo deploy in produzione',
        value: prod ? `${state(prod) === 'READY' ? 'Online' : state(prod)} · ${new Date(prod.created).toLocaleString('it-IT')}` : '—',
        hint: prod?.meta?.githubCommitMessage?.slice(0, 120),
      },
      { label: 'Ultimi deploy', value: `${deployments.length} controllati · ${failed} con errore` },
      ...domains.map((d) => ({ label: `Dominio ${d.name}`, value: d.verified ? (d.redirect ? `Reindirizza a ${d.redirect}` : 'Verificato') : 'Da verificare' })),
    ]
    const status: PlatformStatus = !prod || state(prod) === 'ERROR' ? 'error' : failed > 0 || domains.some((d) => !d.verified) ? 'warning' : 'ok'
    return {
      ...base,
      dashboardUrl: `https://vercel.com/${team ?? ''}${team ? '/' : ''}${p.name}`.replace('https://vercel.com//', 'https://vercel.com/'),
      status,
      summary: `Sito: ${SITE_URL}`,
      latencyMs: ms,
      items,
      notes: ['Consumi del mese (banda, funzioni, immagini) non sono esposti dalle API pubbliche: guardali in Vercel → Usage.'],
    }
  } catch (error) {
    return { ...base, status: 'error', summary: 'Vercel non raggiungibile', items: [{ label: 'Errore', value: String(error).slice(0, 160) }] }
  }
}

// ---------------- Cloudflare ----------------

async function cloudflareReport(): Promise<PlatformReport> {
  const zoneName = process.env.CLOUDFLARE_ZONE || 'kumani.io'
  const base: Pick<PlatformReport, 'id' | 'name' | 'dashboardUrl'> = { id: 'cloudflare', name: 'Cloudflare', dashboardUrl: 'https://dash.cloudflare.com' }
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) return { ...base, status: 'not_configured', summary: 'Chiave mancante', items: [], missing: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE (facoltativo, predefinito "kumani.io")'] }
  const auth = { Authorization: `Bearer ${token}` }
  try {
    const { value: zones, ms } = await timed(() => getJson(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zoneName)}`, auth))
    const zone = ((zones.body as { result?: { id: string; name: string; status: string; plan?: { name: string }; name_servers?: string[]; account?: { id: string } }[] })?.result ?? [])[0]
    if (!zones.ok || !zone) return { ...base, status: 'error', summary: `Dominio ${zoneName} non trovato`, items: [], latencyMs: ms }
    const [dns, routing] = await Promise.all([
      getJson(`https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?per_page=100`, auth),
      getJson(`https://api.cloudflare.com/client/v4/zones/${zone.id}/email/routing`, auth),
    ])
    const records = ((dns.body as { result?: { type: string; name: string; proxied?: boolean }[] })?.result ?? [])
    const byType = records.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.type]: (acc[r.type] ?? 0) + 1 }), {})
    const web = records.filter((r) => (r.type === 'CNAME' || r.type === 'A') && (r.name === zoneName || r.name === `www.${zoneName}`))
    const routingBody = (routing.body as { result?: { enabled?: boolean; status?: string } })?.result
    const items: PlatformItem[] = [
      { label: 'Dominio', value: `${zone.name} · ${zone.status === 'active' ? 'Attivo' : zone.status}` },
      { label: 'Piano', value: zone.plan?.name ?? '—' },
      {
        label: 'Record DNS',
        value: dns.ok ? `${records.length} (${Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(', ')})` : `Non leggibili (permesso DNS mancante)`,
      },
      ...web.map((r) => ({ label: `Sito ${r.name}`, value: r.proxied ? 'Proxy arancione (sconsigliato con Vercel)' : 'DNS only (corretto per Vercel)' })),
      {
        label: 'Email Routing',
        value: routing.ok ? (routingBody?.enabled ? `Attivo${routingBody.status ? ` · ${routingBody.status}` : ''}` : 'Non attivo') : 'Non leggibile (permesso Email Routing mancante)',
      },
    ]
    const status: PlatformStatus =
      zone.status !== 'active' ? 'error' : web.some((r) => r.proxied) || (routing.ok && !routingBody?.enabled) ? 'warning' : 'ok'
    return {
      ...base,
      dashboardUrl: zone.account?.id ? `https://dash.cloudflare.com/${zone.account.id}/${zone.name}` : base.dashboardUrl,
      status,
      summary: zone.name_servers?.length ? `Name server: ${zone.name_servers.join(', ')}` : zone.name,
      latencyMs: ms,
      items,
    }
  } catch (error) {
    return { ...base, status: 'error', summary: 'Cloudflare non raggiungibile', items: [{ label: 'Errore', value: String(error).slice(0, 160) }] }
  }
}

// ---------------- Stripe ----------------

async function stripeReport(): Promise<PlatformReport> {
  const key = process.env.STRIPE_SECRET_KEY
  const live = key?.startsWith('sk_live') || key?.startsWith('rk_live')
  const base: Pick<PlatformReport, 'id' | 'name' | 'dashboardUrl'> = {
    id: 'stripe',
    name: 'Stripe',
    dashboardUrl: live ? 'https://dashboard.stripe.com' : 'https://dashboard.stripe.com/test/dashboard',
  }
  if (!key) return { ...base, status: 'not_configured', summary: 'Chiave mancante', items: [], missing: ['STRIPE_SECRET_KEY'] }
  const auth = { Authorization: `Bearer ${key}` }
  try {
    const { value: account, ms } = await timed(() => getJson('https://api.stripe.com/v1/account', auth))
    if (!account.ok) return { ...base, status: 'error', summary: `Chiave non valida (${account.status})`, items: [], latencyMs: ms }
    const [balance, hooks, subs] = await Promise.all([
      getJson('https://api.stripe.com/v1/balance', auth),
      getJson('https://api.stripe.com/v1/webhook_endpoints?limit=20', auth),
      getJson('https://api.stripe.com/v1/subscriptions?status=active&limit=100', auth),
    ])
    const a = account.body as { business_profile?: { name?: string }; settings?: { dashboard?: { display_name?: string } }; country?: string; charges_enabled?: boolean; payouts_enabled?: boolean }
    const money = (list?: { amount: number; currency: string }[]) =>
      (list ?? []).map((m) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: m.currency.toUpperCase() }).format(m.amount / 100)).join(' + ') || '0'
    const b = balance.body as { available?: { amount: number; currency: string }[]; pending?: { amount: number; currency: string }[] }
    const endpoints = ((hooks.body as { data?: { url: string; status: string; enabled_events: string[] }[] })?.data ?? [])
    const expected = `${SITE_URL}/api/webhooks/stripe`
    // Il webhook di KUMANI: quello sul dominio del sito o, in mancanza, su un altro dominio (es. kumani.vercel.app)
    const ourHook = endpoints.find((h) => h.url === expected) ?? endpoints.find((h) => h.url.endsWith('/api/webhooks/stripe'))
    const otherHost = ourHook && ourHook.url !== expected
    const s = subs.body as { data?: unknown[]; has_more?: boolean }
    const items: PlatformItem[] = [
      { label: 'Modalità', value: live ? 'LIVE (pagamenti veri)' : 'Test (pagamenti di prova)' },
      { label: 'Account', value: `${a.settings?.dashboard?.display_name ?? a.business_profile?.name ?? '—'}${a.country ? ` · ${a.country}` : ''}` },
      { label: 'Incassi e bonifici', value: `Pagamenti ${a.charges_enabled ? 'attivi' : 'non attivi'} · Bonifici ${a.payouts_enabled ? 'attivi' : 'non attivi'}` },
      { label: 'Saldo disponibile', value: money(b?.available), hint: `In arrivo: ${money(b?.pending)}` },
      { label: 'Abbonamenti attivi', value: s?.data ? `${num(s.data.length)}${s.has_more ? '+' : ''}` : '—' },
      {
        label: 'Webhook',
        value: ourHook ? `${ourHook.status === 'enabled' ? 'Attivo' : ourHook.status} · ${ourHook.enabled_events.length} eventi` : `Nessun webhook verso ${expected}`,
        hint: ourHook ? ourHook.url : endpoints.length ? endpoints.map((h) => h.url).join(' · ') : undefined,
      },
    ]
    const status: PlatformStatus = !ourHook || ourHook.status !== 'enabled' ? 'warning' : 'ok'
    const notes = otherHost ? [`Il webhook punta a ${ourHook.url}: quando il sito è definitivo su ${SITE_URL} conviene aggiornarlo.`] : undefined
    return { ...base, status, summary: live ? 'Pagamenti veri' : 'Modalità test', latencyMs: ms, items, notes }
  } catch (error) {
    return { ...base, status: 'error', summary: 'Stripe non raggiungibile', items: [{ label: 'Errore', value: String(error).slice(0, 160) }] }
  }
}

export async function platformReports(): Promise<PlatformReport[]> {
  return Promise.all([supabaseReport(), vercelReport(), resendReport(), cloudflareReport(), stripeReport()])
}

import type { SupabaseClient } from '@supabase/supabase-js'

// Siti segnalati da fonti esterne (tabella scam_domains, vedi la migrazione
// 20270324100000): caricati ogni notte da /api/cron/scam-feeds, cercati da
// Speculum nel controllo dei siti.

export type ScamSource = 'amf' | 'phishdb' | 'urlhaus'
export type ScamDomainHit = { domain: string; source: ScamSource; category: string | null; listed_on: string | null }

// Piattaforme dove chiunque pubblica pagine (o link brevi): non si segnalano
// mai per intero, solo l'indirizzo preciso della pagina truffa se è un
// sottodominio (es. truffa-123.netlify.app).
export const SHARED_PLATFORMS = new Set([
  't.me', 'telegram.me', 'wa.me', 'bit.ly', 'tinyurl.com', 'linktr.ee',
  'google.com', 'sites.google.com', 'docs.google.com', 'forms.gle', 'drive.google.com', 'blogspot.com',
  'github.io', 'github.com', 'gitlab.io', 'vercel.app', 'netlify.app', 'web.app', 'firebaseapp.com', 'pages.dev', 'workers.dev', 'r2.dev',
  'herokuapp.com', 'onrender.com', 'glitch.me', 'repl.co', 'ngrok.io', 'duckdns.org', 'amazonaws.com', 'azurewebsites.net', 'ipfs.io',
  '000webhostapp.com', 'weebly.com', 'wixsite.com', 'wordpress.com', 'squarespace.com', 'webflow.io', 'framer.app', 'canva.site', 'godaddysites.com',
  'notion.site', 'dropbox.com', 'forms.office.com', 'sharepoint.com', 'facebook.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'x.com', 'twitter.com', 'linkedin.com',
])

// Dominio pulito da un indirizzo, un'email o un nome di sito: null se non è un dominio
export function normalizeDomain(value: string): string | null {
  let s = value.trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^[^@/\s]*@/, '')
  s = s.split(/[/?#\s]/)[0].replace(/:\d+$/, '').replace(/\.+$/, '').replace(/^www\./, '')
  try {
    s = new URL(`http://${s}`).hostname
  } catch {
    return null
  }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) || /^\d+(\.\d+){3}$/.test(s)) return null
  if (!/[a-z]/.test(s.split('.').pop() ?? '') || s.length > 253) return null
  return SHARED_PLATFORMS.has(s) ? null : s
}

// Il dominio e quelli che lo contengono (sub.truffa.com → sub.truffa.com,
// truffa.com), mai la sola estensione né una piattaforma condivisa
export function domainCandidates(domain: string): string[] {
  const parts = domain.toLowerCase().replace(/^www\./, '').split('.')
  const out: string[] = []
  for (let i = 0; i <= parts.length - 2; i++) {
    const candidate = parts.slice(i).join('.')
    if (SHARED_PLATFORMS.has(candidate)) break
    out.push(candidate)
  }
  return out
}

export async function findScamDomain(db: SupabaseClient, domain: string): Promise<ScamDomainHit[]> {
  const candidates = domainCandidates(domain)
  if (!candidates.length) return []
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await db
    .from('scam_domains')
    .select('domain, source, category, listed_on')
    .in('domain', candidates)
    .or(`expires_on.is.null,expires_on.gte.${today}`)
  if (error) {
    console.error('[scam-domains] lookup failed:', error.message)
    return []
  }
  return (data ?? []) as ScamDomainHit[]
}

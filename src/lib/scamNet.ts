// RETE ANTI-TRUFFA: tipi di dato, categorie di truffa e normalizzazione
// (uguale per chi segnala e per chi controlla, così lo stesso numero,
// sito o IBAN scritto in modi diversi finisce sempre nello stesso posto).
// I numeri di telefono si normalizzano sul server (scamNetPhone.ts).
import { normalizeIban, validateIban } from '@/lib/iban'

export const SCAM_KINDS = ['phone', 'site', 'iban', 'email', 'social', 'qr'] as const
export type ScamKind = (typeof SCAM_KINDS)[number]

export const SCAM_CATEGORIES = ['courier', 'bank', 'investment', 'romance', 'rental', 'marketplace', 'job', 'support', 'prize', 'phishing', 'other'] as const
export type ScamCategory = (typeof SCAM_CATEGORIES)[number]

export const SCAM_DESCRIPTION_MAX = 600
export const SCAM_CONTEST_MAX = 1000
// Livelli del distintivo «Guardiano» (segnalazioni confermate)
export const GUARDIAN_LEVELS = [
  { level: 'bronze', min: 1 },
  { level: 'silver', min: 5 },
  { level: 'gold', min: 10 },
] as const
export type GuardianLevel = (typeof GUARDIAN_LEVELS)[number]['level']

export function guardianLevel(confirmed: number): { level: GuardianLevel | null; next: (typeof GUARDIAN_LEVELS)[number] | null } {
  let level: GuardianLevel | null = null
  for (const l of GUARDIAN_LEVELS) if (confirmed >= l.min) level = l.level
  const next = GUARDIAN_LEVELS.find((l) => confirmed < l.min) ?? null
  return { level, next }
}

export type ScamTargetKey = { kind: ScamKind; key: string; display: string }

// Nome del sito: minuscolo, senza «www.», senza percorso
export function normalizeSite(raw: string): ScamTargetKey | null {
  let value = String(raw ?? '').trim()
  if (!value || value.length > 300) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
    if (!/^[a-z0-9.-]+\.[a-z0-9-]{2,}$/.test(host) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null
    return { kind: 'site', key: host, display: host }
  } catch {
    return null
  }
}

// Il sito e i domini «genitori» (pagamento.poste-falso.it → poste-falso.it)
export function siteKeys(host: string): string[] {
  const parts = host.split('.')
  const keys: string[] = []
  for (let i = 0; i <= parts.length - 2; i++) keys.push(parts.slice(i).join('.'))
  return keys
}

export function normalizeEmail(raw: string): ScamTargetKey | null {
  const value = String(raw ?? '').trim().toLowerCase().replace(/^mailto:/, '')
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z0-9-]{2,}$/.test(value)) return null
  return { kind: 'email', key: value, display: value }
}

export function normalizeScamIban(raw: string): ScamTargetKey | null {
  const result = validateIban(String(raw ?? ''))
  if (!result.valid) return null
  const key = normalizeIban(raw)
  return { kind: 'iban', key, display: maskIban(key) }
}

export function maskIban(iban: string): string {
  const v = iban.replace(/\s+/g, '').toUpperCase()
  return v.length > 8 ? `${v.slice(0, 4)} •••• •••• ${v.slice(-4)}` : v
}

// Profilo social: link (instagram.com/nome) o @nome
export function normalizeSocial(raw: string): ScamTargetKey | null {
  const value = String(raw ?? '').trim()
  if (!value || value.length > 200) return null
  if (/^@[\w.]{2,60}$/.test(value)) return { kind: 'social', key: value.toLowerCase(), display: value }
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '')
    const path = url.pathname.split('/').filter(Boolean)
    if (!host.includes('.') || !path.length) return null
    const key = `${host}/${path[0].toLowerCase()}`
    return { kind: 'social', key, display: key }
  } catch {
    return null
  }
}

// Contenuto di un QR: un link diventa un sito, un numero un telefono (sul server), il resto resta testo
export function normalizeQr(raw: string): ScamTargetKey | null {
  const value = String(raw ?? '').trim()
  if (!value || value.length > 300) return null
  if (/^https?:\/\//i.test(value)) return normalizeSite(value)
  if (/^mailto:/i.test(value)) return normalizeEmail(value)
  return { kind: 'qr', key: value.toLowerCase(), display: value.slice(0, 120) }
}

export function maskPhone(e164: string, international: string): string {
  const digits = international.replace(/\s+/g, ' ')
  const parts = digits.split(' ')
  if (parts.length < 3) return e164.slice(0, -4).replace(/\d/g, '•') + e164.slice(-2)
  return [...parts.slice(0, 2), ...parts.slice(2, -1).map((p) => p.replace(/\d/g, '•')), parts.at(-1)!.replace(/^\d+(?=\d{2}$)/, (m) => m.replace(/\d/g, '•'))].join(' ')
}

// Dato mostrato negli elenchi pubblici: siti ed email interi, numeri e IBAN in parte nascosti
export function publicDisplay(kind: ScamKind, display: string): string {
  if (kind === 'iban') return maskIban(display)
  return display
}

// Collegamento per segnalare dal risultato di un altro controllo
export function reportHref(kind: ScamKind, value: string): string {
  return `/marketplace/rete-antitruffa?tab=segnala&kind=${kind}&value=${encodeURIComponent(value)}`
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { findScamDomain, normalizeDomain } from '@/lib/scamDomains'
import { normalizeScamIban } from '@/lib/scamNet'
import { isIpLoggerHost } from '@/lib/checkmail/engine'

// Controllo antitruffa del testo di un annuncio (per lo Staff, prima di
// approvarlo): i link vengono cercati negli elenchi ufficiali dei siti truffa
// (CONSOB, AMF, BaFin, IVASS, phishing…), gli IBAN tra quelli confermati
// dalla Rete antitruffa della community.

export type ListingScanFlag =
  | { kind: 'scam_link'; value: string; source: string }
  | { kind: 'spy_link'; value: string }
  | { kind: 'scam_iban'; value: string; reports: number }
  | { kind: 'link'; value: string }
  | { kind: 'iban'; value: string }

const URL_RE = /\bhttps?:\/\/[^\s<>"]+|\bwww\.[^\s<>"]+|\b(?:[a-z0-9-]+\.)+(?:com|it|net|org|eu|io|info|biz|co|me|app|shop|store|online|site|xyz|de|fr|es|pt|ru|uk|ch|at|be|nl)\b(?:\/[^\s<>"]*)?/gi
const IBAN_RE = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/gi

export async function scanListingText(db: SupabaseClient, text: string): Promise<ListingScanFlag[]> {
  const flags: ListingScanFlag[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(URL_RE)) {
    const domain = normalizeDomain(match[0])
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    if (domain === 'kumani.io' || domain.endsWith('.kumani.io')) continue
    if (isIpLoggerHost(domain)) {
      flags.push({ kind: 'spy_link', value: domain })
      continue
    }
    const hits = await findScamDomain(db, domain)
    flags.push(hits.length ? { kind: 'scam_link', value: domain, source: hits[0].source } : { kind: 'link', value: domain })
    if (seen.size > 10) break
  }

  for (const match of text.matchAll(IBAN_RE)) {
    const key = normalizeScamIban(match[0])
    if (!key || seen.has(key.key)) continue
    seen.add(key.key)
    const { data } = await db
      .from('scam_targets')
      .select('confirmed_reports, reports_count')
      .eq('kind', 'iban')
      .eq('value_key', key.key)
      .eq('status', 'confirmed')
      .maybeSingle()
    flags.push(data ? { kind: 'scam_iban', value: key.display, reports: Number(data.confirmed_reports ?? data.reports_count ?? 1) } : { kind: 'iban', value: key.display })
  }
  return flags
}

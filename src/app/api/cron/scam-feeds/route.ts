import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeDomain, type ScamSource } from '@/lib/scamDomains'

// Ogni notte (Vercel Cron, vedi vercel.json): carica in scam_domains i siti
// segnalati da fonti esterne, per il controllo dei siti di Speculum.
// - AMF (Francia): liste nere ufficiali da data.gouv.fr (Licence Ouverte 2.0).
//   Restano finché l'AMF le tiene in elenco.
// - Phishing.Database (MIT): phishing attivo. Sono quasi 400.000 domini: si
//   tengono quelli europei e quelli che imitano banche, poste, corrieri e
//   servizi usati in Europa. Scadono 90 giorni dopo l'ultima volta in elenco.
// - URLhaus di abuse.ch (CC0): siti che distribuiscono virus, solo con nome
//   (non i semplici indirizzi IP). Scadono dopo 30 giorni.
// Se una fonte non risponde, le altre si caricano lo stesso.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Row = { domain: string; source: ScamSource; category: string | null; listed_on: string | null; last_seen: string; expires_on: string | null }

const AMF_DATASET = 'https://www.data.gouv.fr/api/1/datasets/641d5dab1d84b530f7720b08/'
const PHISHDB = 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt'
const URLHAUS = 'https://urlhaus.abuse.ch/downloads/csv_online/'

const EU_TLDS = new Set(['it', 'fr', 'es', 'de', 'pt', 'eu', 'at', 'be', 'nl', 'lu', 'ch', 'ie', 'pl', 'gr', 'ro', 'cz', 'sk', 'hu', 'si', 'hr', 'bg', 'dk', 'se', 'fi', 'ee', 'lv', 'lt', 'mt', 'cy', 'uk', 'no'])
// Marchi imitati più spesso nelle truffe europee
const EU_BRANDS =
  /poste|bancoposta|intesa|sanpaolo|unicredit|bper|fineco|mediolanum|credem|bancobpm|webank|hype|inps|agenziaentrate|entrate|spid|cie|telepass|autostrade|enel|eni|tim|vodafone|windtre|iliad|nexi|satispay|postepay|paypal|amazon|ebay|vinted|subito|booking|airbnb|netflix|disney|spotify|apple|icloud|microsoft|outlook|office365|dhl|fedex|ups|gls|brt|bartolini|sda|tnt|correos|seur|mrw|ctt|laposte|colissimo|chronopost|mondialrelay|hermes|dpd|deutschepost|caixa|bbva|santander|sabadell|bankinter|unicaja|ibercaja|kutxabank|bizum|cgd|millennium|novobanco|bancoctt|multibanco|mbway|ameli|impots|antai|caf|creditagricole|societegenerale|bnpparibas|lcl|boursorama|creditmutuel|banquepopulaire|caissedepargne|sparkasse|volksbank|commerzbank|deutschebank|postbank|n26|revolut|wise|ing|rabobank|abnamro|kbc|belfius|binance|coinbase|kraken|metamask|trustwallet|ledger|whatsapp|facebook|instagram|meta/

const day = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

async function fetchText(url: string, timeoutMs = 60_000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'KUMANI-scam-feeds/1.0 (+https://kumani.io)' } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.text()
}

// AMF: la categoria principale, in chiave semplice
function amfCategory(raw: string) {
  if (/usurpation/i.test(raw)) return 'impersonation'
  if (/crypto/i.test(raw)) return 'crypto'
  if (/forex|options_binaires/i.test(raw)) return 'forex'
  if (/biens_divers/i.test(raw)) return 'goods'
  if (/financement_participatif|immobiliers/i.test(raw)) return 'crowdfunding'
  return 'unauthorised'
}

async function loadAmf(): Promise<Row[]> {
  const meta = JSON.parse(await fetchText(AMF_DATASET, 30_000)) as { resources: { format: string; url: string; last_modified: string }[] }
  const csv = meta.resources.filter((r) => r.format?.toLowerCase() === 'csv').sort((a, b) => b.last_modified.localeCompare(a.last_modified))[0]
  if (!csv) throw new Error('AMF: nessun CSV')
  const lines = (await fetchText(csv.url)).replace(/^﻿/, '').split(/\r?\n/).slice(1)
  const rows = new Map<string, Row>()
  for (const line of lines) {
    const [name, category, date] = line.split(';').map((v) => v.trim().replace(/^"|"$/g, ''))
    const domain = name ? normalizeDomain(name.replace(/^prénom\.nom@/i, '')) : null
    if (!domain || rows.has(domain)) continue
    rows.set(domain, { domain, source: 'amf', category: amfCategory(category ?? ''), listed_on: /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date : null, last_seen: day(), expires_on: null })
  }
  return [...rows.values()]
}

async function loadPhishDb(): Promise<Row[]> {
  // Con e senza «www.» diventano lo stesso dominio: una riga sola
  const rows = new Map<string, Row>()
  for (const line of (await fetchText(PHISHDB, 120_000)).split(/\r?\n/)) {
    const domain = normalizeDomain(line)
    if (!domain) continue
    if (!EU_TLDS.has(domain.split('.').pop()!) && !EU_BRANDS.test(domain)) continue
    if (!rows.has(domain)) rows.set(domain, { domain, source: 'phishdb', category: 'phishing', listed_on: null, last_seen: day(), expires_on: day(90) })
  }
  return [...rows.values()]
}

async function loadUrlhaus(): Promise<Row[]> {
  const rows = new Map<string, Row>()
  for (const line of (await fetchText(URLHAUS)).split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const cols = line.split('","').map((v) => v.replace(/^"|"$/g, ''))
    const domain = cols[2] ? normalizeDomain(cols[2]) : null
    if (!domain || rows.has(domain)) continue
    rows.set(domain, { domain, source: 'urlhaus', category: 'malware', listed_on: cols[1]?.slice(0, 10) || null, last_seen: day(), expires_on: day(30) })
  }
  return [...rows.values()]
}

async function save(db: SupabaseClient, rows: Row[]) {
  for (let i = 0; i < rows.length; i += 5000) {
    const { error } = await db.from('scam_domains').upsert(rows.slice(i, i + 5000), { onConflict: 'domain,source' })
    if (error) throw new Error(error.message)
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const report: Record<string, number | string> = {}
  for (const [source, load] of [['amf', loadAmf], ['phishdb', loadPhishDb], ['urlhaus', loadUrlhaus]] as const) {
    try {
      const rows = await load()
      await save(db, rows)
      report[source] = rows.length
      // AMF: chi non è più in elenco esce (lista ufficiale completa)
      if (source === 'amf' && rows.length > 500) {
        await db.from('scam_domains').delete().eq('source', 'amf').lt('last_seen', day())
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[scam-feeds] ${source} failed:`, message)
      report[source] = `error: ${message.slice(0, 120)}`
    }
  }
  const { error: purgeError } = await db.from('scam_domains').delete().lt('expires_on', day())
  if (purgeError) console.error('[scam-feeds] purge failed:', purgeError.message)
  return NextResponse.json({ ok: true, ...report })
}

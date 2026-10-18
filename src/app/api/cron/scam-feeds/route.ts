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
// - Consob (Italia): siti oscurati, dai comunicati stampa più recenti.
// - BaFin (Germania): avvisi su siti non autorizzati, dal feed RSS (solo i
//   domini nel titolo dell'avviso, scritti dalla BaFin come «nome(.)com»).
//   Di queste due si raccolgono gli avvisi nuovi: lo storico si accumula notte
//   dopo notte, e restano finché non si tolgono a mano.
// - IVASS (Italia): siti di assicurazioni abusivi. L'elenco storico in PDF
//   (fino al 2023) e i comunicati «L'IVASS ordina l'oscuramento» (PDF) delle
//   prime due pagine; la domenica (o con ?full=1) tutte, per lo storico.
// Se una fonte non risponde, le altre si caricano lo stesso.
// Poi i siti UFFICIALI in official_domains (segnale positivo in Speculum):
// - IVASS: imprese di assicurazione vigilate e siti degli intermediari
//   iscritti al RUI (PDF aggiornati ogni settimana). Chi esce dall'elenco esce.

export const dynamic = 'force-dynamic'
export const maxDuration = 300


type Row = { domain: string; source: ScamSource; category: string | null; listed_on: string | null; last_seen: string; expires_on: string | null }

const AMF_DATASET = 'https://www.data.gouv.fr/api/1/datasets/641d5dab1d84b530f7720b08/'
const PHISHDB = 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt'
const URLHAUS = 'https://urlhaus.abuse.ch/downloads/csv_online/'
const CONSOB_INDEX = 'https://www.consob.it/web/consob/comunicati-stampa'
const BAFIN_RSS = 'https://www.bafin.de/DE/service/rss/_function/rssnewsfeed.xml?nn=150166'
const IVASS_INDEX = 'https://www.ivass.it/cyber/siti-abusivi/index.html'
const IVASS_OLD_LIST = 'https://www.ivass.it/consumatori/proteggi/ELENCO_SITI_WEB_DI_INTERMEDIAZIONE_ASSICURATIVA_IRREGOLARI.pdf'
const IVASS_COMPANIES = 'https://www.ivass.it/consumatori/siti-imprese-intermediari/LISTA_SITI_COMPAGNIE_VIGILATE_DA_IVASS.pdf'
const IVASS_INTERMEDIARIES = 'https://www.ivass.it/consumatori/siti-imprese-intermediari/Lista_siti_internet_intermediari.pdf'
const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

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
  const lines = (await fetchText(csv.url)).replace(/^\uFEFF/, '').split(/\r?\n/).slice(1)
  const rows = new Map<string, Row>()
  for (const line of lines) {
    const [name, category, date] = line.split(';').map((v) => v.trim().replace(/^"|"$/g, ''))
    const domain = name ? normalizeDomain(name.replace(/^prénom\.nom@/i, '')) : null
    if (!domain || rows.has(domain)) continue
    rows.set(domain, { domain, source: 'amf', category: amfCategory(category ?? ''), listed_on: /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date : null, last_seen: day(), expires_on: null })
  }
  return [...rows.values()]
}

// Consob: nei comunicati «Consob oscura N siti» l'elenco sta tra «elenco dei
// siti» e «Sale, così» (il totale); la data è nel titolo del comunicato
async function loadConsob(): Promise<Row[]> {
  const index = await fetchText(CONSOB_INDEX, 30_000)
  const pages = [...new Set(index.match(/https:\/\/www\.consob\.it\/web\/area-pubblica\/w\/comunicato-stampa-del-[a-z0-9-]+/g) ?? [])]
  const rows = new Map<string, Row>()
  for (const page of pages.slice(0, 12)) {
    const text = (await fetchText(page, 30_000)).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
    if (!/oscuramento/i.test(text)) continue
    const start = text.search(/elenco dei siti/i)
    if (start < 0) continue
    const end = text.slice(start).search(/Sale, cos|complessivamente oscurati/i)
    const list = text.slice(start, end > 0 ? start + end : start + 8000)
    const when = text.match(/del (\d{1,2}) (gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre) (\d{4})/i)
    const listed = when ? `${when[3]}-${String(MONTHS_IT.indexOf(when[2].toLowerCase()) + 1).padStart(2, '0')}-${when[1].padStart(2, '0')}` : day()
    for (const m of list.matchAll(/(?:https?:\/\/|www\.)[^\s);,"]+/gi)) {
      const domain = normalizeDomain(m[0])
      if (!domain || domain.endsWith('consob.it') || rows.has(domain)) continue
      rows.set(domain, { domain, source: 'consob', category: 'unauthorised', listed_on: listed, last_seen: day(), expires_on: null })
    }
  }
  return [...rows.values()]
}

// BaFin: avvisi «unerlaubte» del feed; i domini sono nel titolo come «nome(.)com»
async function loadBafin(): Promise<Row[]> {
  const rows = new Map<string, Row>()
  for (const item of (await fetchText(BAFIN_RSS, 30_000)).split('<item>').slice(1)) {
    const link = item.match(/<link>([^<]*)<\/link>/)?.[1] ?? ''
    if (!/\/Verbrauchermitteilung\/unerlaubte\//.test(link)) continue
    const title = (item.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').replace(/&#160;|&nbsp;/g, ' ')
    const date = item.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1]
    const listed = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString().slice(0, 10) : day()
    const category = /identit|fake|gefälscht|falsch/i.test(title) ? 'impersonation' : 'unauthorised'
    for (const m of title.matchAll(/[a-z0-9-]+(?:\(\.\)[a-z0-9-]+)+/gi)) {
      const domain = normalizeDomain(m[0].replace(/\(\.\)/g, '.'))
      if (domain && !rows.has(domain)) rows.set(domain, { domain, source: 'bafin', category, listed_on: listed, last_seen: day(), expires_on: null })
    }
  }
  return [...rows.values()]
}

// Righe di testo di un PDF (pdfjs, senza worker)
async function pdfLines(url: string): Promise<string[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'KUMANI-scam-feeds/1.0 (+https://kumani.io)' } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()), disableFontFace: true, verbosity: 0 }).promise
  const lines: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    let line = ''
    for (const item of (await (await doc.getPage(i)).getTextContent()).items) {
      if (!('str' in item)) continue
      line += item.str + ' '
      if (item.hasEOL) {
        lines.push(line.trim())
        line = ''
      }
    }
    if (line.trim()) lines.push(line.trim())
  }
  await doc.cleanup()
  return lines
}

// IVASS: nell'elenco storico i domini hanno spazi in mezzo («alfa-broker. it»)
// e la data del comunicato accanto; nei comunicati nuovi sono le righe che
// iniziano con «-» («- www.rc.esempio.it e rc.esempio.it»).
async function loadIvass(full: boolean): Promise<Row[]> {
  const rows = new Map<string, Row>()
  const add = (raw: string, listed: string) => {
    const domain = normalizeDomain(raw.replace(/\s+/g, ''))
    if (domain && !domain.endsWith('ivass.it') && !rows.has(domain)) rows.set(domain, { domain, source: 'ivass', category: 'insurance', listed_on: listed, last_seen: day(), expires_on: null })
  }
  for (const line of await pdfLines(IVASS_OLD_LIST)) {
    const m = line.match(/^(https?:\/\/\S+(?:\s\S+)?)\s+(\d{2})\/(\d{2})\/(\d{4})/)
    if (m) add(m[1], `${m[4]}-${m[3]}-${m[2]}`)
  }
  const first = await fetchText(IVASS_INDEX, 30_000)
  const total = Number(first.match(/pagina 1 di (\d+)/i)?.[1] ?? 1)
  const pages = [first]
  for (let p = 2; p <= Math.min(total, full ? 30 : 2); p++) pages.push(await fetchText(`${IVASS_INDEX}?page=${p}`, 30_000))
  for (const html of pages) {
    for (const m of html.matchAll(/href="(\/media\/comunicati\/documenti\/\d{4}\/ivcs\d+\.pdf)\s*"[\s\S]{0,600}?(\d{1,2}) (gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre) (\d{4})/gi)) {
      const listed = `${m[4]}-${String(MONTHS_IT.indexOf(m[3].toLowerCase()) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`
      for (const line of await pdfLines(`https://www.ivass.it${m[1]}`)) {
        if (!/^-\s/.test(line)) continue
        for (const part of line.replace(/^-\s*/, '').split(/\s+-\s+|\s+e\s+/)) add(part, listed)
      }
    }
  }
  return [...rows.values()]
}

type OfficialRow = { domain: string; source: 'ivass_company' | 'ivass_intermediary'; name: string | null; last_seen: string }

// IVASS, siti ufficiali. Compagnie: «A495S  NOME  https://…» (il nome può
// andare a capo, quindi si legge il testo intero); intermediari: un indirizzo
// per riga (si saltano le email e i social, che non sono siti loro).
async function loadIvassOfficial(): Promise<OfficialRow[]> {
  const rows = new Map<string, OfficialRow>()
  const text = (await pdfLines(IVASS_COMPANIES)).join(' ')
  for (const m of text.matchAll(/\b[A-Z]\d{3}[A-Z]\s+(.+?)\s+(https?:\/\/\S+)/g)) {
    const domain = normalizeDomain(m[2])
    if (domain && !rows.has(domain)) rows.set(domain, { domain, source: 'ivass_company', name: m[1].replace(/\s+/g, ' ').trim(), last_seen: day() })
  }
  for (const line of await pdfLines(IVASS_INTERMEDIARIES)) {
    for (const token of line.split(/\s+/)) {
      if (!token.includes('.') || token.includes('@') || /^(aggiornat|lista)/i.test(token)) continue
      const domain = normalizeDomain(token)
      // I social in tutte le estensioni e sottodomini (linkedin.it, m.facebook.com…): pagine di chiunque
      if (!domain || /(^|\.)(whatsapp|linkedin|facebook|fb|instagram|twitter|tiktok|youtube|telegram|threads)\.[a-z]{2,3}(\.[a-z]{2})?$/.test(domain)) continue
      if (!rows.has(domain)) rows.set(domain, { domain, source: 'ivass_intermediary', name: null, last_seen: day() })
    }
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
  const params = new URL(request.url).searchParams
  // IVASS: tutte le pagine dei comunicati la domenica (o con ?full=1), le prime due le altre notti
  const full = params.get('full') === '1' || new Date().getUTCDay() === 0
  // Prova senza salvare: ?dry=1&only=ivass (conteggi e qualche esempio)
  const dry = params.get('dry') === '1'
  const only = params.get('only')
  for (const [source, load] of [['amf', loadAmf], ['consob', loadConsob], ['bafin', loadBafin], ['ivass', () => loadIvass(full)], ['phishdb', loadPhishDb], ['urlhaus', loadUrlhaus]] as const) {
    if (only && only !== source) continue
    try {
      const rows = await load()
      if (dry) {
        report[source] = `${rows.length}: ${rows.slice(0, 3).concat(rows.slice(-3)).map((r) => `${r.domain} ${r.listed_on ?? ''}`).join(', ')}`
        continue
      }
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
  if (!only || only === 'official') {
    try {
      const rows = await loadIvassOfficial()
      report.official = rows.length
      if (dry) {
        const companies = rows.filter((r) => r.source === 'ivass_company')
        report.official = `${companies.length} compagnie, ${rows.length - companies.length} intermediari: ${companies.slice(0, 3).map((r) => `${r.domain} (${r.name})`).join(', ')}`
      } else if (rows.length > 500 && rows.filter((r) => r.source === 'ivass_company').length >= 30) {
        // Solo con elenchi letti per intero (altrimenti si cancellerebbero siti buoni)
        for (let i = 0; i < rows.length; i += 5000) {
          const { error } = await db.from('official_domains').upsert(rows.slice(i, i + 5000), { onConflict: 'domain,source' })
          if (error) throw new Error(error.message)
        }
        // Chi non è più negli elenchi esce
        await db.from('official_domains').delete().lt('last_seen', day())
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[scam-feeds] official failed:', message)
      report.official = `error: ${message.slice(0, 120)}`
    }
  }
  if (dry) return NextResponse.json({ ok: true, dry: true, ...report })
  const { error: purgeError } = await db.from('scam_domains').delete().lt('expires_on', day())
  if (purgeError) console.error('[scam-feeds] purge failed:', purgeError.message)
  return NextResponse.json({ ok: true, ...report })
}

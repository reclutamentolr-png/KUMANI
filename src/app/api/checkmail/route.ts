import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { BRANDS, analyzeEmail, isOfficial, networkFindings, withFindings, type Finding, type Verdict } from '@/lib/checkmail/engine'
import { asksPassword, inspectLink, type LinkInspection } from '@/lib/linkInspect'
import { findScamDomain } from '@/lib/scamDomains'
import { webRiskLookup } from '@/lib/webRisk'
import { msgToEml } from '@/lib/checkmail/msg'
import { applyAiAssessment, assessWithAi, type AiAssessment } from '@/lib/checkmail/ai'
import { MissingApiKeyError } from '@/lib/anthropic'
import type { AiSkip, CheckMailResponse } from '@/lib/checkmail/types'
import { captureScamCard, cardForEmail } from '@/lib/scamCards/capture'

// KUMANI CheckMail: analisi di un'email sospetta (file .eml/.msg, sorgente
// incollato, oppure mittente + testo dal telefono). L'email è analizzata in
// memoria e NON viene salvata; nel database si conta solo quante analisi fa
// ciascuno al giorno. Se è configurata la chiave di Claude, il testo viene
// letto anche dall'IA (Anthropic) per le truffe senza segnali tecnici.

export const runtime = 'nodejs'
export const maxDuration = 45

// Vercel accetta richieste fino a circa 4,5 MB
const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_TEXT_CHARS = 400_000
const LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Link e mittente segnalati da Google (Web Risk) o negli elenchi di siti
// truffa (autorità, phishing, virus): un segnale grave basta per il rosso
async function blocklistFindings(summary: Verdict['summary']): Promise<Finding[]> {
  const sender = summary.fromAddress?.split('@')[1]?.toLowerCase() ?? ''
  const links = (summary.linkDomains ?? []).slice(0, 10)
  const domains = [...new Set([sender, ...links].filter(Boolean))]
  if (!domains.length) return []
  const db = service()
  const [google, listed] = await Promise.all([
    webRiskLookup([...(summary.linkUrls ?? []).slice(0, 6), ...links.slice(0, 6).map((d) => `https://${d}/`)]),
    Promise.all(domains.map((d) => findScamDomain(db, d))).then((r) => r.flat()),
  ])
  const found: Finding[] = []
  const flagged = google?.[0]
  if (flagged) found.push({ key: 'google_flagged', severity: 'high', points: 70, params: { domain: new URL(flagged.uri).hostname } })
  if (listed[0]) found.push({ key: 'scam_list', severity: 'high', points: 70, params: { domain: listed[0].domain } })
  return found
}

// I link dell'email si aprono dal server come farebbe chi la riceve: si
// seguono i rinvii fino al sito d'arrivo e si guarda la pagina. Un link a un
// dominio pulito può portare a una finta pagina di accesso su un altro sito
// (caso giuseppebello.com → finta Fineco, ottobre 2026). Mai i siti ufficiali
// dei marchi né i link per cancellarsi (aprirli potrebbe cancellare davvero).
const UNSUBSCRIBE_RE = /unsubscrib|opt-?out|disiscri|cancella(?:zione)?[-_]?iscri|desinscri|abmelden|darse-de-baja|preferences|preferenze/i
const MAX_INSPECTED = 4

async function inspectEmailLinks(summary: Verdict['summary']): Promise<LinkInspection[]> {
  const urls = (summary.linkUrls ?? [])
    .filter((u) => !UNSUBSCRIBE_RE.test(u))
    .filter((u) => {
      const host = new URL(u).hostname.toLowerCase()
      return !BRANDS.some((b) => isOfficial(host, b))
    })
  // Un link per sito (il primo), al massimo 4
  const seen = new Set<string>()
  const picked = urls.filter((u) => {
    const host = new URL(u).hostname.toLowerCase()
    return seen.has(host) ? false : (seen.add(host), true)
  }).slice(0, MAX_INSPECTED)
  const results = await Promise.all(picked.map((u) => inspectLink(u, 10_000).catch(() => null)))
  return results.filter((r): r is LinkInspection => !!r)
}

function inspectionFindings(inspected: LinkInspection[]): Finding[] {
  const found: Finding[] = []
  const phish = inspected.find((i) => i.phishingBrand)
  if (phish?.phishingBrand) {
    found.push({
      key: asksPassword(phish.html) ? 'phishing_page' : 'phishing_page_card',
      severity: 'high',
      points: 80,
      params: { brand: phish.phishingBrand.name, domain: phish.finalDomain, official: phish.phishingBrand.domains[0] },
    })
  }
  const moved = inspected.find((i) => i.redirected)
  if (moved) found.push({ key: 'link_redirects', severity: 'medium', points: 10, params: { from: moved.startDomain, to: moved.finalDomain } })
  return found
}

function reply(result: CheckMailResponse, status = 200) {
  return NextResponse.json(result, { status })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return reply({ status: 'not_allowed' }, 401)
  if (!(await hasActiveToolAccess(supabase, user.id, 'checkmail'))) return reply({ status: 'not_allowed' }, 403)

  // Lettura dell'input: file, sorgente incollato o mittente + testo
  let raw: string | ArrayBuffer = ''
  let sender = ''
  let subject = ''
  let text = ''
  let locale = 'it'
  try {
    const form = await request.formData()
    locale = LOCALES.includes(String(form.get('locale'))) ? String(form.get('locale')) : 'it'
    const file = form.get('file')
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) return reply({ status: 'too_large' })
      const bytes = await file.arrayBuffer()
      // .eml passato come byte: il parser rispetta la codifica dichiarata
      raw = file.name.toLowerCase().endsWith('.msg') ? msgToEml(bytes) : bytes
    } else {
      raw = String(form.get('raw') ?? '')
      sender = String(form.get('sender') ?? '').slice(0, 300)
      subject = String(form.get('subject') ?? '').slice(0, 500)
      text = String(form.get('text') ?? '')
    }
  } catch {
    return reply({ status: 'unreadable' })
  }
  // Il tetto in caratteri vale per il testo incollato; i file hanno quello in MB
  if ((typeof raw === 'string' && raw.length > MAX_TEXT_CHARS) || text.length > MAX_TEXT_CHARS) return reply({ status: 'too_large' })
  const hasRaw = typeof raw === 'string' ? raw.trim().length > 0 : raw.byteLength > 0
  if (!hasRaw && !text.trim()) return reply({ status: 'empty' })

  // Limite giornaliero
  const { data: reservation } = await supabase.rpc('checkmail_reserve')
  const reserved = reservation as { result?: string; left_today?: number } | null
  if (reserved?.result === 'not_allowed') return reply({ status: 'not_allowed' }, 403)
  if (reserved?.result === 'user_limit') return reply({ status: 'user_limit', leftToday: 0 })
  if (reserved?.result !== 'ok') return reply({ status: 'error' })
  const leftToday = reserved.left_today ?? 0

  try {
    // Prima i controlli tecnici (locali, rete, link); poi l'IA, ma solo nei
    // casi incerti: se i controlli hanno già trovato una truffa evidente, o il
    // mittente è verificato e non c'è nulla di sospetto, leggere il testo non
    // cambia il risultato e costa (src/lib/aiModels.ts)
    let verdict = await analyzeEmail(hasRaw ? { raw } : { text, sender, subject }, { network: false })
    const hasText = verdict.textSample.length > 20 || !!verdict.summary.subject
    // I controlli di rete valgono anche per i siti d'arrivo dei link
    const linkFindings = await inspectEmailLinks(verdict.summary)
      .catch(() => [] as LinkInspection[])
      .then(async (inspected) => {
        const finals = inspected.filter((i) => i.redirected)
        const summary: Verdict['summary'] = {
          ...verdict.summary,
          linkDomains: [...new Set([...finals.map((i) => i.finalDomain), ...verdict.summary.linkDomains])].slice(0, 10),
          linkUrls: [...new Set([...finals.map((i) => i.finalUrl), ...(verdict.summary.linkUrls ?? [])])].slice(0, 10),
        }
        const [net, list] = await Promise.all([networkFindings(summary).catch(() => []), blocklistFindings(summary).catch(() => [])])
        return [...inspectionFindings(inspected), ...net, ...list]
      })
    verdict = withFindings(verdict, linkFindings)

    const verifiedClean = verdict.summary.hasHeaders && verdict.findings.some((f) => f.key === 'auth_ok') && verdict.score === 0
    const aiSkipped: AiSkip | null = !hasText ? 'noText' : verdict.level === 'high' ? 'clearScam' : verifiedClean ? 'clearSafe' : null
    let aiAvailable = true
    let ai: AiAssessment | null = null
    if (!aiSkipped) {
      ai = await assessWithAi(verdict, locale).catch((error: unknown) => {
        // Un errore dell'IA non blocca il risultato dei controlli tecnici
        aiAvailable = false
        if (!(error instanceof MissingApiKeyError)) console.error('[checkmail] AI error:', error instanceof Error ? error.message : 'unknown')
        return null
      })
    }
    if (ai) verdict = applyAiAssessment(verdict, ai)

    await awardToolPoint('checkmail')
    // Carte Antitruffa: un'email truffa fermata cattura la carta di quella truffa
    const scamCard =
      verdict.level === 'high'
        ? await captureScamCard(user.id, cardForEmail(`${verdict.summary.subject ?? ''}\n${verdict.textSample}`, verdict.findings, ai?.category), 'checkmail')
        : null
    return reply({
      status: 'ok',
      score: verdict.score,
      level: verdict.level,
      findings: verdict.findings,
      ai,
      aiAvailable,
      aiSkipped,
      hasHeaders: verdict.summary.hasHeaders,
      leftToday,
      community: { sender: verdict.summary.fromAddress ?? null, domains: (verdict.summary.linkDomains ?? []).slice(0, 10) },
      scamCard,
    })
  } catch (error) {
    console.error('[checkmail] analysis failed:', error instanceof Error ? error.message : 'unknown')
    // Analisi non riuscita per un errore tecnico: si restituisce il controllo
    await service().rpc('checkmail_refund', { p_user: user.id })
    return reply({ status: 'unreadable', leftToday: leftToday + 1 })
  }
}

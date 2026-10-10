import { NextRequest, NextResponse } from 'next/server'
import { safeFetch } from '@/lib/safeFetch'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { fetchWhoisText, parseWhois } from '@/lib/whois'
import { parseVatInput, prettyVat, registryLookupUrl, verifyVies } from '@/lib/vat'

interface SVATCheck {
  id: string
  name: string
  status: 'ok' | 'warning' | 'risk' | 'check'
  points: number
  details: string
  detailsKey?: string
  source?: string
  sourceUrl?: string
  detailsInterp?: Record<string, string>
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Piano e interruttore Admin (SVAT spento = niente verifiche, anche via API)
  if (!(await hasActiveToolAccess(supabase, user.id, 'svat'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { input?: unknown; mode?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Input required' }, { status: 400 })
  }
  const input = typeof body.input === 'string' ? body.input.trim() : ''
  // Due ricerche separate: 'website' (solo sito) o 'vat' (solo partita IVA).
  // Senza mode si indovina dall'input, come prima.
  const mode: 'website' | 'vat' | 'auto' = body.mode === 'vat' || body.mode === 'website' ? body.mode : 'auto'
  if (!input) {
    return NextResponse.json({ error: 'Input required' }, { status: 400 })
  }
  // Un indirizzo o una partita IVA, non un testo intero
  if (input.length > 300) {
    return NextResponse.json({ error: 'invalidUrl' }, { status: 400 })
  }

  const checks: SVATCheck[] = []

  // Partita IVA (es. IT12345678901 o 11 cifre): controlli sull'azienda
  const vat = mode === 'website' ? null : mode === 'vat' ? (parseVatInput(input) ?? { ok: false as const, reason: 'format' as const }) : parseVatInput(input)
  if (vat) {
    checks.push(...(await checkCompany(vat)))
  }

  const looksLikeURL = input.startsWith('http') || input.startsWith('www.') || input.includes('.')
  if (mode === 'website' && !looksLikeURL) {
    return NextResponse.json({ error: 'invalidUrl' }, { status: 400 })
  }
  const isURL = !vat && looksLikeURL
  // Senza «https://» i controlli sul sito non partivano (amazon.it 85, https://amazon.it 41):
  // l'indirizzo si completa sempre e il dominio si ricava da lì
  let url = input
  let domain = input
  if (isURL) {
    url = /^https?:\/\//i.test(input) ? input : `https://${input}`
    try {
      domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
      return NextResponse.json({ error: 'invalidUrl' }, { status: 400 })
    }
  }

  if (isURL) {
    // Shared lookups: WHOIS (checkWHOIS + checkDomainAge) and the homepage
    // HTML (checkContentScraping + checkLegalPages + checkReviews +
    // checkBusinessModel) are each fetched ONCE and reused, instead of
    // every check re-fetching the same data independently. This halves the
    // number of requests hitting the target site, lowering the odds that a
    // WAF/rate-limiter blocks some of them (which used to cost legitimate,
    // well-protected sites points for no fraud-related reason).
    const whoisTextPromise = fetchWhoisText(domain)
    const pagePromise = fetchPageHtml(url)

    // Run all checks in parallel
    const results = await Promise.allSettled([
      checkWHOIS(domain, whoisTextPromise),
      checkDomainAge(domain, whoisTextPromise),
      checkSPF(domain),
      checkDMARC(domain),
      checkMX(domain),
      checkPTR(domain),
      checkHTTPHeaders(url),
      checkSSL(url, domain),
      checkAbuseIPDB(domain),
      checkContentScraping(pagePromise),
      checkLegalPages(pagePromise),
      checkReviews(pagePromise),
      checkBusinessModel(pagePromise),
    ])

    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) {
        checks.push(r.value)
      }
    })
  }

  // Calculate score (start at 50 neutral)
  let score = 50

  for (const r of checks) {
    if (r.status === 'ok') {
      score += r.points > 0 ? r.points : 5
    } else if (r.status === 'warning') {
      score -= Math.abs(r.points)
    } else if (r.status === 'risk') {
      score -= Math.abs(r.points)
    }
  }

  score = Math.max(0, Math.min(100, score))

  let badge: 'green' | 'yellow' | 'red' = 'green'
  if (score < 40) badge = 'red'
  else if (score < 80) badge = 'yellow'

  return NextResponse.json({
    input,
    domain,
    score,
    badge,
    checks,
    summary: {
      totalChecks: checks.length,
      okCount: checks.filter((r) => r.status === 'ok').length,
      warningCount: checks.filter((r) => r.status === 'warning').length,
      riskCount: checks.filter((r) => r.status === 'risk').length,
      checkCount: checks.filter((r) => r.status === 'check').length,
    },
  })
}

// 1. WHOIS lookup — dati di registrazione dominio, titolare, registrar.
// Queries the registry's authoritative WHOIS server directly (see src/lib/whois.ts)
// instead of a third-party HTTP proxy, so it works even when such proxies go down.
async function checkWHOIS(domain: string, whoisTextPromise: Promise<string | null>): Promise<SVATCheck | null> {
  try {
    const data = await whoisTextPromise
    if (!data) return null

    const { hasPrivacy, registrantOrg, registrar, creationDate, expiryDate } = parseWhois(data)

    if (hasPrivacy) {
      return {
        id: 'whois',
        name: 'checkWHOIS',
        status: 'warning',
        points: -10,
        details: 'whoisPrivacy',
        detailsKey: 'whoisPrivacy',
        source: 'WHOIS',
        sourceUrl: `https://who.is/whois/${domain}`,
      }
    }

    let details = 'whoisNoPrivacy'
    if (registrantOrg) details += ` | Org: ${registrantOrg}`
    if (registrar) details += ` | Registrar: ${registrar}`
    if (creationDate) details += ` | Created: ${creationDate}`

    if (!expiryDate) {
      return {
        id: 'whois',
        name: 'checkWHOIS',
        status: 'warning',
        points: -5,
        details: details + ' | Expiration date not found in WHOIS',
        detailsKey: 'whoisIncomplete',
        source: 'WHOIS',
        sourceUrl: `https://who.is/whois/${domain}`,
      }
    }

    return {
      id: 'whois',
      name: 'checkWHOIS',
      status: 'ok',
      points: 8,
      details,
      detailsKey: 'whoisNoPrivacy',
      source: 'WHOIS',
      sourceUrl: `https://who.is/whois/${domain}`,
    }
  } catch {
    return null
  }
}

// 2. Età del dominio — data di creazione dal WHOIS (stessa lookup di checkWHOIS, condivisa)
async function checkDomainAge(domain: string, whoisTextPromise: Promise<string | null>): Promise<SVATCheck | null> {
  try {
    const data = await whoisTextPromise
    if (!data) return null

    const { creationDate } = parseWhois(data)
    if (!creationDate) return null

    const created = new Date(creationDate)
    if (isNaN(created.getTime())) return null

    const diffDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 30) {
      return {
        id: 'domainAge',
        name: 'checkDomainAge',
        status: 'risk',
        points: -25,
        details: `Domain registered ${diffDays} days ago`,
        detailsKey: 'newDomain',
        source: 'WHOIS',
      }
    }

    const years = Math.floor(diffDays / 365)
    const days = diffDays % 365

    return {
      id: 'domainAge',
      name: 'checkDomainAge',
      status: 'ok',
      points: 12,
      details: `Domain registered ${years} year(s), ${days} day(s) ago`,
      detailsKey: years > 0 ? 'domainAgeYears' : 'domainAgeDays',
      detailsInterp: years > 0
        ? { years: String(years), days: String(days) }
        : { days: String(diffDays) },
      source: 'WHOIS',
      sourceUrl: `https://who.is/whois/${domain}`,
    }
  } catch {
    return null
  }
}

// 3. DNS – record SPF — verifica autorizzazione server email
// Una risposta DNS di dns.google (i nomi dei campi cambiano maiuscole a
// seconda del tipo di record)
type DnsAnswer = { name?: string; type?: number; Type?: number; TTL?: number; data?: string; Data?: string }

async function checkSPF(domain: string): Promise<SVATCheck | null> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null

    const data = await res.json()
    const txtRecords: string[] = (data.Answer || []).map((a: DnsAnswer) => a.data || a.Data || '')

    const spfRecord = txtRecords.find((r) => r.toLowerCase().includes('v=spf1'))
    const hasSPF = !!spfRecord

    if (!hasSPF) {
      return {
        id: 'spf',
        name: 'checkSPF',
        status: 'warning',
        points: -8,
        details: 'SPF record not found — email spoofing risk',
        detailsKey: 'dnsRecordsMissing',
        source: 'Google DNS',
        sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`,
      }
    }

    return {
      id: 'spf',
      name: 'checkSPF',
      status: 'ok',
      points: 10,
      details: `SPF configured: ${spfRecord}`,
      detailsKey: 'dnsRecordsFound',
      detailsInterp: { records: 'SPF' },
      source: 'Google DNS',
      sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`,
    }
  } catch {
    return null
  }
}

// 4. DNS – record DMARC
async function checkDMARC(domain: string): Promise<SVATCheck | null> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=_dmarc.${encodeURIComponent(domain)}&type=TXT`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null

    const data = await res.json()
    const txtRecords: string[] = (data.Answer || []).map((a: DnsAnswer) => a.data || a.Data || '')

    const dmarcRecord = txtRecords.find((r) => r.toLowerCase().includes('dmarc'))
    const hasDMARC = !!dmarcRecord

    if (!hasDMARC) {
      return {
        id: 'dmarc',
        name: 'checkDMARC',
        status: 'warning',
        points: -8,
        details: 'DMARC record not found — phishing protection missing',
        detailsKey: 'dnsRecordsMissing',
        source: 'Google DNS',
        sourceUrl: `https://dns.google/resolve?name=_dmarc.${encodeURIComponent(domain)}&type=TXT`,
      }
    }

    // Check policy (none, quarantine, reject)
    const hasReject = /p=reject/i.test(dmarcRecord)
    const hasQuarantine = /p=quarantine/i.test(dmarcRecord)

    const points = hasReject ? 12 : hasQuarantine ? 8 : 5
    const policy = hasReject ? 'reject' : hasQuarantine ? 'quarantine' : dmarcRecord.match(/p=(\w+)/i)?.[1] || 'unknown'

    return {
      id: 'dmarc',
      name: 'checkDMARC',
      status: 'ok',
      points,
      details: `DMARC configured: policy=${policy}`,
      detailsKey: 'dnsRecordsFound',
      detailsInterp: { records: `DMARC (${policy})` },
      source: 'Google DNS',
      sourceUrl: `https://dns.google/resolve?name=_dmarc.${encodeURIComponent(domain)}&type=TXT`,
    }
  } catch {
    return null
  }
}

// 5. DNS – record MX
async function checkMX(domain: string): Promise<SVATCheck | null> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null

    const data = await res.json()
    const mxRecords: DnsAnswer[] = data.Answer || []

    if (mxRecords.length === 0) {
      return {
        id: 'mx',
        name: 'checkMX',
        status: 'warning',
        points: -5,
        details: 'No MX records found — email not properly routed',
        detailsKey: 'noMX',
        source: 'Google DNS',
        sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      }
    }

    const mxHosts = mxRecords.map((r) => r.data || r.Data || '').join(', ')

    return {
      id: 'mx',
      name: 'checkMX',
      status: 'ok',
      points: 5,
      details: `MX records: ${mxHosts}`,
      detailsKey: 'mxFound',
      source: 'Google DNS',
      sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
    }
  } catch {
    return null
  }
}

// 6. Header HTTP/SSL — risposta del server, tipo di hosting
async function checkHTTPHeaders(url: string): Promise<SVATCheck | null> {
  try {
    const res = await safeFetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'SVAT-Checker/1.0 (anti-fraud verification)',
      },
      redirect: 'follow',
      next: { revalidate: 3600 },
    })

    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })

    const server = headers['server'] || ''
    const poweredBy = headers['x-powered-by'] || ''
    const contentType = headers['content-type'] || ''
    let hosting = ''

    if (server) hosting += `Server: ${server}`
    if (poweredBy) hosting += ` | Powered-by: ${poweredBy}`
    if (contentType) hosting += ` | Content-Type: ${contentType}`

    // HSTS is treated separately from the "advisory" headers below: it's
    // the one that actually relates to trust (it forces encrypted
    // connections). CSP/X-Frame-Options/X-Content-Type-Options are hardening
    // best-practices most small/medium legitimate business sites never set —
    // they signal engineering maturity, not fraud risk, so they no longer
    // carry a real penalty on their own.
    const hasHSTS = !!headers['strict-transport-security']
    const hasXFrame = !!headers['x-frame-options']
    const hasXCT = !!headers['x-content-type-options']
    const hasCSP = !!headers['content-security-policy']

    const missingAdvisory: string[] = []
    if (!hasXFrame) missingAdvisory.push('X-Frame-Options')
    if (!hasXCT) missingAdvisory.push('X-Content-Type-Options')
    if (!hasCSP) missingAdvisory.push('CSP')

    if (!hasHSTS) {
      return {
        id: 'httpHeaders',
        name: 'checkHTTPHeaders',
        status: 'warning',
        points: -5,
        details: `HSTS missing — connections aren't forced to stay encrypted. ${hosting}`,
        detailsKey: 'missingHeaders',
        source: 'HTTP response analysis',
        sourceUrl: url,
      }
    }

    if (missingAdvisory.length > 0) {
      return {
        id: 'httpHeaders',
        name: 'checkHTTPHeaders',
        status: 'ok',
        points: 4,
        details: `HSTS ✓ | Advanced headers not set (best practice, not a fraud signal): ${missingAdvisory.join(', ')}. ${hosting}`,
        detailsKey: 'headersOK',
        source: 'HTTP response analysis',
        sourceUrl: url,
      }
    }

    return {
      id: 'httpHeaders',
      name: 'checkHTTPHeaders',
      status: 'ok',
      points: 8,
      details: `${hosting} | Security headers: HSTS ✓ CSP ✓ X-Frame-Options ✓ X-Content-Type-Options ✓`,
      detailsKey: 'headersOK',
      source: 'HTTP response analysis',
      sourceUrl: url,
    }
  } catch {
    return null
  }
}

// SSL certificate check (via HTTP)
async function checkSSL(url: string, domain: string): Promise<SVATCheck | null> {
  try {
    const res = await safeFetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SVAT-SSL-Checker/1.0',
      },
      redirect: 'follow',
      next: { revalidate: 3600 },
    })

    if (!res.ok && res.status !== 301 && res.status !== 302) {
      return {
        id: 'ssl',
        name: 'checkSSL',
        status: 'warning',
        points: -5,
        details: `HTTP error: ${res.status}`,
        detailsKey: 'sslInvalid',
        source: 'TLS connection check',
      }
    }

    // Check if HTTPS was used
    const isHTTPS = url.startsWith('https://') || res.url?.startsWith('https://')

    if (!isHTTPS) {
      return {
        id: 'ssl',
        name: 'checkSSL',
        status: 'risk',
        points: -20,
        details: 'Site does not use HTTPS — connection not encrypted',
        detailsKey: 'sslInvalid',
        source: 'TLS connection check',
        sourceUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${domain}`,
      }
    }

    // Try to get certificate info from SSL Labs
    const certRes = await fetch(`https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(domain)}&publish=off&all=done`, {
      next: { revalidate: 3600 },
    })

    if (certRes.ok) {
      const certData = await certRes.json()
      if (certData.status === 'READY' && certData.endpoints && certData.endpoints.length > 0) {
        const endpoint = certData.endpoints[0]
        const grade = endpoint.grade
        const issues = endpoint.issues || []

        // Check for expiring certificate (within 30 days)
        const certIssues = issues as Array<{ message?: string }>
        const hasExpiringCert = certIssues.some(
          (i) => i.message && (i.message.includes('expiring') || i.message.includes('EXPiring'))
        )

        // Extract certificate issuer and validity
        let certDetails = `SSL Labs grade: ${grade}`
        if (certData.endpoints[0].details?.certChains?.[0]?.certs?.[0]) {
          const cert = certData.endpoints[0].details.certChains[0].certs[0]
          const issuer = cert.issuerLabel || cert.issuer?.commonName || ''
          const notAfter = cert.notAfter || cert.validTo || ''
          if (issuer) certDetails += ` | Issuer: ${issuer}`
          if (notAfter) certDetails += ` | Expires: ${new Date(notAfter).toLocaleDateString()}`
        }

        if (grade && ['A', 'A+', 'A-', 'B', 'C'].includes(grade)) {
          if (hasExpiringCert) {
            return {
              id: 'ssl',
              name: 'checkSSL',
              status: 'warning',
              points: -3,
              details: `${certDetails} | Certificate expiring soon`,
              detailsKey: 'sslExpiring',
              source: 'SSL Labs API',
              sourceUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${domain}`,
            }
          }
          return {
            id: 'ssl',
            name: 'checkSSL',
            status: 'ok',
            points: 15,
            details: certDetails,
            detailsKey: 'sslValid',
            detailsInterp: { issuer: certDetails.split(' | ')[1]?.replace('Issuer: ', '') || 'unknown' },
            source: 'SSL Labs API',
            sourceUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${domain}`,
          }
        } else if (grade) {
          return {
            id: 'ssl',
            name: 'checkSSL',
            status: 'warning',
            points: -8,
            details: certDetails,
            detailsKey: 'sslInvalid',
            source: 'SSL Labs API',
            sourceUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${domain}`,
          }
        }
      }

      // SSL Labs still in progress — check certificate directly
      if (certData.status === 'IN_PROGRESS' || certData.status === 'DNS') {
        return {
          id: 'ssl',
          name: 'checkSSL',
          status: 'check',
          points: 0,
          details: 'SSL test in progress',
          source: 'SSL Labs API',
        }
      }
    }

    // Fallback: use another SSL API to get certificate details
    try {
      const sslInfoRes = await fetch(`https://ssl-checker-api.vercel.app/api/check?domain=${encodeURIComponent(domain)}`, {
        next: { revalidate: 3600 },
      })
      if (sslInfoRes.ok) {
        const sslInfo = await sslInfoRes.json()
        const issuer = sslInfo.issuer || ''
        const validTo = sslInfo.validTo || sslInfo.notAfter || ''

        let details = 'HTTPS connection verified'
        if (issuer) details += ` | Issuer: ${issuer}`
        if (validTo) {
          details += ` | Expires: ${new Date(validTo).toLocaleDateString()}`
          // Check if expiring within 30 days
          const expiryDate = new Date(validTo)
          const daysLeft = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          if (daysLeft < 30) {
            return {
              id: 'ssl',
              name: 'checkSSL',
              status: 'warning',
              points: -5,
              details: `${details} | Certificate expires in ${daysLeft} days`,
              detailsKey: 'sslExpiring',
              source: 'SSL API',
              sourceUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${domain}`,
            }
          }
        }

        return {
          id: 'ssl',
          name: 'checkSSL',
          status: 'ok',
          points: 10,
          details,
          detailsKey: 'sslValid',
          detailsInterp: { issuer: issuer || 'unknown' },
          source: 'SSL API',
          sourceUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${domain}`,
        }
      }
    } catch {
      // SSL checker API failed, fall back to minimal check
    }

    // Ultimate fallback: HTTPS is used
    return {
      id: 'ssl',
      name: 'checkSSL',
      status: 'ok',
      points: 8,
      details: 'HTTPS connection verified',
      detailsKey: 'sslValid',
      source: 'TLS connection check',
      sourceUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${domain}`,
    }
  } catch {
    return null
  }
}

// Shared homepage fetch used by checkContentScraping, checkLegalPages,
// checkReviews and checkBusinessModel. These used to each independently
// re-fetch the exact same page (4 parallel GET requests), which wasted
// bandwidth and made it more likely that a target site's WAF/rate-limiter
// would block one of the near-simultaneous requests — costing legitimate,
// well-protected sites points for reasons unrelated to fraud risk.
interface FetchedPage {
  html: string
  status: number
  // Pagina leggibile: risposta 2xx con testo vero. Molti siti seri bloccano i
  // programmi o costruiscono la pagina in JavaScript: senza testo non si può
  // giudicare (prima finivano «possibile truffa», es. Amazon 41).
  readable: boolean
}

function pageText(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchPageHtml(url: string): Promise<FetchedPage | null> {
  try {
    const res = await safeFetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SVAT-Checker/1.0',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 3600 },
    })
    // Basta l'inizio della pagina (niente pagine giganti in memoria)
    const html = (await res.text()).slice(0, 2_000_000)
    const ok = res.status >= 200 && res.status < 300
    return { html, status: res.status, readable: ok && pageText(html).length >= 200 }
  } catch {
    return null
  }
}

// 7. Scraping contenuto pagina
async function checkContentScraping(pagePromise: Promise<FetchedPage | null>): Promise<SVATCheck | null> {
  const page = await pagePromise
  if (!page) return null

  // Pagina non leggibile (bloccata ai programmi o fatta in JavaScript): da
  // verificare a mano, senza togliere punti
  if (!page.readable) {
    return {
      id: 'contentScraping',
      name: 'checkContentScraping',
      status: 'check',
      points: 0,
      details: `Could not read the page content (HTTP ${page.status})`,
      detailsKey: 'contentFetchError',
      source: 'Page scrape',
    }
  }

  const html = page.html
  const textLength = pageText(html).length
  const hasH1 = /<h1[^>]*>([^<]+)<\/h1>/i.test(html)
  const hasH2 = /<h2[^>]*>([^<]+)<\/h2>/i.test(html)

  let contentDetails = `Content length: ${textLength} chars`
  if (hasH1) contentDetails += ' | H1 present ✓'
  else contentDetails += ' | H1 missing ✗'
  if (hasH2) contentDetails += ' | H2 headings present ✓'

  return {
    id: 'contentScraping',
    name: 'checkContentScraping',
    status: 'ok',
    points: 10,
    details: contentDetails,
    detailsKey: 'contentOK',
    source: 'Page scrape',
  }
}

// 8. Analisi struttura link/footer — pagine legali
async function checkLegalPages(pagePromise: Promise<FetchedPage | null>): Promise<SVATCheck | null> {
  const page = await pagePromise
  if (!page || !page.readable) return null

  const html = page.html.toLowerCase()

  const checks = {
    privacy: html.includes('privacy') || html.includes('informativa'),
    terms: html.includes('termini') || html.includes('terms'),
    contacts: html.includes('contatt') || html.includes('contact'),
    address: /\b(via|strada|corso|piazza|piazzale)\s+[a-z]/i.test(html) ||
      /c\.f\.|codice\s*fiscale/i.test(html) ||
      /\b[a-z]{2}\s*\d{5}\b/i.test(html),
    vat: /partita\s*iva/i.test(html) || /p\.iva/i.test(html),
    social: html.includes('facebook') || html.includes('instagram') || html.includes('linkedin') || html.includes('twitter'),
  }

  const found = Object.entries(checks).filter(([, v]) => v).map(([k]) => k)
  const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k)

  if (missing.length >= 4) {
    return {
      id: 'legalPages',
      name: 'checkLegalPages',
      status: 'risk',
      points: -20,
      details: `Missing legal pages: ${missing.join(', ')}. Found: ${found.join(', ') || 'none'}`,
      detailsKey: 'contentMissingPrivacy',
      source: 'Footer/page analysis',
    }
  }

  if (missing.length > 0) {
    return {
      id: 'legalPages',
      name: 'checkLegalPages',
      status: 'warning',
      points: -8,
      details: `Missing: ${missing.join(', ')}. Found: ${found.join(', ')}`,
      detailsKey: missing.includes('privacy') ? 'contentMissingPrivacy' : 'contentMissingAddress',
      source: 'Footer/page analysis',
    }
  }

  return {
    id: 'legalPages',
    name: 'checkLegalPages',
    status: 'ok',
    points: 12,
    details: `All legal pages present: ${found.join(', ')}`,
    detailsKey: 'legalPagesOK',
    source: 'Footer/page analysis',
  }
}

// 9. Valutazione recensioni/testimonianze
async function checkReviews(pagePromise: Promise<FetchedPage | null>): Promise<SVATCheck | null> {
  const page = await pagePromise
  if (!page || !page.readable) return null

  const html = page.html.toLowerCase()

  // Detect review-related content
  const hasTestimonial = html.includes('testimonial') || html.includes('testimonianza')
  const hasReview = html.includes('recensione') || html.includes('review')
  const hasRating = /rating|valutazione|stella|star/i.test(html)
  const hasReviewSchema = html.includes('schema.org/review') || html.includes('"review"')
  const reviewCount = (html.match(/recensione/gi) || []).length + (html.match(/testimonial/gi) || []).length

  if (!hasTestimonial && !hasReview && !hasRating) {
    return {
      id: 'reviews',
      name: 'checkReviews',
      status: 'warning',
      points: -5,
      details: 'No review/testimonial section found on page',
      detailsKey: 'noReviews',
      source: 'Content analysis',
    }
  }

  // Any review/testimonial signal at all, however weak, is now treated as a
  // (smaller or larger) positive instead of a penalty: a single testimonials
  // section is common on legitimate small-business sites and isn't itself a
  // red flag — only a complete absence of any such signal is.
  const strongSignal = reviewCount >= 2 || hasReviewSchema

  return {
    id: 'reviews',
    name: 'checkReviews',
    status: 'ok',
    points: strongSignal ? 5 : 3,
    details: `Found ${reviewCount + (hasReview ? 1 : 0)} review references, schema: ${hasReviewSchema ? 'yes' : 'no'}`,
    detailsKey: 'reviewsOK',
    source: 'Content analysis',
  }
}

// 10. Valutazione del modello di business
async function checkBusinessModel(pagePromise: Promise<FetchedPage | null>): Promise<SVATCheck | null> {
  const page = await pagePromise
  if (!page || !page.readable) return null

  const html = page.html.toLowerCase()

  // Detect business model indicators
  const hasMLM = /network\s*marketing|mlm|referral|affiliate|compensa.*team/i.test(html)
  const hasEcommerce = /shop|cart|checkout|buy now|acquista|negozio/i.test(html)
  const hasConsulting = /consulen|coach|servizio|soluzione/i.test(html)
  const hasSubscription = /abbonamento|subscription|membership|recurring/i.test(html)

  let model = 'unknown'
  let riskLevel: 'ok' | 'warning' = 'ok'
  let details = ''

  if (hasEcommerce) {
    model = 'e-commerce'
    details = 'E-commerce business model detected'
  } else if (hasMLM) {
    model = 'mlm'
    riskLevel = 'warning'
    details = 'Network marketing / MLM model detected — higher risk due to recruitment-based structure'
    model = 'e-commerce'
  } else if (hasConsulting) {
    model = 'consulting'
    details = 'Consulting/services business model detected'
  } else if (hasSubscription) {
    model = 'subscription'
    details = 'Subscription/recurring model detected'
  } else {
    model = 'unknown'
    riskLevel = 'warning'
    details = 'Business model unclear — no clear revenue model indicators found'
  }

  return {
    id: 'businessModel',
    name: 'checkBusinessModel',
    status: riskLevel,
    points: riskLevel === 'warning' ? -8 : 10,
    details,
    detailsKey: model === 'mlm' ? 'businessModelMLM' : model === 'unknown' ? 'businessModelUnknown' : 'businessModelOK',
    detailsInterp: { model },
    source: 'Content analysis',
  }
}

// 5b. DNS – PTR record (reverse DNS) — verifica PTR record per l'IP del dominio
async function checkPTR(domain: string): Promise<SVATCheck | null> {
  try {
    // Get A record first
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null

    const data = await res.json()
    const answers = data.Answer || []
    const ipRecords = answers.filter((a: DnsAnswer) => a.Type === 1 || a.type === 1)

    if (ipRecords.length === 0) {
      return {
        id: 'ptr',
        name: 'checkPTR',
        status: 'warning',
        points: -3,
        details: 'No A record found — cannot check PTR',
        detailsKey: 'noPTR',
        source: 'DNS analysis',
      }
    }

    const ip = ipRecords[0].data || ipRecords[0].Data
    if (!ip) return null

    // Query PTR record for the IP
    const reversedIp = ip.split('.').reverse().join('.')
    const ptrRes = await fetch(`https://dns.google/resolve?name=${reversedIp}.in-addr.arpa&type=PTR`, {
      next: { revalidate: 3600 },
    })

    if (!ptrRes.ok) {
      return {
        id: 'ptr',
        name: 'checkPTR',
        status: 'warning',
        points: -3,
        details: `PTR query failed for IP ${ip}`,
        detailsKey: 'ptrFailed',
        source: 'DNS analysis',
      }
    }

    const ptrData = await ptrRes.json()
    const ptrAnswer = ptrData.Answer?.[0]?.data || ptrData.Answer?.[0]?.Data

    if (ptrAnswer && ptrAnswer.toLowerCase().includes(domain.replace(/\.$/, ''))) {
      return {
        id: 'ptr',
        name: 'checkPTR',
        status: 'ok',
        points: 8,
        details: `PTR record (${ip}) resolves to ${ptrAnswer}`,
        detailsKey: 'ptrOK',
        source: 'DNS analysis',
        sourceUrl: `https://dns.google/resolve?name=${reversedIp}.in-addr.arpa&type=PTR`,
      }
    }

    if (ptrAnswer) {
      return {
        id: 'ptr',
        name: 'checkPTR',
        status: 'warning',
        points: -5,
        details: `PTR record (${ip}) resolves to ${ptrAnswer} — does not match domain ${domain}`,
        detailsKey: 'ptrMismatch',
        source: 'DNS analysis',
        sourceUrl: `https://dns.google/resolve?name=${reversedIp}.in-addr.arpa&type=PTR`,
      }
    }

    return {
      id: 'ptr',
      name: 'checkPTR',
      status: 'warning',
      points: -5,
      details: `No PTR record found for IP ${ip}`,
      detailsKey: 'noPTR',
      source: 'DNS analysis',
    }
  } catch {
    return null
  }
}

// 5c. AbuseIPDB — ricerca segnalazioni di abusi per l'IP del dominio
async function checkAbuseIPDB(domain: string): Promise<SVATCheck | null> {
  try {
    const apiKey = process.env.ABUSEIPDB_API_KEY
    if (!apiKey) return null

    // Get A record first
    const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`, {
      next: { revalidate: 3600 },
    })
    if (!dnsRes.ok) return null

    const dnsData = await dnsRes.json().catch(() => null)
    const ip = dnsData?.Answer?.[0]?.data || dnsData?.Answer?.[0]?.Data
    if (!ip) return null

    const res = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`, {
      headers: {
        'Key': apiKey,
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return null

    const data = await res.json()
    const abuseCount = data.data?.totalReports || 0
    const fraudScore = data.data?.abuseConfidenceScore || 0

    if (abuseCount > 5 || fraudScore > 50) {
      return {
        id: 'abuseIPDB',
        name: 'checkAbuseIPDB',
        status: 'risk',
        points: -20,
        details: `IP ${ip}: ${abuseCount} reports, fraud score: ${fraudScore}/100`,
        detailsKey: 'blacklisted',
        source: 'AbuseIPDB',
        sourceUrl: `https://www.abuseipdb.com/check/${ip}`,
      }
    }

    if (abuseCount > 0 || fraudScore > 10) {
      return {
        id: 'abuseIPDB',
        name: 'checkAbuseIPDB',
        status: 'warning',
        points: -8,
        details: `IP ${ip}: ${abuseCount} reports, fraud score: ${fraudScore}/100`,
        detailsKey: 'abuseIPDBWarning',
        source: 'AbuseIPDB',
        sourceUrl: `https://www.abuseipdb.com/check/${ip}`,
      }
    }

    return {
      id: 'abuseIPDB',
      name: 'checkAbuseIPDB',
      status: 'ok',
      points: 5,
      details: `IP ${ip}: no abuse reports, fraud score: ${fraudScore}/100`,
      detailsKey: 'notBlacklisted',
      source: 'AbuseIPDB',
      sourceUrl: `https://www.abuseipdb.com/check/${ip}`,
    }
  } catch {
    return null
  }
}

// Verifica azienda da partita IVA: formato e cifra di controllo, VIES
// (Commissione Europea: stato, ragione sociale, indirizzo) e rimando alla
// scheda su Ufficio Camerale per sede, ATECO e stato (solo Italia, manuale).
async function checkCompany(vat: NonNullable<ReturnType<typeof parseVatInput>>): Promise<SVATCheck[]> {
  if (!vat.ok) {
    return [{
      id: 'vatFormat',
      name: 'checkVatFormat',
      status: 'risk',
      points: -45,
      details: vat.reason === 'checksum' ? 'Cifra di controllo errata' : 'Formato non valido',
      detailsKey: vat.reason === 'checksum' ? 'vatChecksumInvalid' : 'vatFormatInvalid',
    }]
  }
  const shown = prettyVat(vat.normalized)
  const checks: SVATCheck[] = [{
    id: 'vatFormat',
    name: 'checkVatFormat',
    status: 'ok',
    points: 5,
    details: shown,
    detailsKey: 'vatFormatOk',
    detailsInterp: { vat: shown },
  }]

  const vies = await verifyVies(vat.normalized)
  const viesSource = { source: 'VIES - European Commission', sourceUrl: 'https://ec.europa.eu/taxation_customs/vies/' }
  if (vies.status === 'valid') {
    const name = vies.name ?? '—'
    const address = vies.address ?? '—'
    checks.push({
      id: 'vies',
      name: 'checkVIES',
      status: 'ok',
      points: 25,
      details: `${name} — ${address}`,
      detailsKey: 'viesValidCompany',
      detailsInterp: { name, address },
      ...viesSource,
    })
  } else if (vies.status === 'invalid') {
    checks.push({ id: 'vies', name: 'checkVIES', status: 'risk', points: -40, details: 'Invalid or inactive VAT number', detailsKey: 'viesInvalid', ...viesSource })
  } else {
    checks.push({ id: 'vies', name: 'checkVIES', status: 'check', points: 0, details: 'VIES unavailable', detailsKey: 'viesUnavailable', ...viesSource })
  }

  const registryUrl = registryLookupUrl(vat.normalized)
  if (registryUrl) {
    checks.push({
      id: 'registry',
      name: 'checkRegistry',
      status: 'check',
      points: 0,
      details: 'Ufficio Camerale',
      detailsKey: 'registryManual',
      source: 'Ufficio Camerale',
      sourceUrl: registryUrl,
    })
  }
  return checks
}

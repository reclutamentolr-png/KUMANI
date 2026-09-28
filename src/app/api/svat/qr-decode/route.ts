import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { fetchWhoisText, parseWhois } from '@/lib/whois'

interface QRDecodeResult {
  type: 'url' | 'phone' | 'sms' | 'email' | 'vcard' | 'wifi' | 'geo' | 'payment' | 'text'
  raw: string
  data: Record<string, string>
}

interface QRAnalysis {
  type: 'url' | 'phone' | 'sms' | 'email' | 'vcard' | 'wifi' | 'geo' | 'payment' | 'text'
  raw: string
  data: Record<string, string>
  analysis: {
    riskScore: number
    badge: 'green' | 'yellow' | 'red'
    indicators: Array<{ type: 'ok' | 'warning' | 'risk'; key: string; params?: Record<string, string> }>
    redirectChain?: Array<{ url: string; statusCode?: number; final: boolean }>
    recommendations: string[]
    aiExplanation: string
  }
  communitySignals?: {
    totalReports: number
    phishing: number
    scam: number
    impersonation: number
    other: number
  }
}

const KNOWN_BRANDS: Array<{ name: string; domains: string[]; category: string }> = [
  { name: 'PayPal', domains: ['paypal.com', 'paypal.it'], category: 'Payment' },
  { name: 'Poste Italiane', domains: ['posteitaliane.it', 'poste.it'], category: 'Courier' },
  { name: 'Google', domains: ['google.com', 'google.it'], category: 'Tech' },
  { name: 'Apple', domains: ['apple.com', 'apple.it'], category: 'Tech' },
  { name: 'Amazon', domains: ['amazon.com', 'amazon.it'], category: 'E-commerce' },
  { name: 'Microsoft', domains: ['microsoft.com', 'microsoft.it'], category: 'Tech' },
  { name: 'Facebook', domains: ['facebook.com', 'fb.com'], category: 'Social' },
  { name: 'Instagram', domains: ['instagram.com'], category: 'Social' },
  { name: 'WhatsApp', domains: ['whatsapp.com'], category: 'Messaging' },
  { name: 'Bank of Italy', domains: ['bancaditalia.it'], category: 'Banking' },
  { name: 'Intesa Sanpaolo', domains: ['intesasanpaolo.com', 'ispiro.it'], category: 'Banking' },
  { name: 'Unicredit', domains: ['unicredit.it'], category: 'Banking' },
  { name: 'Revolut', domains: ['revolut.com'], category: 'Finance' },
  { name: 'Satispay', domains: ['satispay.com', 'satispay.it'], category: 'Payment' },
  { name: 'Skrill', domains: ['skrill.com'], category: 'Payment' },
  { name: 'McDonald', domains: ['mcdonalds.com', 'mcdonalds.it'], category: 'Food' },
  { name: 'Netflix', domains: ['netflix.com', 'netflix.it'], category: 'Entertainment' },
]

const SHORTENER_DOMAINS = [
  'bit.ly', 'tinyurl.com', 'tinyurl.it', 't.co', 'goo.gl', 'ow.ly', 'buff.ly',
  'is.gd', 'titan.io', 'mo.bi', 'lnkd.in', 'po.st', 'adj.st', 'v.gd', 'x.co',
  'shorte.st', 'shorturl.at', 'cutt.ly', 'tinyurl.com', 'urlz.fr', 'u.nu',
]

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

  try {
    const body = await request.json()
    const { qrData } = body

    if (!qrData || typeof qrData !== 'string') {
      return NextResponse.json({ error: 'QR data required' }, { status: 400 })
    }

    // Detect QR content type
    const decoded = detectQRType(qrData)

    // Analyze based on type
    const analysis = await analyzeQR(decoded)

    // Get community signals
    const communitySignals = await getCommunitySignals(qrData)

    const result: QRAnalysis = {
      ...decoded,
      analysis,
      communitySignals,
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function detectQRType(raw: string): QRDecodeResult {
  const trimmed = raw.trim()

  // URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('www.')) {
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    return {
      type: 'url',
      raw,
      data: { url },
    }
  }

  // Phone
  if (trimmed.startsWith('tel:') || /^[\+]?[1-9][\d\s\-\(\)]{7,15}$/.test(trimmed)) {
    const phone = trimmed.startsWith('tel:') ? trimmed.slice(4) : trimmed
    return {
      type: 'phone',
      raw,
      data: { phone: phone.replace(/\s/g, '') },
    }
  }

  // SMS
  if (trimmed.startsWith('SMSTO:') || trimmed.startsWith('sms:') || trimmed.startsWith('SMS:')) {
    const smsPart = trimmed.replace(/^sms:?|^SMS:?|^SMSTO:/i, '')
    const [phone, ...msgParts] = smsPart.split('?')
    const message = msgParts.join('?').replace(/^body=/i, '')
    return {
      type: 'sms',
      raw,
      data: { phone: phone || '', message: message || '' },
    }
  }

  // Email
  if (trimmed.startsWith('MATMSG:') || trimmed.startsWith('mailto:')) {
    const email = trimmed.replace(/^mailto:/i, '').replace(/^MATMSG:/i, '')
    const emailMatch = email.match(/to:([^;]+)/i)?.[1] || email.match(/^([^?]+)/)?.[1]
    return {
      type: 'email',
      raw,
      data: { address: emailMatch || email },
    }
  }

  // WiFi
  if (trimmed.startsWith('WIFI:') || trimmed.startsWith('wifi:')) {
    const ssid = trimmed.match(/S:([^;]+)/i)?.[1] || ''
    const password = trimmed.match(/P:([^;]+)/i)?.[1] || ''
    const encryption = trimmed.match(/T:([^;]+)/i)?.[1] || ''
    return {
      type: 'wifi',
      raw,
      data: { ssid, password: password ? '••••••' : '', encryption: encryption || 'unknown' },
    }
  }

  // Geo coordinates
  if (trimmed.startsWith('GEO:') || /^geo:/i.test(trimmed) || /^-?\d+\.\d+,?\s*-?\d+\.\d+$/.test(trimmed)) {
    const geo = trimmed.replace(/^geo:/i, '')
    const [lat, lon] = geo.split(',')
    return {
      type: 'geo',
      raw,
      data: { latitude: lat?.trim() || '', longitude: lon?.trim() || '' },
    }
  }

  // Payment (Bitcoin, crypto, or payment requests)
  if (trimmed.startsWith('bitcoin:') || trimmed.startsWith('BTC:') ||
      /^bitcoin:[a-zA-Z0-9]+/.test(trimmed) ||
      trimmed.startsWith('upi:') || trimmed.startsWith('lightning:')) {
    const amount = trimmed.match(/amount=([^&]+)/i)?.[1] || ''
    const address = trimmed.match(/:(.*?)(\?|$)/)?.[1] || ''
    return {
      type: 'payment',
      raw,
      data: {
        address: address,
        amount: amount,
        currency: trimmed.startsWith('bitcoin') ? 'BTC' : trimmed.split(':')[0],
      },
    }
  }

  // vCard
  if (trimmed.includes('BEGIN:VCARD') || trimmed.includes('BEGIN:VCard') || trimmed.includes('VCARD')) {
    const name = trimmed.match(/FN:(.+)/i)?.[1]?.split('\n')[0]?.trim() || ''
    const phone = trimmed.match(/TEL:(.+)/i)?.[1]?.split('\n')[0]?.trim() || ''
    const email = trimmed.match(/EMAIL:(.+)/i)?.[1]?.split('\n')[0]?.trim() || ''
    return {
      type: 'vcard',
      raw,
      data: { name: name, phone: phone, email: email },
    }
  }

  // Default: plain text
  return {
    type: 'text',
    raw,
    data: { text: trimmed },
  }
}

async function analyzeQR(decoded: QRDecodeResult): Promise<QRAnalysis['analysis']> {
  const indicators: Array<{ type: 'ok' | 'warning' | 'risk'; key: string; params?: Record<string, string> }> = []
  let riskScore = 50

  if (decoded.type === 'url') {
    const { url } = decoded.data
    const analysis = await analyzeURL(url)
    return analysis
  }

  // Non-URL types
  if (decoded.type === 'payment') {
    indicators.push({ type: 'warning', key: 'indicatorPaymentRequest' })
    riskScore += 15
    return {
      riskScore,
      badge: riskScore >= 80 ? 'green' : riskScore >= 40 ? 'yellow' : 'red',
      indicators,
      recommendations: ['recPaymentVerifyRecipient', 'recPaymentConfirmAmount', 'recommendation2'],
      aiExplanation: 'This QR contains a payment request. Verify all details before proceeding.',
    }
  }

  if (decoded.type === 'wifi') {
    indicators.push({ type: 'ok', key: 'indicatorWifiCredentials' })
    riskScore -= 5
    return {
      riskScore,
      badge: 'green',
      indicators,
      recommendations: [],
      aiExplanation: 'This QR contains Wi-Fi network credentials. Connecting will give the network access to your device.',
    }
  }

  if (decoded.type === 'phone') {
    indicators.push({ type: 'warning', key: 'indicatorPhoneNumber' })
    riskScore += 10
    return {
      riskScore,
      badge: 'yellow',
      indicators,
      recommendations: ['recVerifyPhoneNumber'],
      aiExplanation: 'This QR contains a phone number. Calling may incur charges.',
    }
  }

  if (decoded.type === 'sms') {
    indicators.push({ type: 'warning', key: 'indicatorSmsTemplate' })
    riskScore += 5
    return {
      riskScore,
      badge: 'yellow',
      indicators,
      recommendations: ['recReviewSmsContent'],
      aiExplanation: 'This QR contains an SMS message. Review before sending.',
    }
  }

  if (decoded.type === 'email') {
    indicators.push({ type: 'ok', key: 'indicatorEmailAddress' })
    return {
      riskScore,
      badge: 'green',
      indicators,
      recommendations: [],
      aiExplanation: 'This QR contains an email address.',
    }
  }

  if (decoded.type === 'geo') {
    indicators.push({ type: 'ok', key: 'indicatorGeoCoordinates' })
    return {
      riskScore,
      badge: 'green',
      indicators,
      recommendations: [],
      aiExplanation: 'This QR contains geographic coordinates.',
    }
  }

  if (decoded.type === 'vcard') {
    indicators.push({ type: 'ok', key: 'indicatorVcardContact' })
    return {
      riskScore,
      badge: 'green',
      indicators,
      recommendations: ['recReviewContactInfo'],
      aiExplanation: 'This QR contains a contact card (vCard).',
    }
  }

  // Default text
  indicators.push({ type: 'ok', key: 'indicatorPlainText' })
  return {
    riskScore,
    badge: 'yellow',
    indicators,
    recommendations: [],
    aiExplanation: `This QR contains text content: "${decoded.data.text || ''.slice(0, 50)}"`,
  }
}

async function analyzeURL(url: string): Promise<QRAnalysis['analysis']> {
  const indicators: Array<{ type: 'ok' | 'warning' | 'risk'; key: string; params?: Record<string, string> }> = []
  let riskScore = 50
  const redirectChain: Array<{ url: string; final: boolean }> = []
  let finalUrl = url
  let hasRedirect = false

  // Check if URL is using IP instead of domain. `urlObj` is parsed once here
  // and reused below — it used to be re-parsed with a second, unguarded
  // `new URL(url)` call further down, which threw uncaught (crashing the
  // whole analysis with a generic 500) for exactly the malformed URLs this
  // first check exists to flag.
  let urlObj: URL | null = null
  try {
    urlObj = new URL(url)
    const hostname = urlObj.hostname

    // Check for IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipRegex.test(hostname)) {
      indicators.push({ type: 'risk', key: 'indicatorIpAddress' })
      riskScore -= 20
    }

    // Check for port (unusual)
    if (urlObj.port && !['80', '443'].includes(urlObj.port)) {
      indicators.push({ type: 'risk', key: 'indicatorUnusualPort', params: { port: urlObj.port } })
      riskScore -= 10
    }

    // Check for suspicious characters in domain
    if (/[^a-z0-9.-]/i.test(hostname) && !hostname.includes('xn--')) {
      indicators.push({ type: 'risk', key: 'indicatorSuspiciousChars' })
      riskScore -= 10
    }

    // Check for Unicode/Omograph attacks
    if (hostname.includes('xn--') || /[^\x00-\x7F]/.test(hostname)) {
      indicators.push({ type: 'warning', key: 'indicatorPunycode' })
      riskScore -= 5
    }
  } catch {
    indicators.push({ type: 'risk', key: 'indicatorInvalidUrl' })
    riskScore -= 15
  }

  if (!urlObj) {
    // The URL couldn't be parsed at all — nothing further to analyze safely.
    return {
      riskScore: Math.max(0, Math.min(100, riskScore)),
      badge: 'red',
      indicators,
      recommendations: ['recommendation1'],
      aiExplanation: 'This QR contains a malformed link that could not be analyzed. Do not visit it.',
    }
  }

  // Check for URL shorteners
  const shortenerDomain = urlObj.hostname.replace(/^www\./, '')
  if (SHORTENER_DOMAINS.includes(shortenerDomain)) {
    indicators.push({ type: 'warning', key: 'indicatorShortener', params: { domain: shortenerDomain } })
    riskScore -= 5

    // Attempt to resolve redirect chain
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        headers: { 'User-Agent': 'SVAT-QR-Scanner/1.0' },
        next: { revalidate: 0 },
      })

      const location = res.headers.get('location')
      if (location) {
        hasRedirect = true
        redirectChain.push({ url, final: false })

        let current = location
        for (let i = 0; i < 5; i++) {
          redirectChain.push({ url: current, final: false })
          try {
            const redirectRes = await fetch(current, {
              method: 'HEAD',
              redirect: 'manual',
              headers: { 'User-Agent': 'SVAT-QR-Scanner/1.0' },
              next: { revalidate: 0 },
            })
            const nextLocation = redirectRes.headers.get('location')
            if (!nextLocation) {
              redirectChain[redirectChain.length - 1].final = true
              finalUrl = current
              break
            }
            current = new URL(nextLocation, current).toString()
          } catch {
            break
          }
        }
      }
    } catch {
      indicators.push({ type: 'warning', key: 'indicatorRedirectFailed' })
    }
  } else {
    // For direct URLs, follow redirects once to check
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': 'SVAT-QR-Scanner/1.0' },
        next: { revalidate: 0 },
      })
      if (res.url !== url) {
        hasRedirect = true
        redirectChain.push({ url, final: false })
        redirectChain.push({ url: res.url, final: true })
        finalUrl = res.url
      }
    } catch {}
  }

  if (hasRedirect) {
    indicators.push({ type: 'warning', key: 'indicatorHasRedirect' })
    if (redirectChain.length > 2) {
      indicators.push({ type: 'warning', key: 'multipleRedirects', params: { count: String(redirectChain.length - 1) } })
      riskScore -= 5
    }
  }

  // HTTPS check
  if (!url.startsWith('https://')) {
    indicators.push({ type: 'risk', key: 'indicatorHttpsMissing' })
    riskScore -= 15
  } else {
    indicators.push({ type: 'ok', key: 'indicatorHttpsOk' })
  }

  // Brand impersonation check
  const finalHostname = (() => {
    try {
      return new URL(finalUrl).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  })()

  const impersonationCheck = checkBrandImpersonation(finalHostname)
  if (impersonationCheck) {
    indicators.push({
      type: 'risk',
      key: 'impersonationDetail',
      params: { brand: impersonationCheck.brand },
    })
    riskScore -= 15
  }

  // Check domain age if available (quick check). Queries the registry's
  // authoritative WHOIS server directly (src/lib/whois.ts) instead of a
  // third-party HTTP proxy.
  try {
    const whoisData = await fetchWhoisText(finalHostname)
    if (whoisData) {
      const { creationDate } = parseWhois(whoisData)
      if (creationDate) {
        const created = new Date(creationDate)
        if (!isNaN(created.getTime())) {
          const diffDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays < 30) {
            indicators.push({ type: 'risk', key: 'indicatorNewDomainRisk', params: { days: String(diffDays) } })
            riskScore -= 10
          } else {
            indicators.push({
              type: 'ok',
              key: 'indicatorDomainAgeOk',
              params: { years: String(Math.floor(diffDays / 365)) },
            })
          }
        }
      }
    }
  } catch {}

  // AI-style explanation (kept as an English fallback; the client renders a localized
  // version derived from `badge` — see aiExplanationLowRisk/MediumRisk/HighRisk in qrCheck.*)
  const riskIndicators = indicators.filter((i) => i.type === 'risk').length
  const warningIndicators = indicators.filter((i) => i.type === 'warning').length
  let aiExplanation = ''

  if (riskScore >= 80) {
    aiExplanation = 'No significant risk indicators detected. This URL appears legitimate, but always verify before entering credentials.'
  } else if (riskScore >= 40) {
    if (impersonationCheck) {
      aiExplanation = `This URL contains the name "${impersonationCheck.brand}" but the domain does not match the official domain. Combined with other risk factors, exercise caution.`
    } else if (hasRedirect) {
      aiExplanation = `This URL redirects (${redirectChain.length} hops). The destination may not be what it first appears.`
    } else {
      aiExplanation = 'Some risk indicators were found. Review the details before proceeding.'
    }
  } else {
    aiExplanation = `High risk detected (${riskIndicators} risk, ${warningIndicators} warning indicators). Do not visit this link.`
  }

  const recommendations: string[] = []
  if (!url.startsWith('https://')) recommendations.push('recommendation3')
  if (impersonationCheck) recommendations.push('recommendation2')
  if (hasRedirect) recommendations.push('recommendation4')
  if (!recommendations.length) recommendations.push('recommendation1')

  return {
    riskScore: Math.max(0, Math.min(100, riskScore)),
    badge: riskScore >= 80 ? 'green' : riskScore >= 40 ? 'yellow' : 'red',
    indicators,
    redirectChain,
    recommendations,
    aiExplanation,
  }
}

function checkBrandImpersonation(hostname: string): { brand: string; category: string } | null {
  const lowerHostname = hostname.toLowerCase()
  const labels = lowerHostname.split('.')

  for (const brand of KNOWN_BRANDS) {
    for (const brandDomain of brand.domains) {
      // Exact match or a genuine subdomain of the real domain (e.g.
      // login.paypal.com) — not impersonation.
      if (lowerHostname === brandDomain || lowerHostname.endsWith('.' + brandDomain)) continue

      const brandName = brandDomain.split('.')[0]

      // Classic typosquat: identical brand name, different TLD (paypal.co
      // instead of paypal.com).
      if (labels[0] === brandName) {
        return { brand: brand.name, category: brand.category }
      }

      // Brand name embedded as its own token inside a label (e.g.
      // "paypal-secure-login.com"), matched at a word boundary rather than
      // as a bare substring — a bare-substring search used to flag
      // unrelated Italian words that merely contain a brand name, like
      // "poste" inside "composte.it" or "apple" inside "pineapple.com".
      const boundaryRegex = new RegExp(`(^|[^a-z0-9])${brandName}([^a-z0-9]|$)`)
      if (labels.some((label) => label !== brandName && boundaryRegex.test(label))) {
        return { brand: brand.name, category: brand.category }
      }
    }
  }

  return null
}

async function getCommunitySignals(qrData: string): Promise<QRAnalysis['communitySignals'] | undefined> {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: reports, error } = await supabaseAdmin
      .from('svat_qc_reports')
      .select('type')
      .eq('qr_data', qrData)

    if (error) return undefined

    if (reports && reports.length > 0) {
      const typeCounts = { phishing: 0, scam: 0, impersonation: 0, other: 0 }
      reports.forEach((r: { type: string }) => {
        if (r.type === 'phishing') typeCounts.phishing++
        else if (r.type === 'scam') typeCounts.scam++
        else if (r.type === 'impersonation') typeCounts.impersonation++
        else typeCounts.other++
      })

      return {
        totalReports: reports.length,
        ...typeCounts,
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

// Firma Email: costruisce l'HTML della firma, pensato per i client di posta
// (Gmail, Outlook, Apple Mail). Solo tabelle e stili in linea, niente
// classi, flex o grid; font sicuri e immagini con indirizzo assoluto.
// Ogni campo scritto dall'utente passa da escapeHtml, ogni link da safeUrl:
// sono ammessi solo http(s), mailto e tel. Nessun import server-only qui.

export type SignatureTemplate = 'classic' | 'compact' | 'modern'

export const SIGNATURE_TEMPLATES: SignatureTemplate[] = ['classic', 'compact', 'modern']

export const SOCIAL_KEYS = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'x'] as const
export type SocialKey = (typeof SOCIAL_KEYS)[number]

export const SOCIAL_NAMES: Record<SocialKey, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
}

// Base per chi scrive solo il nome utente (es. "@mario" invece del link)
const SOCIAL_BASE: Record<SocialKey, string> = {
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  linkedin: 'https://www.linkedin.com/in/',
  tiktok: 'https://www.tiktok.com/@',
  youtube: 'https://www.youtube.com/@',
  x: 'https://x.com/',
}

export const DEFAULT_BRAND_COLOR = '#c79a3b'

export interface SignatureData {
  fullName: string
  role: string
  company: string
  phone: string
  mobile: string
  email: string
  website: string
  address: string
  logoUrl: string
  photoUrl: string
  color: string
  social: Record<SocialKey, string>
  includeCardLink: boolean
}

// Etichette tradotte usate dentro la firma
export interface SignatureLabels {
  phone: string
  mobile: string
  email: string
  web: string
  whatsapp: string
  cardLink: string
}

export function emptySignature(): SignatureData {
  return {
    fullName: '',
    role: '',
    company: '',
    phone: '',
    mobile: '',
    email: '',
    website: '',
    address: '',
    logoUrl: '',
    photoUrl: '',
    color: DEFAULT_BRAND_COLOR,
    social: { facebook: '', instagram: '', linkedin: '', tiktok: '', youtube: '', x: '' },
    includeCardLink: true,
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Restituisce un link sicuro o '' se non valido. Ammessi solo http(s),
 * mailto e tel (con `imageOnly` solo http(s)). Un indirizzo senza schema
 * che sembra un dominio ("www.sito.it") diventa https://.
 */
export function safeUrl(raw: string, imageOnly = false): string {
  const value = raw.trim()
  if (!value || /[\s<>"'`\\]/.test(value)) return ''
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value)
    ? value
    : /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(value)
      ? `https://${value}`
      : ''
  if (!withScheme) return ''
  try {
    const url = new URL(withScheme)
    const allowed = imageOnly ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:']
    if (!allowed.includes(url.protocol)) return ''
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.hostname.includes('.') && url.hostname !== 'localhost') {
      return ''
    }
    return url.href
  } catch {
    return ''
  }
}

export function safeColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : DEFAULT_BRAND_COLOR
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits.replace(/\d/g, '').length > 1 || digits.length < 4 ? '' : safeUrl(`tel:${digits}`)
}

function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 6 ? safeUrl(`https://wa.me/${digits}`) : ''
}

function mailHref(email: string): string {
  const value = email.trim()
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(value) ? safeUrl(`mailto:${value}`) : ''
}

export function socialHref(key: SocialKey, raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes('/') || /^www\./i.test(value)
  const handle = value.replace(/^@/, '')
  if (!looksLikeUrl && /^[\w.-]+$/.test(handle)) return safeUrl(SOCIAL_BASE[key] + handle)
  return safeUrl(value)
}

// Testo visibile per un sito: senza schema e senza barra finale
function displayUrl(href: string): string {
  return href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}

const FONT = 'Arial, Helvetica, sans-serif'
const TEXT = '#333333'
const SOFT = '#777777'

interface Built {
  name: string
  role: string // ruolo e azienda, già escapati
  contacts: string[] // righe già in HTML sicuro
  socials: string // riga già in HTML sicuro ('' se vuota)
  card: string // link alla pagina KUMANI ('' se assente)
  address: string
  photo: string // src sicuri ('' se assenti)
  logo: string
  color: string
  hasContent: boolean
}

function link(href: string, text: string, style: string): string {
  return `<a href="${escapeHtml(href)}" style="${style}">${escapeHtml(text)}</a>`
}

function prepare(data: SignatureData, labels: SignatureLabels, cardUrl: string | null): Built {
  const color = safeColor(data.color)
  const linkStyle = `color:${TEXT};text-decoration:none;`
  const labelStyle = `color:${color};font-weight:bold;`
  const contacts: string[] = []

  const contact = (label: string, body: string) => `<span style="${labelStyle}">${escapeHtml(label)}</span>&nbsp;${body}`

  const phone = data.phone.trim()
  if (phone) {
    const href = telHref(phone)
    contacts.push(contact(labels.phone, href ? link(href, phone, linkStyle) : escapeHtml(phone)))
  }
  const mobile = data.mobile.trim()
  if (mobile) {
    const href = telHref(mobile)
    const wa = whatsappHref(mobile)
    let body = href ? link(href, mobile, linkStyle) : escapeHtml(mobile)
    if (wa) body += `&nbsp;&middot;&nbsp;${link(wa, labels.whatsapp, `color:${color};text-decoration:none;`)}`
    contacts.push(contact(labels.mobile, body))
  }
  const email = data.email.trim()
  if (email) {
    const href = mailHref(email)
    contacts.push(contact(labels.email, href ? link(href, email, linkStyle) : escapeHtml(email)))
  }
  const website = safeUrl(data.website)
  if (website) contacts.push(contact(labels.web, link(website, displayUrl(website), linkStyle)))

  const socialLinks = SOCIAL_KEYS.map(key => {
    const href = socialHref(key, data.social[key])
    return href ? link(href, SOCIAL_NAMES[key], `color:${color};text-decoration:none;font-weight:bold;`) : ''
  }).filter(Boolean)
  const socials = socialLinks.join(`<span style="color:#bbbbbb;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`)

  const safeCard = data.includeCardLink && cardUrl ? safeUrl(cardUrl) : ''
  const card = safeCard
    ? `<a href="${escapeHtml(safeCard)}" style="color:${color};text-decoration:none;font-weight:bold;">&rarr;&nbsp;${escapeHtml(labels.cardLink)}</a>`
    : ''

  const roleParts = [data.role.trim(), data.company.trim()].filter(Boolean).map(escapeHtml)
  const name = escapeHtml(data.fullName.trim())
  const address = escapeHtml(data.address.trim())
  const photo = safeUrl(data.photoUrl, true)
  const logo = safeUrl(data.logoUrl, true)

  return {
    name,
    role: roleParts.join(' &middot; '),
    contacts,
    socials,
    card,
    address,
    photo,
    logo,
    color,
    hasContent: Boolean(name || roleParts.length || contacts.length || socials || address || photo || logo),
  }
}

function img(src: string, alt: string, size: number, round: boolean): string {
  const radius = round ? `border-radius:${Math.round(size / 2)}px;` : ''
  const dims = round ? `width="${size}" height="${size}"` : `height="${size}"`
  const cssDims = round ? `width:${size}px;height:${size}px;` : `height:${size}px;width:auto;`
  return `<img src="${escapeHtml(src)}" alt="${alt}" ${dims} style="display:block;border:0;outline:none;${cssDims}${radius}" />`
}

function lines(rows: string[], style = ''): string {
  return rows.map(row => `<tr><td style="padding:0 0 2px 0;${style}">${row}</td></tr>`).join('')
}

function table(inner: string, extra = ''): string {
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:${FONT};font-size:13px;line-height:1.5;color:${TEXT};${extra}">${inner}</table>`
}

function nameBlock(b: Built, nameColor: string, size: number): string[] {
  const rows: string[] = []
  if (b.name) rows.push(`<span style="font-size:${size}px;font-weight:bold;color:${nameColor};">${b.name}</span>`)
  if (b.role) rows.push(`<span style="color:${SOFT};">${b.role}</span>`)
  return rows
}

function extraRows(b: Built): string[] {
  const rows: string[] = []
  if (b.address) rows.push(`<span style="color:${SOFT};">${b.address}</span>`)
  if (b.socials) rows.push(b.socials)
  if (b.card) rows.push(b.card)
  return rows
}

function classic(b: Built): string {
  const image = b.photo || b.logo
  const round = Boolean(b.photo)
  const details = [
    ...nameBlock(b, '#111111', 17),
    ...(b.contacts.length ? [`<span style="display:block;height:6px;line-height:6px;font-size:6px;">&nbsp;</span>`] : []),
    ...b.contacts,
    ...extraRows(b),
  ]
  const detailsCell = `<td style="vertical-align:top;padding:0 0 0 ${image ? 16 : 0}px;">${table(lines(details))}</td>`
  const imageCell = image
    ? `<td style="vertical-align:top;padding:0 16px 0 0;border-right:2px solid ${b.color};">${img(image, b.name || 'logo', round ? 90 : 60, round)}${
        b.photo && b.logo
          ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;"><tr><td style="padding:10px 0 0 0;">${img(b.logo, 'logo', 32, false)}</td></tr></table>`
          : ''
      }</td>`
    : ''
  return table(`<tr>${imageCell}${detailsCell}</tr>`)
}

function compact(b: Built): string {
  const rows: string[] = []
  const head = [b.name ? `<span style="font-size:15px;font-weight:bold;color:#111111;">${b.name}</span>` : '', b.role ? `<span style="color:${SOFT};">${b.role}</span>` : '']
    .filter(Boolean)
    .join(`<span style="color:${b.color};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`)
  if (head) rows.push(head)
  if (b.contacts.length) rows.push(b.contacts.join(`<span style="color:#bbbbbb;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`))
  const tail = [b.socials, b.card].filter(Boolean).join(`<span style="color:#bbbbbb;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`)
  if (tail) rows.push(tail)
  return table(lines(rows, 'font-size:12px;'))
}

function modern(b: Built): string {
  const details = [...nameBlock(b, b.color, 18), ...b.contacts, ...extraRows(b)]
  const photoCell = b.photo
    ? `<td style="vertical-align:top;padding:0 14px 0 0;">${img(b.photo, b.name || 'foto', 72, true)}</td>`
    : ''
  const logoRow = b.logo ? `<tr><td style="padding:10px 0 0 0;">${img(b.logo, 'logo', 40, false)}</td></tr>` : ''
  const content = table(`<tr>${photoCell}<td style="vertical-align:top;">${table(lines(details) + logoRow)}</td></tr>`)
  return table(
    `<tr><td width="5" style="width:5px;background-color:${b.color};font-size:1px;line-height:1px;">&nbsp;</td><td style="vertical-align:top;padding:4px 0 4px 14px;">${content}</td></tr>`,
  )
}

/** HTML della firma, oppure '' se il modulo è ancora vuoto. */
export function buildSignatureHtml(
  data: SignatureData,
  template: SignatureTemplate,
  labels: SignatureLabels,
  cardUrl: string | null,
): string {
  const b = prepare(data, labels, cardUrl)
  if (!b.hasContent) return ''
  if (template === 'compact') return compact(b)
  if (template === 'modern') return modern(b)
  return classic(b)
}

/** Versione in testo semplice, per i client che non accettano l'HTML. */
export function buildSignatureText(data: SignatureData, labels: SignatureLabels, cardUrl: string | null): string {
  const out: string[] = []
  const name = data.fullName.trim()
  if (name) out.push(name)
  const role = [data.role.trim(), data.company.trim()].filter(Boolean).join(' · ')
  if (role) out.push(role)
  if (data.phone.trim()) out.push(`${labels.phone} ${data.phone.trim()}`)
  if (data.mobile.trim()) out.push(`${labels.mobile} ${data.mobile.trim()}`)
  if (data.email.trim()) out.push(`${labels.email} ${data.email.trim()}`)
  const website = safeUrl(data.website)
  if (website) out.push(`${labels.web} ${displayUrl(website)}`)
  if (data.address.trim()) out.push(data.address.trim())
  for (const key of SOCIAL_KEYS) {
    const href = socialHref(key, data.social[key])
    if (href) out.push(`${SOCIAL_NAMES[key]}: ${href}`)
  }
  const card = data.includeCardLink && cardUrl ? safeUrl(cardUrl) : ''
  if (card) out.push(`${labels.cardLink}: ${card}`)
  return out.join('\n')
}

/** Pagina HTML completa, per l'anteprima e per il file scaricato. */
export function buildSignatureDocument(signatureHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:20px;background-color:#ffffff;">
${signatureHtml}
</body>
</html>
`
}

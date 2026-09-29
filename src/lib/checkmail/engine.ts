// KUMANI CheckMail — motore di analisi di un'email sospetta (prototipo).
//
// Riceve il sorgente completo (.eml / "Mostra originale") oppure, dal
// telefono, solo testo + indirizzo del mittente. Restituisce un punteggio di
// rischio 0-100 e l'elenco dei segnali trovati (chiave + parametri, da
// tradurre nella lingua dell'utente). L'email è analizzata in memoria e non
// viene salvata.
//
// Niente import locali né alias: il file gira sia nel sito (Next) sia da
// solo con Node, per la prova su email vere (vedi la cartella di test).
import PostalMime from 'postal-mime'

export type Severity = 'high' | 'medium' | 'low' | 'info'
export type Finding = { key: string; severity: Severity; points: number; params?: Record<string, string | number> }
export type RiskLevel = 'high' | 'medium' | 'low'
export type Verdict = {
  score: number
  level: RiskLevel
  findings: Finding[]
  // Dati riassuntivi (per la spiegazione), mai l'intero contenuto
  summary: { fromAddress: string | null; fromName: string | null; subject: string | null; linkDomains: string[]; hasHeaders: boolean; attachmentNames: string[] }
  // Estratto del testo (max 6000 caratteri) per la lettura con l'IA: resta in
  // memoria per la sola durata dell'analisi, non va mai salvato
  textSample: string
}
export type CheckMailInput = { raw?: string | ArrayBuffer; text?: string; sender?: string; subject?: string }
export type CheckMailOptions = {
  // Controlli di rete (età del dominio, record MX); false = solo analisi locale
  network?: boolean
  fetchImpl?: typeof fetch
}

// ─── Marchi più imitati e loro domini ufficiali ──────────────────────────
// Se un'email dice di essere uno di questi ma il dominio non è tra quelli
// ufficiali, è il segnale più forte di truffa.
// words: frasi cercate senza maiuscole; acronyms: sigle cercate solo in
// MAIUSCOLO ("TIM", non il nome "Tim").
const BRANDS: { name: string; words: string[]; acronyms?: string[]; domains: string[] }[] = [
  { name: 'PayPal', words: ['paypal'], domains: ['paypal.com', 'paypal.it', 'paypal.me'] },
  { name: 'Amazon', words: ['amazon'], domains: ['amazon.it', 'amazon.com', 'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.co.uk', 'amazon.eu', 'amazonses.com', 'marketplace.amazon.it', 'amazonaws.com', 'aws.amazon.com', 'awstrack.me', 'primevideo.com', 'audible.it'] },
  { name: 'Poste Italiane', words: ['poste italiane', 'posteitaliane', 'bancoposta', 'postepay'], domains: ['poste.it', 'posteitaliane.it', 'postepay.it'] },
  { name: 'Intesa Sanpaolo', words: ['intesa sanpaolo', 'intesasanpaolo'], domains: ['intesasanpaolo.com', 'intesasanpaolo.it'] },
  { name: 'UniCredit', words: ['unicredit'], domains: ['unicredit.it', 'unicredit.eu', 'unicreditgroup.eu'] },
  { name: 'BNL', words: ['bnl'], domains: ['bnl.it'] },
  { name: 'BPER', words: ['bper'], domains: ['bper.it'] },
  { name: 'Fineco', words: ['fineco'], domains: ['finecobank.com', 'fineco.it'] },
  { name: 'Nexi', words: ['nexi'], domains: ['nexi.it', 'nexigroup.com'] },
  { name: 'Mediolanum', words: ['mediolanum'], domains: ['bancamediolanum.it', 'mediolanum.it'] },
  { name: 'Satispay', words: ['satispay'], domains: ['satispay.com'] },
  { name: 'Revolut', words: ['revolut'], domains: ['revolut.com'] },
  { name: 'N26', words: ['n26'], domains: ['n26.com'] },
  { name: 'Apple', words: ['apple id', 'id apple', 'icloud', 'itunes', 'apple pay', 'apple store', 'app store'], domains: ['apple.com', 'icloud.com', 'email.apple.com', 'id.apple.com'] },
  { name: 'Microsoft', words: ['microsoft', 'microsoft outlook', 'office 365', 'office365', 'onedrive'], domains: ['microsoft.com', 'outlook.com', 'outlook.it', 'office.com', 'live.com', 'live.it', 'hotmail.com', 'hotmail.it', 'microsoftonline.com', 'accountprotection.microsoft.com'] },
  { name: 'Google', words: ['google account', 'account google', 'gmail', 'google drive', 'google pay', 'google workspace'], domains: ['google.com', 'google.it', 'accounts.google.com', 'gmail.com', 'googlemail.com', 'youtube.com'] },
  { name: 'Netflix', words: ['netflix'], domains: ['netflix.com', 'mailer.netflix.com'] },
  { name: 'Facebook / Meta', words: ['facebook', 'meta business', 'instagram', 'whatsapp'], domains: ['facebook.com', 'facebookmail.com', 'meta.com', 'instagram.com', 'mail.instagram.com', 'whatsapp.com'] },
  { name: 'DHL', words: ['dhl'], domains: ['dhl.com', 'dhl.it', 'dhl.de'] },
  { name: 'BRT', words: ['bartolini'], acronyms: ['BRT'], domains: ['brt.it'] },
  { name: 'GLS', words: ['gls italy'], acronyms: ['GLS'], domains: ['gls-italy.com', 'gls-group.eu', 'gls-group.com'] },
  { name: 'UPS', words: ['ups express'], acronyms: ['UPS'], domains: ['ups.com'] },
  { name: 'FedEx', words: ['fedex'], domains: ['fedex.com'] },
  { name: 'SDA', words: ['sda express', 'sda corriere'], domains: ['sda.it'] },
  { name: 'Agenzia delle Entrate', words: ['agenzia delle entrate', 'agenziaentrate'], domains: ['agenziaentrate.it', 'agenziaentrate.gov.it', 'pec.agenziaentrate.it'] },
  { name: 'INPS', words: ['inps'], domains: ['inps.it', 'postacert.inps.gov.it'] },
  { name: 'Aruba', words: ['aruba'], domains: ['aruba.it', 'staff.aruba.it', 'arubapec.it'] },
  { name: 'Enel', words: ['enel'], domains: ['enel.it', 'enel.com'] },
  { name: 'TIM', words: ['telecom italia', 'tim spa', 'mytim'], acronyms: ['TIM'], domains: ['tim.it', 'telecomitalia.it'] },
  { name: 'Vodafone', words: ['vodafone'], domains: ['vodafone.it', 'vodafone.com'] },
  { name: 'Iliad', words: ['iliad'], domains: ['iliad.it'] },
  { name: 'eBay', words: ['ebay'], domains: ['ebay.it', 'ebay.com'] },
  { name: 'Zalando', words: ['zalando'], domains: ['zalando.it', 'zalando.com'] },
]

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.it', 'live.com', 'live.it', 'yahoo.com', 'yahoo.it',
  'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it', 'tin.it', 'icloud.com', 'me.com', 'aol.com', 'gmx.com', 'gmx.de',
  'web.de', 'mail.ru', 'yandex.ru', 'proton.me', 'protonmail.com', 'orange.fr', 'free.fr', 'laposte.net',
  'outlook.it', 'ymail.com', 'mail.com', 'email.com', 'gmx.it', 'inwind.it', 'hotmail.co.uk', 'yahoo.co.uk', 'msn.com',
])

// Servizi che le newsletter vere usano per contare i clic: il link passa da
// loro prima di arrivare al sito, quindi "testo diverso dal link" è normale.
const CLICK_TRACKERS = new Set([
  'acemlna.com', 'acemlnb.com', 'acemlnc.com', 'acemlnd.com', 'activehosted.com', 'list-manage.com', 'mailchi.mp', 'mcusercontent.com',
  'sendgrid.net', 'sendgrid.com', 'mandrillapp.com', 'mailgun.org', 'mjt.lu', 'mailjet.com', 'sendibt1.com', 'sendibt2.com', 'sendibt3.com',
  'sendibm1.com', 'brevo.com', 'r.sb', 'hubspotlinks.com', 'hs-sites.com', 'hubspotemail.net', 'sparkpostmail.com', 'awstrack.me',
  'klclick.com', 'klclick1.com', 'klclick2.com', 'klclick3.com', 'ctfassets.net', 'mailerlite.com', 'mlsend.com', 'createsend.com',
  'cmail19.com', 'cmail20.com', 'emlnk.com', 'rs6.net', 'constantcontact.com', 'safelinks.protection.outlook.com', 'urldefense.com',
  'substack.com', 'beehiiv.com', 'convertkit-mail.com', 'ck.page', 'getresponse.com', 'gr-cdn.com', 'aweber.com', 'flodesk.com',
])

const SHORTENERS = new Set(['flowto.it', 'x.gd', 'v.gd', 'u.to', 'cutt.us', 'short.io', 'shorturl.asia', 'bit.do', 'bit.ly', 'tinyurl.com', 't.ly', 'is.gd', 'cutt.ly', 'ow.ly', 'rebrand.ly', 'shorturl.at', 's.id', 'rb.gy', 'tiny.cc', 'buff.ly', 't.co', 'lnkd.in', 'goo.gl', 'qrco.de'])
const RISKY_TLDS = new Set(['top', 'xyz', 'icu', 'click', 'link', 'cfd', 'sbs', 'rest', 'monster', 'quest', 'zip', 'mov', 'buzz', 'cyou', 'shop', 'online', 'site', 'live', 'support', 'lat', 'bond'])
const DANGEROUS_EXT = new Set(['exe', 'scr', 'js', 'jse', 'vbs', 'vbe', 'bat', 'cmd', 'com', 'pif', 'iso', 'img', 'lnk', 'hta', 'docm', 'xlsm', 'pptm', 'jar', 'msi', 'ps1', 'wsf', 'reg', 'cab', 'apk', 'svg'])
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'gz', 'tar', 'ace', 'arj'])
// Parole comuni simili a nomi di marchi ("cloud" e "icloud"): non sono imitazioni
// Lettere cirilliche identiche a quelle latine (а е о р с у х і ј ѕ ...)
const HOMOGLYPHS = new Set([...'аеорсухіјѕԁһԛԝАВЕКМНОРСТХІЈЅ'])
const COMMON_WORDS = new Set(['cloud', 'mail', 'email', 'post', 'posta', 'posten', 'poster', 'apply', 'live', 'office'])
// Estensioni di file che nel testo di un link non sono domini ("fattura.pdf")
const FILE_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'zip', 'rar', 'js', 'ts', 'html', 'htm', 'php', 'asp', 'aspx', 'mp3', 'mp4', 'eml', 'msg'])
// Suffissi a due livelli più comuni (per ricavare il dominio "vero")
const TWO_LEVEL_SUFFIXES = new Set(['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.br', 'com.au', 'co.jp', 'com.tr', 'com.mx', 'co.za', 'com.ar', 'gov.it', 'co.in', 'com.cn', 'com.ru', 'co.nz', 'com.es', 'com.pt'])

// ─── Frasi tipiche delle truffe, in 7 lingue ─────────────────────────────
// Ogni gruppo conta una volta sola. Scritte in minuscolo, senza accenti
// obbligatori (il testo viene normalizzato allo stesso modo).
const CONTENT_RULES: { key: string; points: number; phrases: string[] }[] = [
  {
    key: 'content_account_threat',
    points: 15,
    phrases: [
      'account sospeso', 'account bloccato', 'conto bloccato', 'conto sospeso', 'carta bloccata', 'accesso limitato', 'accesso sospetto', 'verra disattivato', 'sara disattivato', 'sara sospeso', 'chiusura del conto',
      'account suspended', 'account has been suspended', 'account locked', 'account will be closed', 'unusual activity', 'suspicious activity', 'account has been limited', 'will be deactivated',
      'cuenta suspendida', 'cuenta bloqueada', 'actividad sospechosa', 'compte suspendu', 'compte bloque', 'activite suspecte', 'conta suspensa', 'conta bloqueada', 'atividade suspeita',
      'konto gesperrt', 'konto wurde gesperrt', 'verdachtige aktivitat', 'аккаунт заблокирован', 'учетная запись заблокирована', 'подозрительная активность',
    ],
  },
  {
    key: 'content_urgency',
    points: 10,
    phrases: [
      'entro 24 ore', 'entro 48 ore', 'immediatamente', 'azione immediata', 'agisci subito', 'ultimo avviso', 'ultimo promemoria', 'scade oggi', 'urgente',
      'within 24 hours', 'within 48 hours', 'immediately', 'urgent action', 'act now', 'final notice', 'last warning', 'expires today',
      'en 24 horas', 'inmediatamente', 'ultimo aviso', 'sous 24 heures', 'immediatement', 'dernier avis', 'em 24 horas', 'imediatamente', 'ultimo aviso',
      'innerhalb von 24 stunden', 'sofort', 'letzte mahnung', 'в течение 24 часов', 'немедленно', 'последнее предупреждение', 'срочно',
    ],
  },
  {
    key: 'content_credentials',
    points: 15,
    phrases: [
      'verifica i tuoi dati', 'conferma i tuoi dati', 'aggiorna i tuoi dati', 'conferma la tua identita', 'inserisci la password', 'codice otp', 'codice di sicurezza', 'credenziali', 'numero della carta', 'codice pin',
      'verify your account', 'verify your identity', 'confirm your details', 'update your information', 'update your payment', 'enter your password', 'one-time code', 'security code', 'card number',
      'verifique su cuenta', 'confirme sus datos', 'actualice sus datos', 'verifiez votre compte', 'confirmez vos informations', 'mettez a jour vos informations', 'verifique a sua conta', 'confirme os seus dados', 'atualize os seus dados',
      'bestatigen sie ihre daten', 'verifizieren sie ihr konto', 'aktualisieren sie ihre daten', 'подтвердите свои данные', 'подтвердите личность', 'введите пароль', 'код подтверждения',
    ],
  },
  {
    key: 'content_payment_pressure',
    points: 15,
    phrases: [
      'gift card', 'carta regalo', 'buono regalo', 'bitcoin', 'criptovalute', 'criptovaluta', 'nuove coordinate bancarie', 'nuovo iban', 'cambio iban', 'bonifico urgente', 'paga la multa', 'pagamento in sospeso', 'fattura non pagata',
      'new bank details', 'changed bank details', 'wire transfer', 'unpaid invoice', 'outstanding payment', 'pay the fine', 'cryptocurrency',
      'tarjeta regalo', 'nuevos datos bancarios', 'carte cadeau', 'nouvelles coordonnees bancaires', 'cartao presente', 'novos dados bancarios',
      'geschenkkarte', 'neue bankverbindung', 'подарочная карта', 'новые реквизиты', 'криптовалюта', 'криптовалюту', 'криптовалюты',
    ],
  },
  {
    key: 'content_parcel',
    points: 10,
    phrases: [
      'pacco in giacenza', 'spedizione in sospeso', 'consegna non riuscita', 'tentativo di consegna', 'spese di spedizione', 'dazi doganali', 'il tuo pacco',
      'parcel is on hold', 'delivery failed', 'delivery attempt', 'shipping fee', 'customs fee', 'your package',
      'paquete retenido', 'entrega fallida', 'colis en attente', 'echec de livraison', 'encomenda retida', 'entrega falhada',
      'paket liegt bereit', 'zustellung fehlgeschlagen', 'посылка задержана', 'доставка не удалась',
    ],
  },
  {
    key: 'content_prize_refund',
    points: 10,
    phrases: [
      'hai vinto', 'sei stato selezionato', 'rimborso disponibile', 'hai diritto a un rimborso', 'premio in denaro', 'vincitore',
      'you have won', 'you have been selected', 'refund is available', 'you are eligible for a refund', 'claim your prize', 'winner',
      'ha ganado', 'reembolso disponible', 'vous avez gagne', 'remboursement disponible', 'voce ganhou', 'reembolso disponivel',
      'sie haben gewonnen', 'ruckerstattung', 'вы выиграли', 'возврат средств',
    ],
  },
  {
    key: 'content_investment',
    points: 15,
    phrases: [
      'societa di trading', 'piattaforma di trading', 'trading online', 'il suo capitale', 'il tuo capitale', 'rendimento garantito', 'rendimenti garantiti', 'profitto garantito', 'guadagno garantito', 'trasferito al nostro broker', 'conto di trading', 'recupero fondi', 'recuperare i fondi', 'sblocco del prelievo', 'commissione di prelievo',
      'trading platform', 'trading company', 'guaranteed return', 'guaranteed profit', 'your capital', 'withdrawal fee', 'recover your funds', 'fund recovery',
      'plataforma de trading', 'rentabilidad garantizada', 'plateforme de trading', 'rendement garanti', 'plataforma de negociacao', 'retorno garantido',
      'handelsplattform', 'garantierte rendite', 'торговая платформа', 'гарантированный доход', 'вывод средств',
    ],
  },
  {
    key: 'content_secrecy',
    points: 8,
    phrases: [
      'non dirlo a nessuno', 'riservato e confidenziale', 'non condividere', 'keep this confidential', 'do not tell anyone', 'strictly confidential',
      'no se lo digas a nadie', 'strictement confidentiel', 'nao conte a ninguem', 'streng vertraulich', 'никому не сообщайте',
    ],
  },
]
// Frasi pronte per la ricerca: normalizzate come il testo (così "й" di
// "никому" coincide) e cercate come parole intere ("досрочно" non contiene
// "срочно", "Sofortüberweisung" non è "sofort").
function phraseRegex(phrase: string) {
  const escaped = normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, 'u')
}
const CONTENT_MATCHERS = CONTENT_RULES.map((rule) => ({
  key: rule.key,
  points: rule.points,
  phrases: rule.phrases.map((phrase) => ({ phrase, re: phraseRegex(phrase) })),
}))
const CREDENTIAL_MATCHERS = CONTENT_MATCHERS.find((rule) => rule.key === 'content_credentials')!.phrases

// Segnaposto di un modello di truffa dimenticati nel testo
const TEMPLATE_PLACEHOLDERS = ['tuodominio.it', 'tuodominio.com', 'yourdomain.com', 'example.com', 'dominio.it', '[nome]', '[name]', '{{', '%%name', '[cliente]', '[email]']

const GENERIC_GREETINGS = ['gentile cliente', 'caro cliente', 'gentile utente', 'dear customer', 'dear user', 'dear client', 'estimado cliente', 'cher client', 'prezado cliente', 'sehr geehrter kunde', 'уважаемый клиент'].map(phraseRegex)

// ─── Utilità ─────────────────────────────────────────────────────────────
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

export function registrableDomain(host: string): string {
  const clean = host.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  const parts = clean.split('.')
  if (parts.length <= 2) return clean
  const lastTwo = parts.slice(-2).join('.')
  if (TWO_LEVEL_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.')
  return lastTwo
}

function domainOf(address: string | null | undefined): string | null {
  if (!address) return null
  const at = address.lastIndexOf('@')
  if (at < 0) return null
  return address.slice(at + 1).trim().toLowerCase().replace(/[>\s].*$/, '') || null
}

// Ufficiale anche lo stesso nome del marchio con un suffisso nazionale o
// .com/.net/.org/.eu (amazon.nl, paypal.de, google.it), non con estensioni
// da truffa (paypal.top resta un'imitazione).
function isOfficial(domain: string, brand: (typeof BRANDS)[number]) {
  const reg = registrableDomain(domain)
  if (brand.domains.some((d) => domain === d || domain.endsWith(`.${d}`) || reg === registrableDomain(d))) return true
  const [label, ...rest] = reg.split('.')
  const tld = rest.join('.')
  const regularTld = /^[a-z]{2}$/.test(tld) || ['com', 'net', 'org', 'eu'].includes(tld) || TWO_LEVEL_SUFFIXES.has(tld)
  return regularTld && brand.domains.some((d) => registrableDomain(d).split('.')[0] === label && label.length >= 4)
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

// Dominio che imita un marchio: simile a un dominio ufficiale (paypa1.com)
// oppure con il nome del marchio dentro (paypal-sicurezza.com).
function lookalikeBrand(domain: string): (typeof BRANDS)[number] | null {
  const reg = registrableDomain(domain)
  if (FREE_MAIL.has(reg)) return null
  const label = reg.split('.')[0].replace(/0/g, 'o').replace(/1/g, 'l').replace(/rn/g, 'm')
  // Parti del nome separate da trattini: "paypal-sicurezza" -> paypal, sicurezza
  // (il marchio conta solo come parola intera: "delivery" non contiene "live")
  const tokens = label.split(/[-_]+/)
  for (const brand of BRANDS) {
    if (isOfficial(domain, brand)) continue
    for (const official of brand.domains) {
      const officialLabel = registrableDomain(official).split('.')[0]
      if (officialLabel.length < 4) continue
      // Stesso nome ma estensione da truffa (paypal.top), oppure una lettera
      // di differenza su nomi lunghi (paypa1, amazom), non su parole comuni
      const similar =
        label === officialLabel ||
        (officialLabel.length >= 6 && label.length >= 5 && !COMMON_WORDS.has(label) && levenshtein(label, officialLabel) === 1)
      const contains =
        (officialLabel.length >= 5 && tokens.length > 1 && tokens.includes(officialLabel)) ||
        (officialLabel.length >= 6 && label !== officialLabel && (label.startsWith(officialLabel) || label.endsWith(officialLabel)))
      if (similar || contains) return brand
    }
  }
  return null
}

const BRAND_MATCHERS = BRANDS.map((brand) => ({
  brand,
  words: brand.words.map(phraseRegex),
  acronyms: (brand.acronyms ?? []).map((acronym) => new RegExp(`(?:^|[^A-Za-z0-9])${acronym}(?=[^A-Za-z0-9]|$)`)),
}))

function claimedBrand(texts: string[]): (typeof BRANDS)[number] | null {
  const original = texts.join(' ')
  const hay = normalize(original)
  for (const { brand, words, acronyms } of BRAND_MATCHERS) {
    if (words.some((re) => re.test(hay)) || acronyms.some((re) => re.test(original))) return brand
  }
  return null
}

type Link = { href: string; text: string; host: string }

function extractLinks(html: string | undefined, text: string | undefined): Link[] {
  const links: Link[] = []
  const push = (href: string, label: string) => {
    try {
      const url = new URL(href.trim())
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return
      links.push({ href: url.href, text: label.trim(), host: url.hostname.toLowerCase() })
    } catch {
      // link non valido
    }
  }
  if (html) {
    // Scansione lineare dei tag <a ...>...</a> (niente espressioni che
    // possono bloccarsi su HTML costruito apposta)
    const lower = html.toLowerCase()
    let from = 0
    let examined = 0
    // Posizione del prossimo "</a" (ricordata: niente ricerche ripetute fino
    // in fondo quando le chiusure mancano)
    let nextClose = 0
    while (links.length < 500 && examined++ < 5000) {
      const start = lower.indexOf('<a', from)
      if (start < 0) break
      const next = lower.charAt(start + 2)
      const tagEnd = lower.indexOf('>', start)
      if (tagEnd < 0) break
      from = tagEnd + 1
      if (next && !/[\s>]/.test(next)) continue
      const tag = html.slice(start, Math.min(tagEnd, start + 2000))
      const href = tag.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
      if (!href) continue
      if (nextClose !== -1 && nextClose < tagEnd) nextClose = lower.indexOf('</a', tagEnd)
      const close = nextClose
      const inner = html.slice(tagEnd + 1, close < 0 ? tagEnd + 1 : Math.min(close, tagEnd + 1 + 500))
      push((href[1] ?? href[2] ?? href[3] ?? '').replace(/&amp;/g, '&'), inner.replace(/<[^<>]{0,500}>/g, ' ').replace(/&nbsp;/g, ' '))
    }
  }
  const plain = text ?? ''
  for (const match of plain.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) push(match[0], '')
  // Senza doppioni
  const seen = new Set<string>()
  return links.filter((l) => (seen.has(l.href + '|' + l.text) ? false : (seen.add(l.href + '|' + l.text), true)))
}

// Toglie i blocchi <style>/<script> con una scansione lineare
function stripBlocks(html: string, tag: string) {
  const lower = html.toLowerCase()
  let out = ''
  let from = 0
  for (;;) {
    const start = lower.indexOf(`<${tag}`, from)
    if (start < 0) break
    const end = lower.indexOf(`</${tag}`, start)
    out += html.slice(from, start) + ' '
    if (end < 0) return out
    const close = lower.indexOf('>', end)
    from = close < 0 ? html.length : close + 1
  }
  return out + html.slice(from)
}

function htmlToText(html: string) {
  return stripBlocks(stripBlocks(html, 'style'), 'script')
    .replace(/<[^<>]{0,2000}>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

// Primo Authentication-Results: quello scritto dal provider di chi ha
// ricevuto l'email (Gmail, Outlook...), l'unico di cui fidarsi.
function parseAuthResults(value: string) {
  const pick = (name: string) => value.match(new RegExp(`\\b${name}=([a-z]+)`, 'i'))?.[1]?.toLowerCase() ?? null
  return { spf: pick('spf'), dkim: pick('dkim'), dmarc: pick('dmarc') }
}

// ─── Controlli di rete (facoltativi) ─────────────────────────────────────
// Registri senza RDAP: data di creazione letta dal WHOIS ufficiale (porta 43)
const WHOIS_SERVERS: Record<string, { host: string; created: RegExp }> = {
  it: { host: 'whois.nic.it', created: /^Created:\s*(\S+)/im },
  ru: { host: 'whois.tcinet.ru', created: /^created:\s*(\S+)/im },
}

async function whoisCreated(domain: string): Promise<string | null> {
  const server = WHOIS_SERVERS[domain.split('.').pop() ?? '']
  if (!server) return null
  try {
    const net = await import('node:net')
    const text = await new Promise<string>((resolve, reject) => {
      let data = ''
      const socket = net.connect(43, server.host, () => socket.write(`${domain}\r\n`))
      socket.setTimeout(6000, () => socket.destroy(new Error('timeout')))
      socket.on('data', (chunk) => (data += chunk.toString('utf8')))
      socket.on('end', () => resolve(data))
      socket.on('error', reject)
    })
    return text.match(server.created)?.[1] ?? null
  } catch {
    return null
  }
}

async function domainAgeDays(domain: string, fetchImpl: typeof fetch): Promise<number | null> {
  const reg = registrableDomain(domain)
  let created: string | null = null
  try {
    // rdap.org rifiuta le richieste senza User-Agent
    const res = await fetchImpl(`https://rdap.org/domain/${encodeURIComponent(reg)}`, {
      headers: { accept: 'application/rdap+json', 'user-agent': 'KUMANI-CheckMail/1.0' },
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok) {
      const data = (await res.json()) as { events?: { eventAction?: string; eventDate?: string }[] }
      created = data.events?.find((e) => e.eventAction === 'registration')?.eventDate ?? null
    }
  } catch {
    // si prova il WHOIS
  }
  if (!created) created = await whoisCreated(reg)
  if (!created) return null
  const time = new Date(created).getTime()
  return Number.isFinite(time) ? Math.floor((Date.now() - time) / 86400000) : null
}

async function hasMx(domain: string, fetchImpl: typeof fetch): Promise<boolean | null> {
  try {
    const res = await fetchImpl(`https://dns.google/resolve?name=${encodeURIComponent(registrableDomain(domain))}&type=MX`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = (await res.json()) as { Status?: number }
    // Solo un dominio inesistente conta: senza MX la posta può arrivare lo
    // stesso all'indirizzo del dominio
    return data.Status === 3 ? false : true
  } catch {
    return null
  }
}

// Età del dominio del mittente e dei primi link, esistenza del dominio del
// mittente. Esportata: il sito la esegue in parallelo alla lettura con l'IA.
export async function networkFindings(summary: Verdict['summary'], fetchImpl: typeof fetch = fetch): Promise<Finding[]> {
  const found: Finding[] = []
  const fromDomain = domainOf(summary.fromAddress)
  const domains = [...new Set([fromDomain, ...summary.linkDomains.slice(0, 3)].filter((d): d is string => !!d).map(registrableDomain))]
    .filter((d) => !FREE_MAIL.has(d) && !BRANDS.some((b) => b.domains.some((o) => registrableDomain(o) === d)))
    .slice(0, 4)
  const [ages, mx] = await Promise.all([
    Promise.all(domains.map(async (d) => ({ d, age: await domainAgeDays(d, fetchImpl) }))),
    fromDomain && !FREE_MAIL.has(registrableDomain(fromDomain)) ? hasMx(fromDomain, fetchImpl) : Promise.resolve(null),
  ])
  const youngest = ages.filter((a) => a.age !== null).sort((a, b) => a.age! - b.age!)[0]
  if (youngest && youngest.age! < 30) found.push({ key: 'domain_very_new', severity: 'high', points: 30, params: { domain: youngest.d, days: youngest.age! } })
  else if (youngest && youngest.age! < 180) found.push({ key: 'domain_new', severity: 'medium', points: 10, params: { domain: youngest.d, days: youngest.age! } })
  if (mx === false && fromDomain) found.push({ key: 'sender_no_mx', severity: 'medium', points: 15, params: { domain: fromDomain } })
  return found
}

// Aggiunge segnali a un risultato e ricalcola il punteggio
export function withFindings(verdict: Verdict, extra: Finding[]): Verdict {
  if (extra.length === 0) return verdict
  const findings = [...verdict.findings, ...extra].sort((a, b) => b.points - a.points)
  return { ...verdict, findings, ...scoreFindings(findings) }
}

// Punteggio: le frasi del testo insieme non superano 35 (troppe email vere
// usano parole come "urgente"); il resto si somma fino a 100.
export function scoreFindings(findings: Finding[]): { score: number; level: RiskLevel } {
  const isContent = (f: Finding) => f.key.startsWith('content_') || f.key === 'generic_greeting'
  const technical = findings.filter((f) => !isContent(f)).reduce((sum, f) => sum + f.points, 0)
  const content = Math.min(35, findings.filter(isContent).reduce((sum, f) => sum + f.points, 0))
  const score = Math.min(100, technical + content)
  return { score, level: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low' }
}

// ─── Analisi ─────────────────────────────────────────────────────────────
export async function analyzeEmail(input: CheckMailInput, options: CheckMailOptions = {}): Promise<Verdict> {
  const findings: Finding[] = []
  const add = (key: string, severity: Severity, points: number, params?: Finding['params']) => findings.push({ key, severity, points, params })

  let fromAddress: string | null = null
  let fromName: string | null = null
  let subject: string | null = input.subject ?? null
  let html: string | undefined
  let text: string | undefined = input.text
  let hasHeaders = false
  let replyTo: string | null = null
  let returnPath: string | null = null
  let authResults: string | null = null
  let attachments: { filename: string | null; mimeType: string }[] = []

  // Sorgente vero solo se la prima riga è un'intestazione e ce n'è almeno una
  // tipica delle email; altrimenti è testo incollato ("Oggetto: ..." compreso)
  const head = typeof input.raw === 'string' ? input.raw.slice(0, 8000) : input.raw ? new TextDecoder('latin1').decode(input.raw.slice(0, 8000)) : ''
  const firstLine = head.split(/\r?\n/).find((line) => line.trim()) ?? ''
  const looksLikeSource =
    /^[\w-]+:/.test(firstLine) && /^(from|received|return-path|message-id|delivered-to|mime-version|authentication-results|dkim-signature):/im.test(head)
  let parsed = false
  if (input.raw && looksLikeSource) {
    const email = await PostalMime.parse(input.raw)
    parsed = true
    hasHeaders = email.headers.some((h) => ['received', 'authentication-results', 'return-path', 'message-id'].includes(h.key))
    if (email.from && 'address' in email.from && email.from.address) {
      fromAddress = email.from.address.toLowerCase()
      fromName = email.from.name || null
    }
    subject = email.subject ?? subject
    html = email.html
    text = email.text ?? text
    const firstReply = email.replyTo?.find((a) => 'address' in a && a.address)
    replyTo = firstReply && 'address' in firstReply ? (firstReply.address ?? null) : null
    returnPath = email.returnPath ?? null
    authResults = email.headers.find((h) => h.key === 'authentication-results')?.value ?? null
    // Immagini inline del corpo (logo con Content-ID) non sono allegati
    attachments = email.attachments
      .filter((a) => a.disposition === 'attachment' || (!a.contentId && a.disposition !== 'inline' && a.filename))
      .map((a) => ({ filename: a.filename, mimeType: a.mimeType }))
    if (!email.html && !email.text && !hasHeaders) parsed = false
  }
  if (input.raw && !parsed) {
    text = typeof input.raw === 'string' ? input.raw : new TextDecoder('utf-8').decode(input.raw)
  }
  // Tetto al testo analizzato (le email vere stanno ben sotto)
  if (html && html.length > 300_000) html = html.slice(0, 300_000)
  if (text && text.length > 300_000) text = text.slice(0, 300_000)
  if (!fromAddress && input.sender) {
    // "support@paypal.com" <x@evil.com>: il mittente vero è x@evil.com
    const angle = input.sender.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/)
    const bare = input.sender.match(/[^\s<>"]+@[^\s<>"]+/)
    fromAddress = (angle?.[1] ?? bare?.[0] ?? '').toLowerCase() || null
    fromName = input.sender.replace(/<[^<>]*>/g, '').replace(/["']/g, '').trim() || null
    if (!angle && fromName && fromName.toLowerCase() === fromAddress) fromName = null
  }

  const fromDomain = domainOf(fromAddress)
  // Intestazioni presenti ma mittente senza indirizzo ("Servizio Hosting <>")
  if (hasHeaders && !fromAddress) add('sender_missing', 'medium', 20)
  const bodyText = [text ?? '', html ? htmlToText(html) : ''].join(' ')
  const links = extractLinks(html, text)
  const linkHosts = [...new Set(links.map((l) => l.host))]

  // 1. Autenticazione (SPF / DKIM / DMARC scritti dal provider di chi riceve)
  if (authResults) {
    const auth = parseAuthResults(authResults)
    if (auth.dmarc === 'fail') add('auth_dmarc_fail', 'high', 35)
    else if ((auth.spf === 'fail' || auth.spf === 'softfail') && auth.dkim !== 'pass') add('auth_spf_dkim_fail', 'medium', 20)
    else if (auth.dkim === 'fail' && auth.spf !== 'pass') add('auth_dkim_fail', 'medium', 20, { domain: authResults.match(/header\.d=([^\s;]+)/i)?.[1] ?? '-' })
    else if (auth.dkim === 'pass' || auth.spf === 'pass') add('auth_ok', 'info', 0, { spf: auth.spf ?? '-', dkim: auth.dkim ?? '-', dmarc: auth.dmarc ?? '-' })
  } else if (!hasHeaders) {
    add('no_headers', 'info', 0)
  }

  // 2. Chi dice di essere e chi è davvero
  const brand = claimedBrand([fromName ?? '', subject ?? '', bodyText.slice(0, 3000)])
  const brandInNameOrSubject = claimedBrand([fromName ?? '', subject ?? ''])
  if (fromDomain) {
    if (brandInNameOrSubject && !isOfficial(fromDomain, brandInNameOrSubject)) {
      if (FREE_MAIL.has(registrableDomain(fromDomain))) add('brand_from_freemail', 'high', 40, { brand: brandInNameOrSubject.name, domain: fromDomain })
      else add('brand_domain_mismatch', 'high', 30, { brand: brandInNameOrSubject.name, domain: fromDomain })
    }
    const look = lookalikeBrand(fromDomain)
    if (look) add('lookalike_sender', 'high', 35, { brand: look.name, domain: fromDomain })
    if (fromDomain.includes('xn--')) add('idn_sender', 'medium', 20, { domain: fromDomain })
    if (fromName && /@/.test(fromName)) {
      const nameDomain = domainOf(fromName.match(/[^\s<>"]+@[^\s<>"]+/)?.[0])
      if (nameDomain && registrableDomain(nameDomain) !== registrableDomain(fromDomain)) add('display_name_address', 'high', 25, { shown: nameDomain, real: fromDomain })
    }
  }

  // 3. Rispondi a / mittente tecnico diversi
  if (fromDomain && replyTo) {
    const replyDomain = domainOf(replyTo)
    if (replyDomain && registrableDomain(replyDomain) !== registrableDomain(fromDomain)) {
      add('reply_to_mismatch', FREE_MAIL.has(registrableDomain(replyDomain)) ? 'high' : 'medium', FREE_MAIL.has(registrableDomain(replyDomain)) ? 25 : 10, { from: fromDomain, replyTo: replyDomain })
    }
  }
  void returnPath // i servizi di invio legittimi usano spesso un Return-Path diverso: non conta

  // 4. Link
  const mismatches = new Set<string>()
  for (const link of links) {
    if (CLICK_TRACKERS.has(registrableDomain(link.host)) || CLICK_TRACKERS.has(link.host)) continue
    const label = link.text.replace(/\s+/g, ' ').trim()
    if (!label || label.length > 200) continue
    // Il testo deve essere un indirizzo intero ("www.poste.it", "https://...")
    const shown = label.match(/^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/?#:]\S*)?$/i)?.[1]?.toLowerCase()
    if (!shown || FILE_EXT.has(shown.split('.').pop() ?? '')) continue
    if (registrableDomain(shown) === registrableDomain(link.host)) continue
    // Due domini ufficiali dello stesso marchio (paypal.me -> paypal.com)
    if (BRANDS.some((b) => isOfficial(shown, b) && isOfficial(link.host, b))) continue
    mismatches.add(`${shown} → ${link.host}`)
  }
  if (mismatches.size > 0) add('link_text_mismatch', 'high', 25, { example: [...mismatches][0] })
  if (linkHosts.some((h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h))) add('link_ip', 'high', 25)
  const shorteners = linkHosts.filter((h) => SHORTENERS.has(registrableDomain(h)))
  if (shorteners.length > 0) add('link_shortener', 'medium', 10, { domain: shorteners[0] })
  const risky = linkHosts.filter((h) => RISKY_TLDS.has(h.split('.').pop() ?? ''))
  if (risky.length > 0) add('link_risky_tld', 'medium', 10, { domain: risky[0] })
  const lookLinks = linkHosts.map((h) => ({ h, b: lookalikeBrand(h) })).filter((x) => x.b)
  if (lookLinks.length > 0) add('lookalike_link', 'high', 30, { brand: lookLinks[0].b!.name, domain: lookLinks[0].h })
  if (linkHosts.some((h) => h.includes('xn--'))) add('idn_link', 'medium', 15)
  if (brand && links.length > 0 && !linkHosts.some((h) => isOfficial(h, brand))) {
    const normalizedBody = normalize(bodyText)
    const credentialAsk = CREDENTIAL_MATCHERS.some((m) => m.re.test(normalizedBody))
    if (credentialAsk) add('brand_links_offsite', 'high', 20, { brand: brand.name, domain: linkHosts[0] })
  }

  // 5. Allegati
  for (const attachment of attachments) {
    const name = (attachment.filename ?? '').toLowerCase()
    const ext = name.includes('.') ? name.split('.').pop()! : ''
    const doubleExt = /\.(pdf|doc|docx|jpg|png|txt)\.[a-z0-9]{2,4}$/i.test(name)
    if (DANGEROUS_EXT.has(ext) || doubleExt) add('attachment_dangerous', 'high', 35, { name: attachment.filename ?? '' })
    else if (ext === 'html' || ext === 'htm' || attachment.mimeType === 'text/html') add('attachment_html', 'high', 30, { name: attachment.filename ?? '' })
    else if (ARCHIVE_EXT.has(ext)) add('attachment_archive', 'medium', 10, { name: attachment.filename ?? '' })
  }

  // 6. Contenuto
  const normalized = normalize(`${subject ?? ''} ${bodyText}`)
  for (const rule of CONTENT_MATCHERS) {
    const hit = rule.phrases.find((p) => p.re.test(normalized))
    if (hit) add(rule.key, 'medium', rule.points, { phrase: hit.phrase })
  }
  if (GENERIC_GREETINGS.some((re) => re.test(normalized))) add('generic_greeting', 'low', 5)
  // Parole con lettere latine e cirilliche/greche mescolate ("Рuоі ассеdеrе"):
  // trucco per ingannare i filtri, non capita nei testi veri
  // (solo lettere cirilliche uguali a quelle latine: "SMSки" o "50 μg" non contano)
  const mixedWords = (`${subject ?? ''} ${bodyText}`.match(/[\p{L}]+/gu) ?? []).filter((word) => {
    const latin = (word.match(/[a-z]/gi) ?? []).length
    const cyrillic = word.match(/[\u0400-\u04ff]/g) ?? []
    return latin > 0 && cyrillic.length > 0 && latin >= cyrillic.length && cyrillic.every((c) => HOMOGLYPHS.has(c))
  })
  if (mixedWords.length >= 2) add('mixed_script', 'high', 30, { example: mixedWords[0] })
  const placeholder = TEMPLATE_PLACEHOLDERS.find((t) => normalized.includes(t))
  if (placeholder) add('template_placeholder', 'medium', 15, { text: placeholder })

  // Minaccia o richiesta di dati/pagamento + link verso siti che non c'entrano
  // con il mittente (né suoi, né di un servizio di newsletter)
  const pressure = findings.some((f) => ['content_account_threat', 'content_credentials', 'content_payment_pressure', 'content_parcel'].includes(f.key))
  const fromReg = fromDomain ? registrableDomain(fromDomain) : null
  const foreignLinks = linkHosts.filter((h) => {
    const reg = registrableDomain(h)
    return reg !== fromReg && !CLICK_TRACKERS.has(reg) && !CLICK_TRACKERS.has(h) && !['googleapis.com', 'gstatic.com', 'w3.org'].includes(reg)
  })
  const ownLinks = linkHosts.filter((h) => fromReg && registrableDomain(h) === fromReg)
  if (pressure && fromReg && foreignLinks.length > 0 && ownLinks.length === 0) add('pressure_foreign_link', 'high', 25, { domain: foreignLinks[0] })

  // 7. Rete (facoltativa): età dei domini ed esistenza del mittente
  if (options.network) {
    findings.push(
      ...(await networkFindings(
        { fromAddress, fromName, subject, linkDomains: linkHosts.slice(0, 10), hasHeaders, attachmentNames: [] },
        options.fetchImpl ?? fetch
      ))
    )
  }

  const { score, level } = scoreFindings(findings)

  return {
    score,
    level,
    findings: findings.sort((a, b) => b.points - a.points),
    summary: {
      fromAddress,
      fromName,
      subject,
      linkDomains: linkHosts.slice(0, 10),
      hasHeaders,
      attachmentNames: attachments.map((a) => a.filename ?? '').filter(Boolean).slice(0, 10),
    },
    textSample: bodyText.replace(/\s+/g, ' ').trim().slice(0, 6000),
  }
}

// ─── Spiegazioni in italiano (per la prova; nel sito andranno tradotte) ───
export function explainIt(finding: Finding): string {
  const p = finding.params ?? {}
  switch (finding.key) {
    case 'auth_dmarc_fail': return 'Il tuo provider segnala che il mittente NON è autentico (DMARC fallito).'
    case 'auth_spf_dkim_fail': return 'Il server che ha spedito l\'email non è autorizzato dal dominio del mittente (SPF/DKIM falliti).'
    case 'auth_ok': return `Autenticazione del mittente superata (SPF ${p.spf}, DKIM ${p.dkim}, DMARC ${p.dmarc}): conferma solo il dominio, non che sia affidabile.`
    case 'no_headers': return 'Mancano le intestazioni tecniche: analisi parziale (incolla il sorgente completo per un controllo migliore).'
    case 'brand_from_freemail': return `Dice di essere ${p.brand} ma scrive da un indirizzo gratuito (${p.domain}).`
    case 'brand_domain_mismatch': return `Dice di essere ${p.brand} ma il dominio del mittente (${p.domain}) non è uno di quelli ufficiali.`
    case 'lookalike_sender': return `Il dominio del mittente (${p.domain}) imita quello di ${p.brand}.`
    case 'idn_sender': return `Il dominio del mittente usa caratteri speciali che possono imitare lettere normali (${p.domain}).`
    case 'display_name_address': return `Il nome mostrato contiene un indirizzo (${p.shown}) diverso da quello vero (${p.real}).`
    case 'reply_to_mismatch': return `Le risposte andrebbero a un altro dominio (${p.replyTo}) invece che a ${p.from}.`
    case 'link_text_mismatch': return `Un link mostra un indirizzo ma porta altrove (${p.example}).`
    case 'link_ip': return 'Un link porta a un indirizzo numerico (IP) invece che a un sito con nome.'
    case 'link_shortener': return `Un link è accorciato (${p.domain}) e nasconde la destinazione reale.`
    case 'link_risky_tld': return `Un link porta a un dominio con estensione spesso usata nelle truffe (${p.domain}).`
    case 'lookalike_link': return `Un link porta a un dominio che imita ${p.brand} (${p.domain}).`
    case 'idn_link': return 'Un link usa caratteri speciali che possono imitare un sito conosciuto.'
    case 'brand_links_offsite': return `Chiede i tuoi dati a nome di ${p.brand} ma i link portano fuori dai siti ufficiali (${p.domain}).`
    case 'attachment_dangerous': return `Allegato pericoloso (${p.name}): non aprirlo.`
    case 'attachment_html': return `Allegato pagina web (${p.name}): spesso è un falso modulo di accesso.`
    case 'attachment_archive': return `Allegato compresso (${p.name}): può nascondere file pericolosi.`
    case 'content_account_threat': return `Minaccia di blocco o sospensione dell'account ("${p.phrase}").`
    case 'content_urgency': return `Mette fretta ("${p.phrase}").`
    case 'content_credentials': return `Chiede di inserire o confermare dati personali o di accesso ("${p.phrase}").`
    case 'content_payment_pressure': return `Chiede pagamenti insoliti o nuove coordinate bancarie ("${p.phrase}").`
    case 'content_parcel': return `Parla di un pacco da sbloccare o spese di spedizione ("${p.phrase}").`
    case 'content_prize_refund': return `Promette premi o rimborsi ("${p.phrase}").`
    case 'content_secrecy': return `Chiede segretezza ("${p.phrase}").`
    case 'auth_dkim_fail': return `La firma digitale del mittente non è valida (DKIM fallito per ${p.domain}): l'email potrebbe essere falsificata.`
    case 'sender_missing': return 'Il mittente non ha un indirizzo email: le comunicazioni vere lo hanno sempre.'
    case 'mixed_script': return `Nel testo ci sono lettere di alfabeti diversi mescolate per ingannare i filtri antispam (es. "${p.example}").`
    case 'content_investment': return `Parla di investimenti, trading o rendimenti ("${p.phrase}"): tipico delle truffe finanziarie.`
    case 'template_placeholder': return `Contiene un segnaposto dimenticato di un modello ("${p.text}"): email fatta in serie.`
    case 'pressure_foreign_link': return `Ti mette sotto pressione ma il link porta a un sito che non c'entra con il mittente (${p.domain}).`
    case 'generic_greeting': return 'Saluto generico ("Gentile cliente"): chi ti conosce usa il tuo nome.'
    case 'domain_very_new': return `Il dominio ${p.domain} è stato registrato solo ${p.days} giorni fa.`
    case 'domain_new': return `Il dominio ${p.domain} è recente (${p.days} giorni).`
    case 'sender_no_mx': return `Il dominio del mittente (${p.domain}) non può ricevere email: indirizzo usa e getta o falso.`
    default: return finding.key
  }
}

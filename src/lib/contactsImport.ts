// Rubrica di MemoLife: lettura dei file esportati dai telefoni e dai
// programmi di posta (vCard .vcf e CSV di Google, Outlook o Excel) ed
// esportazione in vCard. Solo funzioni pure: usate nel browser e sul server.

export type ImportedContact = { name: string; phone: string; email: string; company: string; notes: string }

const LIMITS = { name: 120, phone: 40, email: 200, company: 120, notes: 2000 }

export function cleanContact(c: Partial<ImportedContact>): ImportedContact | null {
  const pick = (v: string | undefined, max: number) => (v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  const contact = {
    name: pick(c.name, LIMITS.name),
    phone: pick(c.phone, LIMITS.phone),
    email: pick(c.email, LIMITS.email).toLowerCase(),
    company: pick(c.company, LIMITS.company),
    notes: (c.notes ?? '').trim().slice(0, LIMITS.notes),
  }
  // Senza nome si usa l'azienda, poi l'email o il telefono
  if (!contact.name) contact.name = contact.company || contact.email || contact.phone
  if (!contact.name) return null
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) contact.email = ''
  return contact
}

// Chiavi per riconoscere lo stesso contatto: ultime 9 cifre del telefono
// (con o senza +39 / 0039) ed email in minuscolo
export function phoneKey(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 6 ? digits.slice(-9) : ''
}
export function emailKey(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

// ---------- vCard (.vcf) ----------

function decodeQuotedPrintable(value: string): string {
  const bytes: number[] = []
  const text = value.replace(/=\r?\n/g, '')
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      bytes.push(...new TextEncoder().encode(text[i]))
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
}

const unescapeVcard = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')

export function parseVcf(text: string): ImportedContact[] {
  // Righe che continuano (spazio o tab all'inizio) e righe quoted-printable spezzate
  const unfolded = text.replace(/\r\n/g, '\n').replace(/=\n/g, '=\u0000').replace(/\n[ \t]/g, '').replace(/=\u0000/g, '=\n')
  const out: ImportedContact[] = []
  let card: { fn?: string; n?: string; tel: { value: string; pref: boolean }[]; email: string[]; org?: string; note?: string } | null = null
  for (const raw of unfolded.split('\n')) {
    const line = raw.trimEnd()
    if (/^BEGIN:VCARD/i.test(line)) {
      card = { tel: [], email: [] }
      continue
    }
    if (/^END:VCARD/i.test(line)) {
      if (card) {
        const [last = '', first = '', middle = '', prefix = '', suffix = ''] = (card.n ?? '').split(';')
        const fromN = [prefix, first, middle, last, suffix].map((s) => s.trim()).filter(Boolean).join(' ')
        const tel = card.tel.find((t) => t.pref) ?? card.tel[0]
        const contact = cleanContact({ name: card.fn || fromN, phone: tel?.value, email: card.email[0], company: card.org, notes: card.note })
        if (contact) out.push(contact)
      }
      card = null
      continue
    }
    if (!card) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const head = line.slice(0, colon)
    let value = line.slice(colon + 1)
    const params = head.split(';')
    const prop = params[0].replace(/^item\d+\./i, '').toUpperCase()
    if (params.some((p) => /ENCODING=QUOTED-PRINTABLE/i.test(p) || /^QUOTED-PRINTABLE$/i.test(p))) value = decodeQuotedPrintable(value)
    value = unescapeVcard(value).trim()
    if (!value) continue
    if (prop === 'FN') card.fn = value
    else if (prop === 'N') card.n = value
    else if (prop === 'TEL') card.tel.push({ value: value.replace(/^tel:/i, ''), pref: params.some((p) => /CELL|PREF|MOBILE/i.test(p)) })
    else if (prop === 'EMAIL') card.email.push(value)
    else if (prop === 'ORG') card.org = value.split(';')[0]
    else if (prop === 'NOTE') card.note = value
  }
  return out
}

// ---------- CSV (Google, Outlook, Excel) ----------

function parseCsvRows(text: string): string[][] {
  const body = text.replace(/^\uFEFF/, '')
  const firstLine = body.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const norm = (h: string) => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]/gu, '')

// Colonne riconosciute (nomi in più lingue e dei principali programmi)
const COLUMNS: Record<keyof ImportedContact | 'first' | 'last', string[]> = {
  name: ['name', 'nome', 'fullname', 'nomecompleto', 'displayname', 'nom', 'nombre', 'имя'],
  first: ['firstname', 'givenname', 'nomeproprio', 'prenom', 'vorname', 'primernombre', 'primeironome'],
  last: ['lastname', 'familyname', 'surname', 'cognome', 'nomdefamille', 'apellido', 'apellidos', 'nachname', 'sobrenome', 'apelido', 'фамилия'],
  phone: ['phone', 'telefono', 'tel', 'cellulare', 'mobile', 'mobilephone', 'phone1value', 'cellulari', 'businessphone', 'homephone', 'telephone', 'telefon', 'telemovel', 'телефон', 'primaryphone'],
  email: ['email', 'mail', 'emailaddress', 'email1value', 'posta', 'courriel', 'correo', 'correoelectronico'],
  company: ['company', 'azienda', 'organization', 'organizationname', 'organization1name', 'societa', 'ditta', 'entreprise', 'empresa', 'firma', 'компания'],
  notes: ['notes', 'note', 'notas', 'notizen', 'заметки'],
}

export function parseCsv(text: string): ImportedContact[] {
  const rows = parseCsvRows(text)
  if (rows.length < 2) return []
  const header = rows[0].map(norm)
  const find = (keys: string[]) => header.findIndex((h) => keys.includes(h))
  // Telefono: la prima colonna «telefono» non vuota della riga
  const phoneCols = header.map((h, i) => (COLUMNS.phone.includes(h) || /^phone\d+value$/.test(h) ? i : -1)).filter((i) => i >= 0)
  const idx = { name: find(COLUMNS.name), first: find(COLUMNS.first), last: find(COLUMNS.last), email: find(COLUMNS.email), company: find(COLUMNS.company), notes: find(COLUMNS.notes) }
  const at = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')
  const out: ImportedContact[] = []
  for (const row of rows.slice(1)) {
    // «Nome» può essere il nome completo oppure solo il nome proprio accanto a «Cognome»
    const base = at(row, idx.name) || at(row, idx.first)
    const last = at(row, idx.last)
    const name = last && !base.toLowerCase().includes(last.toLowerCase()) ? [base, last].filter(Boolean).join(' ') : base
    // Google mette più numeri nella stessa cella separati da « ::: »
    const phone = phoneCols.map((i) => at(row, i)).find(Boolean)?.split(':::')[0] ?? ''
    const email = at(row, idx.email).split(':::')[0]
    const contact = cleanContact({ name, phone, email, company: at(row, idx.company), notes: at(row, idx.notes) })
    if (contact) out.push(contact)
  }
  return out
}

export function parseContactsFile(name: string, text: string): ImportedContact[] {
  return /\.vcf$/i.test(name) || /BEGIN:VCARD/i.test(text.slice(0, 2000)) ? parseVcf(text) : parseCsv(text)
}

// ---------- Esportazione vCard 3.0 ----------

const escapeVcard = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

export function toVcf(contacts: { name: string; phone: string | null; email: string | null; company: string | null; notes: string | null }[]): string {
  return contacts
    .map((c) => {
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVcard(c.name)}`, `N:;${escapeVcard(c.name)};;;`]
      if (c.phone) lines.push(`TEL;TYPE=CELL:${escapeVcard(c.phone)}`)
      if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVcard(c.email)}`)
      if (c.company) lines.push(`ORG:${escapeVcard(c.company)}`)
      if (c.notes) lines.push(`NOTE:${escapeVcard(c.notes)}`)
      lines.push('END:VCARD')
      return lines.join('\r\n')
    })
    .join('\r\n')
}

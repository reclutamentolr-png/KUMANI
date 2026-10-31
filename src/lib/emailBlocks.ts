// Email delle Comunicazioni con grafica («Rivista» e «Lettera»): il testo si
// scrive con pochi segni semplici, uguali in tutte le lingue, e diventa a
// blocchi. Le email «Classica» restano testo semplice (adminCommunications).
//
//   @ Le novità · Ottobre     etichetta della testata (in alto)
//   Ciao {nome},              prima del primo titolo: apertura (saluto + testo)
//   ## Da oggi aperto         etichetta piccola sopra il titolo che segue
//   # Titolo                  nuova sezione; «#* Titolo» = sezione scura
//   - testo                   elenco puntato
//   -- NOME | testo           griglia a due colonne (es. strumenti)
//   [Testo](https://…)        pulsante (da solo su una riga)
//   > testo                   riquadro in evidenza
//   !! +10 | testo            numero grande (più righe di fila = affiancati)
//   ~ Nome | Ruolo            firma
//   **parola**                grassetto, ovunque

import { escapeHtml } from '@/lib/email'

export type EmailLayout = 'classic' | 'rivista' | 'lettera' | 'halloween'
export const EMAIL_LAYOUTS: EmailLayout[] = ['classic', 'rivista', 'lettera', 'halloween']
export const isEmailLayout = (v: unknown): v is EmailLayout => typeof v === 'string' && (EMAIL_LAYOUTS as string[]).includes(v)

export type Block =
  | { t: 'p'; text: string }
  | { t: 'list'; items: string[] }
  | { t: 'grid'; items: { name: string; text: string }[] }
  | { t: 'button'; label: string; url: string }
  | { t: 'box'; text: string }
  | { t: 'stats'; items: { value: string; text: string }[] }

export type Section = { eyebrow: string | null; title: string; dark: boolean; blocks: Block[] }
export type ParsedEmail = { label: string | null; greeting: string | null; intro: Block[]; sections: Section[]; signature: { name: string; role: string } | null }

const pipe = (s: string) => {
  const i = s.indexOf('|')
  return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()]
}

export function parseEmailBody(body: string): ParsedEmail {
  const out: ParsedEmail = { label: null, greeting: null, intro: [], sections: [], signature: null }
  let current: Block[] = out.intro
  let eyebrow: string | null = null
  let para: string[] = []
  const flush = () => {
    if (para.length) current.push({ t: 'p', text: para.join('\n') })
    para = []
  }
  const last = () => current[current.length - 1]
  const lines = body.replace(/\r/g, '').split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    let m: RegExpMatchArray | null
    if ((m = line.match(/^@\s+(.+)$/))) {
      flush()
      out.label = m[1]
    } else if (!out.greeting && !out.sections.length && !out.intro.length && !para.length && /,$/.test(line) && line.length < 60 && !/^[#\-[>!~@]/.test(line)) {
      out.greeting = line
    } else if ((m = line.match(/^##\s+(.+)$/))) {
      flush()
      eyebrow = m[1]
    } else if ((m = line.match(/^#(\*)?\s+(.+)$/))) {
      flush()
      const section: Section = { eyebrow, title: m[2], dark: !!m[1], blocks: [] }
      eyebrow = null
      out.sections.push(section)
      current = section.blocks
    } else if ((m = line.match(/^--\s+(.+)$/))) {
      flush()
      const [name, text] = pipe(m[1])
      const prev = last()
      if (prev?.t === 'grid') prev.items.push({ name, text })
      else current.push({ t: 'grid', items: [{ name, text }] })
    } else if ((m = line.match(/^-\s+(.+)$/))) {
      flush()
      const prev = last()
      if (prev?.t === 'list') prev.items.push(m[1])
      else current.push({ t: 'list', items: [m[1]] })
    } else if ((m = line.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/))) {
      flush()
      current.push({ t: 'button', label: m[1], url: m[2] })
    } else if ((m = line.match(/^>\s*(.+)$/))) {
      flush()
      const prev = last()
      if (prev?.t === 'box') prev.text += '\n' + m[1]
      else current.push({ t: 'box', text: m[1] })
    } else if ((m = line.match(/^!!\s+(.+)$/))) {
      flush()
      const [value, text] = pipe(m[1])
      const prev = last()
      if (prev?.t === 'stats') prev.items.push({ value, text })
      else current.push({ t: 'stats', items: [{ value, text }] })
    } else if ((m = line.match(/^~\s+(.+)$/))) {
      flush()
      const [name, role] = pipe(m[1])
      out.signature = { name, role }
    } else {
      para.push(line)
    }
  }
  flush()
  return out
}

// Testo semplice (per chi legge le email senza grafica e per la pagina del messaggio)
export function emailBodyToText(body: string): string {
  const p = parseEmailBody(body)
  const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1')
  const blocks = (list: Block[]) =>
    list
      .map((b) =>
        b.t === 'p' ? plain(b.text)
        : b.t === 'list' ? b.items.map((i) => `• ${plain(i)}`).join('\n')
        : b.t === 'grid' ? b.items.map((i) => `• ${plain(i.name)}: ${plain(i.text)}`).join('\n')
        : b.t === 'button' ? `${b.label}: ${b.url}`
        : b.t === 'box' ? plain(b.text)
        : b.items.map((i) => `${i.value} — ${plain(i.text)}`).join('\n'),
      )
      .join('\n\n')
  const parts = [p.greeting, blocks(p.intro), ...p.sections.map((s) => `${s.title.toUpperCase()}\n${blocks(s.blocks)}`), p.signature ? `${p.signature.name}\n${p.signature.role}` : null]
  return parts.filter(Boolean).join('\n\n')
}

// ---- HTML per le email (tabelle e stili in linea: le caselle di posta non leggono altro)

const SERIF = "Georgia,'Times New Roman',serif"
const SANS = 'Arial,Helvetica,sans-serif'
const GOLD = '#d4af37'
const GOLD_SOFT = '#f0d27a'
const GOLD_TEXT = '#a8841f'
const INK = '#171717'

// Colori della grafica: oro KUMANI, oppure zucca e notte per Halloween
type Palette = { accent: string; soft: string; text: string; ink: string; page: string; paper: string; border: string; stat: string; box: string; boxDark: string; muted: string }
const GOLD_PAL: Palette = { accent: GOLD, soft: GOLD_SOFT, text: GOLD_TEXT, ink: INK, page: '#efebe3', paper: '#fffdf8', border: '#eadfbf', stat: '#f6ecd0', box: '#fbf3dc', boxDark: '#262626', muted: '#a8a29e' }
const HALLOWEEN_PAL: Palette = { accent: '#f97316', soft: '#fdba74', text: '#c2410c', ink: '#1c1229', page: '#2a1d3a', paper: '#fff9f2', border: '#fbd5b0', stat: '#ffedd5', box: '#fff1e2', boxDark: '#2e2040', muted: '#b9a9cc' }

// Grassetto e link dentro il testo (già protetto)
const inline = (s: string, onDark = false, c: Palette = GOLD_PAL) =>
  escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, `<b style="color:${onDark ? '#ffffff' : c.ink}">$1</b>`)
    .replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${onDark ? c.soft : c.text}">$1</a>`)
    .replace(/\n/g, '<br>')

const table = (inner: string, style = '') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${style}">${inner}</table>`

type Theme = { dark: boolean; letter: boolean; c?: Palette }

function renderBlocks(blocks: Block[], th: Theme): string {
  const c = th.c ?? GOLD_PAL
  const text = th.dark ? '#cfcac0' : '#44403c'
  const size = th.letter ? '15px;line-height:24px' : '15px;line-height:23px'
  return blocks
    .map((b) => {
      if (b.t === 'p') return `<p style="margin:0 0 14px;font-family:${SANS};font-size:${size};color:${text}">${inline(b.text, th.dark, c)}</p>`
      if (b.t === 'list')
        return table(
          b.items
            .map((i) => `<tr><td width="24" valign="top" style="padding:0 0 10px;color:${c.accent};font-size:15px;font-family:${SANS}">◆</td><td valign="top" style="padding:0 0 10px;font-family:${SANS};font-size:14px;line-height:21px;color:${text}">${inline(i, th.dark, c)}</td></tr>`)
            .join(''),
          'margin:0 0 6px',
        )
      if (b.t === 'grid') {
        const cell = (i: { name: string; text: string }, left: boolean) =>
          `<td width="50%" valign="top" style="padding:0 ${left ? '6px' : '0'} 12px ${left ? '0' : '6px'};font-family:${SANS};font-size:13px;line-height:19px;color:${th.dark ? '#e7e2d6' : text}"><b style="color:${th.dark ? c.soft : c.text}">${inline(i.name, th.dark, c)}</b><br>${inline(i.text, th.dark, c)}</td>`
        const rows: string[] = []
        for (let i = 0; i < b.items.length; i += 2) rows.push(`<tr>${cell(b.items[i], true)}${b.items[i + 1] ? cell(b.items[i + 1], false) : '<td width="50%"></td>'}</tr>`)
        return table(rows.join(''), 'margin:0 0 4px')
      }
      if (b.t === 'button') {
        const filled = th.dark ? `background:${c.accent};` : `background:${c.ink};`
        const color = th.dark ? c.ink : c.soft
        return table(`<tr><td style="padding:4px 0 6px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="${filled}border-radius:${th.letter ? '6px' : '999px'}"><a href="${escapeHtml(b.url)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:14px;font-weight:bold;color:${color};text-decoration:none">${escapeHtml(b.label)} →</a></td></tr></table></td></tr>`)
      }
      if (b.t === 'box')
        return table(`<tr><td style="background:${th.dark ? c.boxDark : c.box};border-left:4px solid ${c.accent};border-radius:10px;padding:14px 16px;font-family:${SANS};font-size:14px;line-height:22px;color:${th.dark ? '#e7e2d6' : '#3f3a33'}">${inline(b.text, th.dark, c)}</td></tr>`, 'margin:0 0 14px')
      // Numeri grandi affiancati (al massimo tre per riga)
      const w = Math.floor(100 / Math.min(3, b.items.length))
      const cells = b.items
        .slice(0, 3)
        .map((i, k) => `<td width="${w}%" valign="top" style="padding:0 ${k < b.items.length - 1 ? '6px' : '0'} 0 ${k > 0 ? '6px' : '0'}">${table(`<tr><td style="background:${c.stat};border-radius:14px;padding:18px"><p style="margin:0;font-family:${SERIF};font-size:38px;line-height:42px;color:${c.ink}">${escapeHtml(i.value)}</p><p style="margin:6px 0 0;font-family:${SANS};font-size:13px;line-height:19px;color:#57534e">${inline(i.text, false, c)}</p></td></tr>`)}</td>`)
        .join('')
      return table(`<tr>${cells}</tr>`, 'margin:0 0 12px')
    })
    .join('')
}

export type EmailFrame = { preheader: string; unsubUrl: string; siteUrl: string; openLabel: string; why: string; stop: string; pushNote: string; locale: string; subject: string }

const logo = (siteUrl: string, size: number) => `<img src="${siteUrl}/brand/logo-gold-hd.png" width="${size}" height="${size}" alt="KUMANI" style="display:block;border:0">`
const kumi = (siteUrl: string, size: number) => `<img src="${siteUrl}/deck/kumi.png" width="${size}" alt="KUMI" style="display:block;border:0;width:${size}px;height:auto">`
const footer = (f: EmailFrame, color: string) =>
  `${escapeHtml(f.why)} <a href="${f.unsubUrl}" style="color:${color}">${escapeHtml(f.stop)}</a> (${escapeHtml(f.pushNote)}).`

// «Rivista»: testata scura con KUMI, ogni sezione in una scheda
export function renderRivista(p: ParsedEmail, f: EmailFrame, c: Palette = GOLD_PAL, deco = ''): string {
  const site = f.siteUrl.replace(/^https?:\/\//, '')
  const [lead, ...rest] = p.intro
  const sections = p.sections
    .map((s) => {
      const th = { dark: s.dark, letter: false, c }
      const head = `${s.eyebrow ? `<p style="margin:0 0 6px;font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:2px;color:${s.dark ? c.accent : c.text};text-transform:uppercase">${escapeHtml(s.eyebrow)}</p>` : ''}<p style="margin:0 0 12px;font-family:${SERIF};font-size:24px;line-height:30px;color:${s.dark ? '#ffffff' : c.ink}">${escapeHtml(s.title)}</p>`
      const style = s.dark ? `background:${c.ink};border-radius:16px;padding:22px 22px 12px` : `background:#ffffff;border:1px solid ${c.border};border-radius:16px;padding:22px 22px 12px`
      return table(`<tr><td style="${style}">${head}${renderBlocks(s.blocks, th)}</td></tr>`, 'margin:16px 0 0')
    })
    .join('')
  const sign = p.signature
    ? `<p style="margin:6px 0 0;font-family:${SERIF};font-size:20px;color:${c.ink}">${escapeHtml(p.signature.name)}</p><p style="margin:2px 0 0;font-family:${SANS};font-size:13px;color:${c.text};letter-spacing:1px">${escapeHtml(p.signature.role)}</p>`
    : ''
  return `<!doctype html><html lang="${f.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(f.subject)}</title></head><body style="margin:0;padding:0;background:${c.page}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(f.preheader)}</span>
${table(`<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td style="background:${c.ink};border-radius:20px 20px 0 0;padding:28px 32px 0">${table(`<tr><td valign="middle">${logo(f.siteUrl, 44)}</td><td valign="middle" align="right" style="font-family:${SANS};font-size:11px;letter-spacing:3px;color:${c.accent};text-transform:uppercase">${escapeHtml(p.label ?? '')}</td></tr>`)}</td></tr>
<tr><td style="background:${c.ink};padding:0 32px">${table(`<tr><td valign="bottom" style="padding:26px 0 30px">
${p.greeting ? `<p style="margin:0 0 10px;font-family:${SERIF};font-size:32px;line-height:38px;color:#ffffff">${escapeHtml(p.greeting)}</p>` : ''}
${lead?.t === 'p' ? `<p style="margin:0;font-family:${SERIF};font-size:20px;line-height:27px;color:${c.soft}">${inline(lead.text, true, c)}</p>` : ''}
${renderBlocks(lead?.t === 'p' ? rest : p.intro, { dark: true, letter: false, c }).replace(/margin:0 0 14px/, 'margin:12px 0 0')}
</td><td valign="bottom" width="150" style="padding:0 0 0 12px">${kumi(f.siteUrl, 140)}</td></tr>`)}</td></tr>
${deco ? `<tr><td align="center" style="background:${c.ink};padding:0 0 14px;font-size:22px;line-height:26px;letter-spacing:10px">${deco}</td></tr>` : ''}
<tr><td style="background:${c.accent};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="background:${c.paper};padding:8px 24px 24px">${sections}
${table(`<tr><td style="padding:24px 6px 0">${sign}</td></tr><tr><td style="padding:20px 6px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${c.accent};border-radius:999px"><a href="${f.siteUrl}/dashboard" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:15px;font-weight:bold;color:${c.ink};text-decoration:none">${escapeHtml(f.openLabel)}</a></td></tr></table></td></tr>`)}
</td></tr>
<tr><td style="background:${c.ink};border-radius:0 0 20px 20px;padding:20px 32px;font-family:${SANS};font-size:12px;line-height:18px;color:${c.muted};text-align:center">KUMANI · <a href="${f.siteUrl}" style="color:${c.accent};text-decoration:none">${escapeHtml(site)}</a><br>${footer(f, c.muted)}</td></tr>
</table></td></tr>`, 'background:${c.page}')}
</body></html>`
}

// «Halloween»: la Rivista con zucca e notte
export const renderHalloween = (p: ParsedEmail, f: EmailFrame) => renderRivista(p, f, HALLOWEEN_PAL, '🎃 🦇 🕸️ 👻 🦇 🎃')

// «Lettera»: foglio chiaro su fondo scuro, sezioni numerate, KUMI accanto alla firma
export function renderLettera(p: ParsedEmail, f: EmailFrame): string {
  const site = f.siteUrl.replace(/^https?:\/\//, '')
  const index = p.sections.length > 2
    ? table(`<tr><td style="padding:14px 0;font-family:${SANS};font-size:13px;line-height:22px;color:#57534e">${p.sections.map((s, i) => `${i + 1} · ${escapeHtml(s.title)}`).join(' &nbsp; ')}</td></tr>`, 'margin:6px 0 6px;border-top:1px solid #e2d3a8;border-bottom:1px solid #e2d3a8')
    : ''
  const sections = p.sections
    .map((s, i) => {
      const inner = s.dark
        ? table(`<tr><td style="background:${INK};border-radius:12px;padding:16px 18px 6px">${renderBlocks(s.blocks, { dark: true, letter: true })}</td></tr>`)
        : renderBlocks(s.blocks, { dark: false, letter: true })
      return table(
        `<tr><td valign="top" width="44" style="font-family:${SERIF};font-size:34px;line-height:34px;color:${GOLD}">${i + 1}</td><td valign="top">${s.eyebrow ? `<p style="margin:0 0 4px;font-family:${SANS};font-size:11px;letter-spacing:2px;color:${GOLD_TEXT};text-transform:uppercase">${escapeHtml(s.eyebrow)}</p>` : ''}<p style="margin:0 0 10px;font-family:${SERIF};font-size:22px;line-height:28px;color:${INK}">${escapeHtml(s.title)}</p>${inner}</td></tr>`,
        'margin:26px 0 0',
      )
    })
    .join('')
  const intro = p.intro
    .map((b) => (b.t === 'p' ? `<p style="margin:0 0 14px;font-family:${SERIF};font-size:17px;line-height:27px;color:#3f3a33">${inline(b.text)}</p>` : renderBlocks([b], { dark: false, letter: true })))
    .join('')
  const sign = p.signature
    ? `<p style="margin:0;font-family:${SERIF};font-size:22px;color:${INK}">${escapeHtml(p.signature.name)}</p><p style="margin:2px 0 18px;font-family:${SANS};font-size:13px;color:${GOLD_TEXT};letter-spacing:1px">${escapeHtml(p.signature.role)}</p>`
    : ''
  return `<!doctype html><html lang="${f.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(f.subject)}</title></head><body style="margin:0;padding:0;background:${INK}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(f.preheader)}</span>
${table(`<tr><td align="center" style="padding:28px 12px 32px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td align="center" style="padding:0 0 18px">${logo(f.siteUrl, 56)}<p style="margin:10px 0 0;font-family:${SERIF};font-size:14px;letter-spacing:6px;color:${GOLD}">KUMANI</p></td></tr>
<tr><td style="background:#fbf7ee;border-radius:6px;border-top:6px solid ${GOLD};padding:36px 36px 30px">
<p style="margin:0 0 4px;font-family:${SANS};font-size:11px;letter-spacing:3px;color:${GOLD_TEXT};text-transform:uppercase">${escapeHtml(p.label ?? '')}</p>
${p.greeting ? `<p style="margin:0 0 18px;font-family:${SERIF};font-size:30px;line-height:36px;color:${INK}">${escapeHtml(p.greeting)}</p>` : ''}
${intro}${index}${sections}
${table(`<tr><td valign="bottom" style="padding-top:28px">${sign}<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${INK};border-radius:6px"><a href="${f.siteUrl}/dashboard" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:14px;font-weight:bold;color:${GOLD_SOFT};text-decoration:none;letter-spacing:1px">${escapeHtml(f.openLabel.toUpperCase())}</a></td></tr></table></td><td valign="bottom" width="110" align="right">${kumi(f.siteUrl, 100)}</td></tr>`)}
</td></tr>
<tr><td style="padding:20px 24px 0;font-family:${SANS};font-size:12px;line-height:18px;color:#8a847a;text-align:center">KUMANI · <a href="${f.siteUrl}" style="color:${GOLD};text-decoration:none">${escapeHtml(site)}</a><br>${footer(f, '#8a847a')}</td></tr>
</table></td></tr>`, `background:${INK}`)}
</body></html>`
}

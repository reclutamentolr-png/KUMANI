// KUMANI IMAGO: grafiche per post e storie. Modelli, formati, colori e il
// disegno su tela (lo stesso per anteprima e immagine scaricata).

export const IMAGO_TEMPLATES = ['offer', 'news', 'event', 'quote', 'hours', 'notice', 'tip'] as const
export type ImagoTemplate = (typeof IMAGO_TEMPLATES)[number]
export const IMAGO_FORMATS = { post: [1080, 1350], square: [1080, 1080], story: [1080, 1920] } as const
export type ImagoFormat = keyof typeof IMAGO_FORMATS

export type ImagoPalette = { bg: string; fg: string; accent: string }
export const IMAGO_PRESETS: Record<string, ImagoPalette> = {
  kumani: { bg: '#171717', fg: '#ffffff', accent: '#c79a3b' },
  light: { bg: '#f6f1e6', fg: '#171717', accent: '#b8862f' },
  green: { bg: '#123d2c', fg: '#ffffff', accent: '#9ad27e' },
  rose: { bg: '#fbe9ec', fg: '#3b1f2b', accent: '#c2416a' },
  blue: { bg: '#0f2a4a', fg: '#ffffff', accent: '#ffcf4a' },
}

// Campi che ogni modello usa (gli altri non si mostrano)
export const IMAGO_FIELDS: Record<ImagoTemplate, ('badge' | 'highlight' | 'title' | 'subtitle' | 'detail' | 'note')[]> = {
  offer: ['badge', 'highlight', 'title', 'subtitle', 'note'],
  news: ['badge', 'title', 'subtitle', 'note'],
  event: ['badge', 'title', 'detail', 'subtitle'],
  quote: ['title', 'subtitle'],
  hours: ['title', 'detail', 'note'],
  notice: ['badge', 'title', 'subtitle', 'note'],
  tip: ['badge', 'title', 'subtitle'],
}

export type ImagoTexts = { badge: string; highlight: string; title: string; subtitle: string; detail: string; note: string }

export type ImagoDesign = {
  template: ImagoTemplate
  texts: ImagoTexts
  palette: ImagoPalette
  photo: CanvasImageSource | null
  photoSize: [number, number] | null
  logo: CanvasImageSource | null
  logoSize: [number, number] | null
  brandName: string
  contact: string
  fonts: { sans: string; serif: string }
}

// Testo scuro o chiaro sopra un colore
export function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#171717' : '#ffffff'
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line)
        line = w
      } else line = test
    }
    if (line) out.push(line)
  }
  if (out.length > maxLines) {
    const cut = out.slice(0, maxLines)
    cut[maxLines - 1] = cut[maxLines - 1].replace(/\s*\S*$/, '') + '…'
    return cut
  }
  return out
}

function cover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, W: number, H: number) {
  const s = Math.max(W / iw, H / ih)
  const w = iw * s
  const h = ih * s
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
}

type Block = { h: number; draw: (y: number) => void }

export function drawImago(ctx: CanvasRenderingContext2D, W: number, H: number, d: ImagoDesign) {
  const P = Math.round(W * 0.075)
  const inner = W - P * 2
  const hasPhoto = !!(d.photo && d.photoSize)
  const fg = hasPhoto ? '#ffffff' : d.palette.fg
  const accent = d.palette.accent
  const onAccent = onColor(accent)
  const { sans, serif } = d.fonts
  const t = d.texts
  const fields = IMAGO_FIELDS[d.template]
  const has = (k: keyof ImagoTexts) => fields.includes(k) && !!t[k].trim()

  ctx.save()
  ctx.textBaseline = 'top'
  // Sfondo: foto con velatura scura, oppure colore con un cerchio decorativo
  if (hasPhoto) {
    cover(ctx, d.photo!, d.photoSize![0], d.photoSize![1], W, H)
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(0,0,0,0.35)')
    g.addColorStop(0.35, 'rgba(0,0,0,0.15)')
    g.addColorStop(0.62, 'rgba(0,0,0,0.6)')
    g.addColorStop(1, 'rgba(0,0,0,0.88)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  } else {
    ctx.fillStyle = d.palette.bg
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 0.14
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(W * 0.92, H * 0.06, W * 0.42, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(W * 0.02, H * 0.98, W * 0.28, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Intestazione: logo e nome dell'attività
  const headH = Math.round(W * 0.085)
  let hx = P
  if (d.logo && d.logoSize) {
    const lw = (d.logoSize[0] / d.logoSize[1]) * headH
    const w = Math.min(lw, W * 0.3)
    ctx.drawImage(d.logo, hx, P, w, (w / lw) * headH)
    hx += w + W * 0.025
  }
  if (d.brandName) {
    ctx.fillStyle = fg
    ctx.font = `700 ${Math.round(W * 0.034)}px ${sans}`
    ctx.textBaseline = 'middle'
    ctx.fillText(d.brandName.slice(0, 40), hx, P + headH / 2, W - hx - P)
    ctx.textBaseline = 'top'
  }

  // Blocchi di testo, misurati e poi disposti
  const blocks: Block[] = []
  const gap = W * 0.03
  if (has('badge')) {
    const fs = Math.round(W * 0.03)
    ctx.font = `800 ${fs}px ${sans}`
    const label = t.badge.toLocaleUpperCase().slice(0, 30)
    const bw = ctx.measureText(label).width + fs * 1.6
    const bh = fs * 2
    blocks.push({
      h: bh,
      draw: (y) => {
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.roundRect(P, y, bw, bh, bh / 2)
        ctx.fill()
        ctx.fillStyle = onAccent
        ctx.font = `800 ${fs}px ${sans}`
        ctx.textBaseline = 'middle'
        ctx.fillText(label, P + fs * 0.8, y + bh / 2 + 1)
        ctx.textBaseline = 'top'
      },
    })
  }
  if (has('highlight')) {
    const fs = Math.round(W * 0.19)
    ctx.font = `800 ${fs}px ${serif}`
    const lines = wrap(ctx, t.highlight, inner, 1)
    blocks.push({
      h: fs * 1.05,
      draw: (y) => {
        ctx.fillStyle = accent
        ctx.font = `800 ${fs}px ${serif}`
        ctx.fillText(lines[0], P, y, inner)
      },
    })
  }
  if (has('title')) {
    const quote = d.template === 'quote'
    const fs = Math.round(W * (quote ? 0.068 : t.title.length > 60 ? 0.064 : 0.08))
    ctx.font = `${quote ? 'italic 600' : '800'} ${fs}px ${serif}`
    const lines = wrap(ctx, quote ? `“${t.title}”` : t.title, inner, quote ? 7 : 4)
    const lh = fs * 1.15
    blocks.push({
      h: lines.length * lh,
      draw: (y) => {
        ctx.fillStyle = fg
        ctx.font = `${quote ? 'italic 600' : '800'} ${fs}px ${serif}`
        lines.forEach((l, i) => ctx.fillText(l, P, y + i * lh))
      },
    })
  }
  if (has('detail')) {
    const hours = d.template === 'hours'
    const fs = Math.round(W * (hours ? 0.038 : 0.042))
    const rows = t.detail.split('\n').map((r) => r.trim()).filter(Boolean).slice(0, 9)
    const lh = fs * (hours ? 1.7 : 1.45)
    blocks.push({
      h: rows.length * lh,
      draw: (y) => {
        rows.forEach((r, i) => {
          const yy = y + i * lh
          if (hours && r.includes(':')) {
            const [day, ...rest] = r.split(':')
            ctx.font = `700 ${fs}px ${sans}`
            ctx.fillStyle = fg
            ctx.fillText(day.trim(), P, yy, inner * 0.45)
            ctx.font = `500 ${fs}px ${sans}`
            ctx.fillStyle = accent
            const v = rest.join(':').trim()
            ctx.fillText(v, W - P - Math.min(ctx.measureText(v).width, inner * 0.55), yy, inner * 0.55)
            ctx.globalAlpha = 0.25
            ctx.fillStyle = fg
            ctx.fillRect(P, yy + fs * 1.35, inner, 2)
            ctx.globalAlpha = 1
          } else {
            ctx.font = `700 ${fs}px ${sans}`
            // Sulla foto in bianco: il colore del brand potrebbe non leggersi
            ctx.fillStyle = hasPhoto ? fg : accent
            ctx.fillText(r, P, yy, inner)
          }
        })
      },
    })
  }
  if (has('subtitle')) {
    const fs = Math.round(W * 0.04)
    ctx.font = `500 ${fs}px ${sans}`
    const lines = wrap(ctx, t.subtitle, inner, 6)
    const lh = fs * 1.35
    blocks.push({
      h: lines.length * lh,
      draw: (y) => {
        ctx.fillStyle = fg
        ctx.globalAlpha = 0.88
        ctx.font = `500 ${fs}px ${sans}`
        lines.forEach((l, i) => ctx.fillText(l, P, y + i * lh))
        ctx.globalAlpha = 1
      },
    })
  }
  if (has('note')) {
    const fs = Math.round(W * 0.03)
    ctx.font = `600 ${fs}px ${sans}`
    const lines = wrap(ctx, t.note, inner, 2)
    const lh = fs * 1.3
    blocks.push({
      h: lines.length * lh,
      draw: (y) => {
        ctx.fillStyle = fg
        ctx.globalAlpha = 0.7
        ctx.font = `600 ${fs}px ${sans}`
        lines.forEach((l, i) => ctx.fillText(l, P, y + i * lh))
        ctx.globalAlpha = 1
      },
    })
  }

  // Piede: contatti
  const footFs = Math.round(W * 0.03)
  const footH = d.contact ? footFs * 2.4 : 0
  if (d.contact) {
    ctx.fillStyle = accent
    ctx.fillRect(P, H - P - footH, W * 0.12, Math.max(4, W * 0.005))
    ctx.fillStyle = fg
    ctx.font = `600 ${footFs}px ${sans}`
    ctx.fillText(d.contact.slice(0, 70), P, H - P - footFs * 1.2, inner)
  }

  // Posizione del testo: in basso sopra la foto, al centro sul colore
  const total = blocks.reduce((n, b) => n + b.h, 0) + gap * Math.max(0, blocks.length - 1)
  const top = P + headH + W * 0.06
  const bottom = H - P - footH - W * 0.05
  let y = hasPhoto ? Math.max(top, bottom - total) : Math.max(top, top + (bottom - top - total) / 2)
  for (const b of blocks) {
    b.draw(y)
    y += b.h + gap
  }
  ctx.restore()
}

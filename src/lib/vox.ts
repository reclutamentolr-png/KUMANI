// KUMANI VOX: sottotitoli automatici. La voce si trascrive nel telefono
// (public/workers/vox-worker.js); qui le parole diventano righe di
// sottotitoli, si disegnano sul video (anteprima ed esportazione usano lo
// stesso disegno) e si scrive il file .srt.

export type VoxWord = { text: string; start: number; end: number }
export type VoxGroup = { start: number; end: number; words: VoxWord[] }
export type VoxPreset = 'karaoke' | 'classic' | 'box'
export type VoxSize = 's' | 'm' | 'l'
export type VoxStyle = { preset: VoxPreset; size: VoxSize; position: number; highlight: string; upper: boolean }

export const VOX_MAX_SECONDS = 180
export const VOX_HIGHLIGHTS = ['#ffd84d', '#e7c56a', '#7cfc9a', '#7fdbff', '#ff7ab6']
export const VOX_DEFAULT_STYLE: VoxStyle = { preset: 'karaoke', size: 'm', position: 0.7, highlight: '#ffd84d', upper: true }

// Lingua del video per Whisper
export const VOX_LANGUAGES = { it: 'italian', en: 'english', fr: 'french', es: 'spanish', pt: 'portuguese', de: 'german', ru: 'russian' } as const
export type VoxLanguage = keyof typeof VOX_LANGUAGES

// Le parole che Whisper restituisce senza spazio davanti («'acqua») si
// attaccano alla precedente («d'acqua»)
export function joinWords(raw: { text: string; start: number; end: number }[]): VoxWord[] {
  const out: VoxWord[] = []
  for (const w of raw) {
    const glued = out.length > 0 && !/^\s/.test(w.text)
    const text = w.text.trim()
    if (!text) continue
    if (glued) {
      const prev = out[out.length - 1]
      prev.text += text
      prev.end = Math.max(prev.end, w.end)
    } else out.push({ text, start: w.start, end: Math.max(w.end, w.start) })
  }
  return out
}

// Righe di sottotitoli: poche parole con lo stile «parola per parola», una
// frase breve con gli altri; si va a capo anche alle pause e a fine frase
export function groupWords(words: VoxWord[], preset: VoxPreset): VoxGroup[] {
  const maxWords = preset === 'karaoke' ? 3 : 8
  const maxChars = preset === 'karaoke' ? 18 : 42
  const groups: VoxGroup[] = []
  let cur: VoxWord[] = []
  const flush = () => {
    if (cur.length) groups.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur })
    cur = []
  }
  for (const w of words) {
    const prev = cur[cur.length - 1]
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length
    if (prev && (cur.length >= maxWords || chars > maxChars || w.start - prev.end > 0.7 || /[.!?…]$/.test(prev.text))) flush()
    cur.push(w)
  }
  flush()
  return groups
}

// Testo di una riga corretto a mano: le parole nuove si dividono il tempo
// della riga in proporzione alla loro lunghezza
export function retimeGroup(group: VoxGroup, text: string): VoxWord[] {
  const parts = text.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return []
  const total = parts.reduce((n, p) => n + p.length, 0)
  const span = Math.max(0.2, group.end - group.start)
  let t = group.start
  return parts.map((p) => {
    const d = (p.length / total) * span
    const w = { text: p, start: t, end: t + d }
    t += d
    return w
  })
}

// Riga da mostrare al tempo t (resta visibile poco oltre la fine, finché
// non arriva la successiva)
export function groupAt(groups: VoxGroup[], t: number): VoxGroup | null {
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    const next = groups[i + 1]
    const until = Math.min(next ? next.start : Infinity, g.end + 0.6)
    if (t >= g.start && t < until) return g
  }
  return null
}

const SIZE: Record<VoxSize, number> = { s: 0.062, m: 0.08, l: 0.1 }

// Disegna la riga di sottotitoli sul video (W×H è la misura del video)
export function drawCaption(ctx: CanvasRenderingContext2D, W: number, H: number, group: VoxGroup | null, t: number, style: VoxStyle) {
  if (!group) return
  const fs = Math.round(Math.min(W, H * 0.75) * SIZE[style.size])
  ctx.save()
  ctx.font = `800 ${fs}px "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const words = group.words.map((w) => ({ ...w, label: style.upper ? w.text.toLocaleUpperCase() : w.text }))
  const space = ctx.measureText(' ').width
  const maxWidth = W * 0.86
  // A capo quando la riga è troppo larga
  const lines: { items: typeof words; width: number }[] = []
  let line: typeof words = []
  let width = 0
  for (const w of words) {
    const ww = ctx.measureText(w.label).width
    if (line.length && width + space + ww > maxWidth) {
      lines.push({ items: line, width })
      line = []
      width = 0
    }
    width += (line.length ? space : 0) + ww
    line.push(w)
  }
  if (line.length) lines.push({ items: line, width })
  const lh = fs * 1.25
  const top = H * style.position - ((lines.length - 1) * lh) / 2

  if (style.preset === 'box') {
    const bw = Math.max(...lines.map((l) => l.width)) + fs * 0.9
    const bh = lines.length * lh + fs * 0.5
    const bx = (W - bw) / 2
    const by = top - lh / 2 - fs * 0.25
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, fs * 0.3)
    ctx.fill()
  }

  // Parola che si sta dicendo (solo «parola per parola»)
  const current = style.preset === 'karaoke' ? group.words.findLast((w) => t >= w.start) : undefined
  lines.forEach((l, i) => {
    let x = (W - l.width) / 2
    const y = top + i * lh
    for (const w of l.items) {
      const ww = ctx.measureText(w.label).width
      if (style.preset !== 'box') {
        ctx.strokeStyle = 'rgba(0,0,0,0.9)'
        ctx.lineWidth = fs * 0.18
        ctx.strokeText(w.label, x, y)
      }
      const on = current && w.start === current.start && w.text === current.text
      ctx.fillStyle = on ? style.highlight : '#ffffff'
      ctx.fillText(w.label, x, y)
      x += ww + space
    }
  })
  ctx.restore()
}

const srtTime = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000))
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
}

// File .srt (per caricare i sottotitoli su YouTube, Facebook, editor video)
export function toSrt(groups: VoxGroup[]): string {
  return groups
    .map((g, i) => {
      const next = groups[i + 1]
      const end = Math.min(next ? next.start : Infinity, g.end + 0.6)
      return `${i + 1}\n${srtTime(g.start)} --> ${srtTime(end)}\n${g.words.map((w) => w.text).join(' ')}\n`
    })
    .join('\n')
}

// Audio del video a 16 kHz mono, come lo vuole Whisper
export async function extractAudio(file: Blob): Promise<{ audio: Float32Array; duration: number }> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  try {
    const decoded = await ctx.decodeAudioData(await file.arrayBuffer())
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000)
    const src = off.createBufferSource()
    src.buffer = decoded
    src.connect(off.destination)
    src.start()
    const rendered = await off.startRendering()
    return { audio: rendered.getChannelData(0), duration: decoded.duration }
  } finally {
    void ctx.close().catch(() => {})
  }
}

// FONOMETRO (Audio e Strumenti): il rumore misurato con il microfono del
// telefono. Il microfono non è tarato: i decibel sono una stima (non pesata
// A), utile per confrontare momenti e luoghi, non una misura legale. Tutto
// resta nel telefono: le misure salvate stanno nella memoria del browser.

export type NoiseEvent = { at: number; seconds: number; peak: number } // at = millisecondi dall'inizio
export type NoiseSession = {
  id: string
  start: number // ora di inizio (ms)
  end: number
  place: string
  note: string
  threshold: number
  calibration: number
  samples: number[] // un valore in dB per ogni secondo
  events: NoiseEvent[]
}

export const DEFAULT_THRESHOLD = 55
export const DEFAULT_CALIBRATION = 95
export const MAX_SECONDS = 8 * 60 * 60

// Valore dal microfono (RMS tra 0 e 1) → decibel stimati
export function toDb(rms: number, calibration: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-7)) + calibration
  return Math.max(0, Math.min(130, db))
}

// Media «energetica» (Leq): i decibel non si sommano come numeri normali
export function leq(values: number[]): number {
  if (!values.length) return 0
  const energy = values.reduce((sum, v) => sum + 10 ** (v / 10), 0) / values.length
  return 10 * Math.log10(energy)
}

export function sessionStats(s: Pick<NoiseSession, 'samples' | 'threshold' | 'events'>) {
  const values = s.samples
  return {
    seconds: values.length,
    average: Math.round(leq(values)),
    max: Math.round(values.length ? Math.max(...values) : 0),
    min: Math.round(values.length ? Math.min(...values) : 0),
    secondsOver: values.filter((v) => v >= s.threshold).length,
    events: s.events.length,
  }
}

// Fasce di riferimento (per dare un'idea di cosa vuol dire un numero)
export const LEVELS = [
  { upTo: 30, key: 'whisper' },
  { upTo: 45, key: 'quiet' },
  { upTo: 60, key: 'talk' },
  { upTo: 75, key: 'traffic' },
  { upTo: 85, key: 'loud' },
  { upTo: 200, key: 'danger' },
] as const
export const levelOf = (db: number) => LEVELS.find((l) => db < l.upTo)?.key ?? 'danger'
export const levelColor = (db: number) => (db < 45 ? '#16a34a' : db < 60 ? '#65a30d' : db < 75 ? '#ca8a04' : db < 85 ? '#ea580c' : '#dc2626')

// Registro delle misure nel telefono
const KEY = 'kumani:fonometro:sessions'
export function loadSessions(): NoiseSession[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as NoiseSession[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
export function saveSessions(list: NoiseSession[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)))
    return true
  } catch {
    return false
  }
}

// Grafico del rumore nel tempo, su una tela (pagina e PDF)
export function drawChart(canvas: HTMLCanvasElement, samples: number[], threshold: number, opts: { dark?: boolean } = {}) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height
  const pad = { l: 34, r: 8, t: 8, b: 18 }
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = opts.dark ? '#171717' : '#ffffff'
  ctx.fillRect(0, 0, W, H)
  const lo = 20
  const hi = 110
  const y = (db: number) => pad.t + (H - pad.t - pad.b) * (1 - (Math.min(hi, Math.max(lo, db)) - lo) / (hi - lo))
  // Righe dei decibel
  ctx.font = `${Math.round(H / 16)}px Arial`
  ctx.fillStyle = opts.dark ? '#a8a29e' : '#78716c'
  ctx.strokeStyle = opts.dark ? '#333' : '#eee'
  for (let db = 30; db <= 100; db += 20) {
    ctx.beginPath()
    ctx.moveTo(pad.l, y(db))
    ctx.lineTo(W - pad.r, y(db))
    ctx.stroke()
    ctx.fillText(String(db), 4, y(db) + 4)
  }
  // Soglia
  ctx.strokeStyle = '#dc2626'
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(pad.l, y(threshold))
  ctx.lineTo(W - pad.r, y(threshold))
  ctx.stroke()
  ctx.setLineDash([])
  if (!samples.length) return
  // Con tanti secondi si disegna il massimo di ogni gruppo, così i picchi restano visibili
  const width = W - pad.l - pad.r
  const step = Math.max(1, Math.ceil(samples.length / width))
  ctx.strokeStyle = '#c9a227'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < samples.length; i += step) {
    const v = Math.max(...samples.slice(i, i + step))
    const x = pad.l + (width * i) / Math.max(1, samples.length - 1)
    if (i === 0) ctx.moveTo(x, y(v))
    else ctx.lineTo(x, y(v))
  }
  ctx.stroke()
  ctx.lineWidth = 1
}

const two = (n: number) => String(n).padStart(2, '0')
export const clock = (ms: number) => {
  const d = new Date(ms)
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`
}
export const duration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h ? `${h} h ${two(m)} min` : m ? `${m} min ${two(s)} s` : `${s} s`
}

export type PdfTexts = {
  title: string
  place: string
  note: string
  date: string
  from: string
  to: string
  length: string
  average: string
  max: string
  min: string
  threshold: string
  over: string
  events: string
  eventAt: string
  eventLong: string
  eventPeak: string
  noEvents: string
  disclaimer: string
  footer: string
}

// PDF della misura: dati, grafico ed elenco dei momenti sopra la soglia
export async function sessionPdf(s: NoiseSession, tx: PdfTexts, locale: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const st = sessionStats(s)
  const date = new Date(s.start).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  let y = 18
  pdf.setFillColor(23, 23, 23)
  pdf.rect(0, 0, 210, 12, 'F')
  pdf.setTextColor(212, 175, 55)
  pdf.setFontSize(10)
  pdf.text('KUMANI · ' + tx.title, 14, 8)
  pdf.setTextColor(23, 23, 23)
  pdf.setFontSize(18)
  pdf.text(tx.title, 14, (y += 6))
  pdf.setFontSize(10)
  const rows: [string, string][] = [
    [tx.date, date],
    [tx.from, clock(s.start)],
    [tx.to, clock(s.end)],
    [tx.length, duration(st.seconds)],
    ...(s.place ? ([[tx.place, s.place]] as [string, string][]) : []),
    [tx.average, `${st.average} dB`],
    [tx.max, `${st.max} dB`],
    [tx.min, `${st.min} dB`],
    [tx.threshold, `${s.threshold} dB`],
    [tx.over, duration(st.secondsOver)],
    [tx.events, String(st.events)],
  ]
  y += 6
  for (const [k, v] of rows) {
    pdf.setTextColor(120, 113, 108)
    pdf.text(k, 14, (y += 6))
    pdf.setTextColor(23, 23, 23)
    pdf.text(v, 70, y)
  }
  if (s.note) {
    pdf.setTextColor(120, 113, 108)
    pdf.text(tx.note, 14, (y += 8))
    pdf.setTextColor(23, 23, 23)
    const lines = pdf.splitTextToSize(s.note, 180) as string[]
    pdf.text(lines, 14, (y += 5))
    y += lines.length * 4.5
  }
  // Grafico
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 420
  drawChart(canvas, s.samples, s.threshold)
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 14, (y += 6), 182, 55)
  y += 62
  // Momenti sopra la soglia
  pdf.setFontSize(12)
  pdf.text(tx.events, 14, (y += 4))
  pdf.setFontSize(9)
  y += 2
  if (!s.events.length) {
    pdf.setTextColor(120, 113, 108)
    pdf.text(tx.noEvents, 14, (y += 6))
  } else {
    pdf.setTextColor(120, 113, 108)
    pdf.text(tx.eventAt, 14, (y += 6))
    pdf.text(tx.eventLong, 70, y)
    pdf.text(tx.eventPeak, 120, y)
    pdf.setTextColor(23, 23, 23)
    for (const e of s.events) {
      if (y > 270) {
        pdf.addPage()
        y = 18
      }
      pdf.text(clock(s.start + e.at), 14, (y += 5))
      pdf.text(duration(e.seconds), 70, y)
      pdf.text(`${Math.round(e.peak)} dB`, 120, y)
    }
  }
  // Avvertenza sempre in fondo all'ultima pagina
  pdf.setFontSize(8)
  pdf.setTextColor(120, 113, 108)
  pdf.text(pdf.splitTextToSize(tx.disclaimer, 182) as string[], 14, 278)
  pdf.text(tx.footer, 14, 290)
  return pdf.output('blob')
}

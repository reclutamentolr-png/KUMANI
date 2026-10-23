// KUMANI CRONOBIOMA: l'orologio interno (ritmo circadiano). Solo calcoli,
// uguali nel browser e sul server: cronotipo dal metodo del Munich
// ChronoType Questionnaire (orari reali di sonno nei giorni di lavoro e in
// quelli liberi), la giornata ideale, il diario del sonno, i turni e il fuso
// orario. Niente AI e niente servizi esterni. Benessere, non medicina.

// Minuti dalla mezzanotte (0–1439)
export type Minutes = number
export const DAY = 1440

export const toMinutes = (hhmm: string): Minutes | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? h * 60 + min : null
}
export const norm = (m: number): Minutes => ((Math.round(m) % DAY) + DAY) % DAY
export const fmt = (m: number): string => {
  const n = norm(m)
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
}
// Durata da a → b andando avanti nel tempo (es. 23:00 → 07:00 = 480)
export const span = (from: Minutes, to: Minutes): number => norm(to - from)
// Differenza più breve tra due orari, con segno (b rispetto ad a)
export const diff = (a: Minutes, b: Minutes): number => {
  const d = norm(b - a)
  return d > DAY / 2 ? d - DAY : d
}
// Orario del sonno sull'asse «notte» (le 18:00 diventano −360): per medie e grafici
export const nightAxis = (m: Minutes): number => (m >= 12 * 60 ? m - DAY : m)

// ---------------------------------------------------------------- Questionario

export const LATENCIES = [5, 15, 30, 45, 60] as const
export const OUTDOOR = ['lt30', '30to60', '1to2', 'gt2'] as const
export const SHIFTS = ['no', 'rotating', 'night'] as const
export type Outdoor = (typeof OUTDOOR)[number]
export type ShiftKind = (typeof SHIFTS)[number]

export type QuizAnswers = {
  workDays: number // giorni di lavoro o scuola a settimana (0–7)
  workBed: string // ora in cui vai a letto (giorni di lavoro)
  workLatency: number // minuti per addormentarti
  workWake: string // ora in cui ti svegli
  freeBed: string
  freeLatency: number
  freeWake: string
  freeAlarm: boolean // sveglia anche nei giorni liberi
  outdoor: Outdoor // tempo all'aperto con la luce del giorno
  shift: ShiftKind
}

export const DEFAULT_ANSWERS: QuizAnswers = {
  workDays: 5,
  workBed: '23:00',
  workLatency: 15,
  workWake: '07:00',
  freeBed: '00:00',
  freeLatency: 15,
  freeWake: '09:00',
  freeAlarm: false,
  outdoor: '30to60',
  shift: 'no',
}

export function cleanAnswers(raw: unknown): QuizAnswers | null {
  const a = (raw ?? {}) as Partial<Record<keyof QuizAnswers, unknown>>
  const time = (v: unknown) => (typeof v === 'string' && toMinutes(v) !== null ? v : null)
  const lat = (v: unknown) => (LATENCIES as readonly number[]).includes(Number(v)) ? Number(v) : null
  const out: QuizAnswers = {
    workDays: Math.min(7, Math.max(0, Math.round(Number(a.workDays)))),
    workBed: time(a.workBed) ?? '',
    workLatency: lat(a.workLatency) ?? 15,
    workWake: time(a.workWake) ?? '',
    freeBed: time(a.freeBed) ?? '',
    freeLatency: lat(a.freeLatency) ?? 15,
    freeWake: time(a.freeWake) ?? '',
    freeAlarm: a.freeAlarm === true,
    outdoor: (OUTDOOR as readonly string[]).includes(String(a.outdoor)) ? (a.outdoor as Outdoor) : '30to60',
    shift: (SHIFTS as readonly string[]).includes(String(a.shift)) ? (a.shift as ShiftKind) : 'no',
  }
  if (!Number.isFinite(out.workDays)) out.workDays = 5
  if (!out.workBed || !out.workWake || !out.freeBed || !out.freeWake) return null
  return out
}

// ------------------------------------------------------------------ Cronotipo

export const CHRONOTYPES = ['lark', 'early', 'intermediate', 'late', 'owl'] as const
export type Chronotype = (typeof CHRONOTYPES)[number]
export const CHRONOTYPE_EMOJI: Record<Chronotype, string> = { lark: '🐦', early: '🌅', intermediate: '☀️', late: '🌙', owl: '🦉' }

export type ChronoResult = {
  chronotype: Chronotype
  msfsc: Minutes // centro del sonno nei giorni liberi, corretto per il debito di sonno
  msw: Minutes // centro del sonno nei giorni di lavoro
  msf: Minutes
  sleepWork: number // minuti di sonno nei giorni di lavoro
  sleepFree: number
  sleepAvg: number // media della settimana
  socialJetlag: number // minuti tra il centro del sonno dei giorni liberi e di lavoro
  naturalBed: Minutes // quando andresti a letto senza obblighi
  naturalWake: Minutes
  reliable: boolean // falso con la sveglia nei giorni liberi o con i turni
}

function sleepOf(bed: string, latency: number, wake: string) {
  const onset = norm(toMinutes(bed)! + latency)
  const duration = span(onset, toMinutes(wake)!)
  return { onset, duration, mid: norm(onset + duration / 2) }
}

export function computeChrono(a: QuizAnswers): ChronoResult {
  const work = sleepOf(a.workBed, a.workLatency, a.workWake)
  const free = sleepOf(a.freeBed, a.freeLatency, a.freeWake)
  const wd = a.workDays
  const fd = 7 - wd
  const sleepAvg = (work.duration * wd + free.duration * fd) / 7
  // Nei giorni liberi si recupera il sonno perso: il centro si sposta in avanti
  // e va corretto (MCTQ, Roenneberg). Senza giorni di lavoro non c'è debito.
  const msfsc = wd > 0 && free.duration > work.duration ? norm(free.mid - (free.duration - sleepAvg) / 2) : free.mid
  const h = nightAxis(msfsc) / 60
  // Soglie sulla popolazione adulta (centro medio verso le 4:00–4:30)
  const chronotype: Chronotype = h < 2.5 ? 'lark' : h < 3.5 ? 'early' : h < 4.75 ? 'intermediate' : h < 5.75 ? 'late' : 'owl'
  const naturalSleep = Math.max(7 * 60, Math.min(9 * 60, Math.round(sleepAvg)))
  return {
    chronotype,
    msfsc,
    msw: work.mid,
    msf: free.mid,
    sleepWork: Math.round(work.duration),
    sleepFree: Math.round(free.duration),
    sleepAvg: Math.round(sleepAvg),
    socialJetlag: wd === 0 || wd === 7 ? 0 : Math.abs(diff(work.mid, free.mid)),
    naturalBed: norm(msfsc - naturalSleep / 2),
    naturalWake: norm(msfsc + naturalSleep / 2),
    reliable: !a.freeAlarm && a.shift === 'no',
  }
}

// ------------------------------------------------------- La giornata ideale

export const CLOCK_EVENTS = ['light', 'focus', 'dip', 'movement', 'caffeine', 'dinner', 'screens', 'melatonin', 'bed', 'tempLow'] as const
export type ClockEventKey = (typeof CLOCK_EVENTS)[number]
export type ClockEvent = { key: ClockEventKey; start: Minutes; end?: Minutes }

export type DayPlan = {
  wake: Minutes
  bed: Minutes // quando andare a letto (spegnere la luce)
  sleepNeed: number
  events: ClockEvent[]
  // Se l'ora del risveglio scelta è molto prima di quella naturale: di quanto
  earlyBy: number
}

// wake: l'ora in cui devi alzarti nei giorni di lavoro; sleepNeed: minuti di
// sonno che vuoi (7–9 ore). Le finestre del giorno seguono il centro del
// sonno naturale (msfsc): un gufo rende al meglio più tardi di un'allodola.
export function dayPlan(r: ChronoResult, wake: Minutes, sleepNeed = 8 * 60): DayPlan {
  const bed = norm(wake - sleepNeed - 15)
  const m = r.msfsc
  // L'orologio interno conta più dell'ora della sveglia, ma la giornata parte
  // dal risveglio: le finestre non cadono mai nella prima ora da svegli
  const awake = (t: number) => {
    const since = span(wake, norm(t))
    return since < 60 || since > 16 * 60 ? norm(wake + 60) : norm(t)
  }
  const focusStart = awake(m + 6 * 60)
  return {
    wake,
    bed,
    sleepNeed,
    earlyBy: Math.max(0, -diff(r.naturalWake, wake) - 30),
    events: [
      { key: 'light', start: wake, end: norm(wake + 45) },
      { key: 'focus', start: focusStart, end: norm(focusStart + 3 * 60) },
      { key: 'dip', start: norm(m + 9.5 * 60), end: norm(m + 10.5 * 60) },
      { key: 'movement', start: norm(m + 12 * 60), end: norm(m + 15 * 60) },
      { key: 'caffeine', start: norm(bed - 8 * 60) },
      { key: 'dinner', start: norm(bed - 3 * 60) },
      { key: 'screens', start: norm(bed - 60) },
      // La melatonina segue l'orologio naturale, non la sveglia
      { key: 'melatonin', start: norm(r.naturalBed - 2 * 60) },
      { key: 'bed', start: bed },
      { key: 'tempLow', start: norm(r.naturalWake - 2 * 60) },
    ],
  }
}

// Le 4 voci della versione ridotta (questionario pubblico)
export const PREVIEW_EVENTS: ClockEventKey[] = ['light', 'focus', 'caffeine', 'bed']

// -------------------------------------------------------------- Il diario

export type SleepLog = { night: string; bed: string; wake: string; quality: 1 | 2 | 3 }

export type WeekStats = {
  nights: number
  avgSleep: number // minuti
  regularity: number // deviazione del centro del sonno, in minuti
  regularityLevel: 'great' | 'good' | 'fair' | 'poor'
  socialJetlag: number | null // fine settimana rispetto ai giorni feriali
  avgQuality: number
  tip: 'regular' | 'moreSleep' | 'weekend' | 'irregular' | 'keepGoing'
}

const isWeekend = (night: string) => {
  // La notte del venerdì e del sabato (ci si sveglia sabato e domenica)
  const d = new Date(`${night}T12:00:00Z`).getUTCDay()
  return d === 5 || d === 6
}

export function weekStats(logs: SleepLog[], sleepNeed = 8 * 60): WeekStats | null {
  const rows = logs
    .map((l) => {
      const bed = toMinutes(l.bed)
      const wake = toMinutes(l.wake)
      if (bed === null || wake === null) return null
      const duration = span(bed, wake)
      return { ...l, duration, mid: nightAxis(norm(bed + duration / 2)) }
    })
    .filter((r): r is NonNullable<typeof r> => !!r && r.duration > 60 && r.duration < 16 * 60)
  if (rows.length < 2) return null
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const avgMid = mean(rows.map((r) => r.mid))
  const regularity = Math.sqrt(mean(rows.map((r) => (r.mid - avgMid) ** 2)))
  const weekend = rows.filter((r) => isWeekend(r.night))
  const weekday = rows.filter((r) => !isWeekend(r.night))
  const socialJetlag = weekend.length && weekday.length ? Math.abs(mean(weekend.map((r) => r.mid)) - mean(weekday.map((r) => r.mid))) : null
  const avgSleep = mean(rows.map((r) => r.duration))
  const regularityLevel = regularity < 30 ? 'great' : regularity < 60 ? 'good' : regularity < 90 ? 'fair' : 'poor'
  const tip: WeekStats['tip'] =
    regularity >= 90 ? 'irregular' : socialJetlag !== null && socialJetlag >= 90 ? 'weekend' : avgSleep < sleepNeed - 45 ? 'moreSleep' : regularity < 30 ? 'keepGoing' : 'regular'
  return { nights: rows.length, avgSleep: Math.round(avgSleep), regularity: Math.round(regularity), regularityLevel, socialJetlag: socialJetlag === null ? null : Math.round(socialJetlag), avgQuality: mean(rows.map((r) => r.quality)), tip }
}

// --------------------------------------------------------------- I turni

export const SHIFT_PRESETS = { morning: ['06:00', '14:00'], afternoon: ['14:00', '22:00'], night: ['22:00', '06:00'] } as const
export type ShiftPreset = keyof typeof SHIFT_PRESETS | 'custom'

export const SHIFT_STEPS = ['sleepBefore', 'nap', 'lightStart', 'caffeineStop', 'meal', 'sunglasses', 'sleepAfter', 'anchor'] as const
export type ShiftStepKey = (typeof SHIFT_STEPS)[number]
export type ShiftStep = { key: ShiftStepKey; start: Minutes; end?: Minutes }

// Un turno: inizio e fine. Il notturno (che finisce dopo mezzanotte o al
// mattino) ha il suo piano: pisolino prima, luce all'inizio, caffè solo
// nella prima metà, occhiali scuri al ritorno, sonno subito dopo al buio.
export function shiftPlan(startHHMM: string, endHHMM: string): { night: boolean; steps: ShiftStep[] } | null {
  const start = toMinutes(startHHMM)
  const end = toMinutes(endHHMM)
  if (start === null || end === null) return null
  const length = span(start, end)
  if (length < 3 * 60 || length > 14 * 60) return null
  // Notturno: si lavora tra le 2 e le 5 di notte
  const covers = (t: number) => span(start, t) < length
  const night = covers(3 * 60)
  if (night) {
    return {
      night,
      steps: [
        { key: 'nap', start: norm(start - 3 * 60), end: norm(start - 90) },
        { key: 'lightStart', start, end: norm(start + 3 * 60) },
        { key: 'caffeineStop', start: norm(start + length / 2) },
        { key: 'meal', start: norm(start + 2 * 60) },
        { key: 'sunglasses', start: end },
        { key: 'sleepAfter', start: norm(end + 60), end: norm(end + 60 + 7 * 60) },
        { key: 'anchor', start: norm(end + 60 + 7 * 60 + 60) },
      ],
    }
  }
  const early = start < 7 * 60
  return {
    night,
    steps: [
      { key: 'sleepBefore', start: norm(start - 60 - 8 * 60 - 15), end: norm(start - 60) },
      { key: 'lightStart', start, end: norm(start + 2 * 60) },
      { key: 'caffeineStop', start: norm(early ? start + 6 * 60 : end - 2 * 60) },
      { key: 'meal', start: norm(start + length / 2) },
    ],
  }
}

// ------------------------------------------------------------ Fuso orario

export type JetlagPlan = {
  hours: number // differenza: positiva verso est
  direction: 'east' | 'west' | 'none'
  daysToAdapt: number
  before: { day: number; bed: Minutes; wake: Minutes }[] // giorni prima della partenza (ora di casa)
  // Ora del posto, solo nelle ore da svegli (7–23): null se la finestra cade di notte
  after: { day: number; seek: [Minutes, Minutes] | null; avoid: [Minutes, Minutes] | null }[]
}

// Differenza in ore tra due fusi (IANA) in una data
export function zoneOffsetHours(zone: string, at = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
    return Math.round((asUtc - at.getTime()) / 60000 / 30) / 2
  } catch {
    return null
  }
}

// La luce sposta l'orologio: presa dopo il punto più freddo della notte
// (circa 2 ore prima del risveglio naturale) lo anticipa, presa prima lo
// ritarda. Verso est serve anticipare (circa 1 ora al giorno), verso ovest
// ritardare (circa 1 ora e mezza al giorno).
export function jetlagPlan(fromZone: string, toZone: string, r: ChronoResult, when = new Date()): JetlagPlan | null {
  const a = zoneOffsetHours(fromZone, when)
  const b = zoneOffsetHours(toZone, when)
  if (a === null || b === null) return null
  let hours = b - a
  if (hours > 12) hours -= 24
  if (hours < -12) hours += 24
  const abs = Math.abs(hours)
  if (abs < 2) return { hours, direction: 'none', daysToAdapt: 0, before: [], after: [] }
  const direction = hours > 0 ? 'east' : 'west'
  // Oltre 8 ore verso est conviene adattarsi «all'indietro» (ritardare)
  const shiftEast = direction === 'east' && abs <= 8
  const needed = shiftEast ? abs * 60 : direction === 'east' ? (24 - abs) * 60 : abs * 60
  const perDay = shiftEast ? 60 : 90
  const daysToAdapt = Math.ceil(needed / perDay)
  const sign = shiftEast ? -1 : 1 // −1 anticipa, +1 ritarda
  const bed = r.naturalBed
  const wake = r.naturalWake
  const before = [3, 2, 1].map((d, i) => ({ day: -d, bed: norm(bed + sign * 60 * (i + 1)), wake: norm(wake + sign * 60 * (i + 1)) }))
  // Il punto più freddo, già spostato di 3 ore prima di partire, in ora locale
  let tmin = norm(wake - 2 * 60 + sign * 3 * 60 + hours * 60)
  const after: JetlagPlan['after'] = []
  // Solo la parte della finestra tra le 7 e le 23 (nessuno prende il sole alle 3)
  const awake = (a: number, b: number): [Minutes, Minutes] | null => {
    // La parte più lunga della finestra (che può passare la mezzanotte) tra le 7 e le 23
    let best: [Minutes, Minutes] | null = null
    let run: Minutes | null = null
    const len = span(norm(a), norm(b))
    for (let i = 0; i <= len; i += 5) {
      const t = norm(a + i)
      const ok = t >= 7 * 60 && t <= 23 * 60 && i < len
      if (ok && run === null) run = t
      if ((!ok || i + 5 > len) && run !== null) {
        const end = ok ? t : norm(t - 5)
        if (!best || span(run, end) > span(best[0], best[1])) best = [run, end]
        run = null
      }
    }
    // Orari tondi al quarto d'ora: più facili da ricordare
    const q = (m: number) => norm(Math.round(m / 15) * 15)
    return best && span(best[0], best[1]) >= 30 ? [q(best[0]), q(best[1])] : null
  }
  for (let day = 1; day <= Math.min(daysToAdapt, 10); day++) {
    after.push(
      sign < 0
        ? { day, seek: awake(tmin, tmin + 3 * 60), avoid: awake(tmin - 3 * 60, tmin) }
        : { day, seek: awake(tmin - 3 * 60, tmin), avoid: awake(tmin, tmin + 3 * 60) }
    )
    tmin = norm(tmin + sign * perDay)
  }
  return { hours, direction, daysToAdapt, before, after }
}

// Fusi orari proposti (città conosciute); si può anche cercarne uno
export const JETLAG_ZONES = [
  'Europe/London', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Athens', 'Europe/Moscow', 'Europe/Istanbul',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Toronto',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Pacific/Auckland', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Casablanca',
] as const

// ------------------------------------------------------- Calendario (.ics)

export type IcsReminder = { key: string; time: Minutes; title: string; text: string }

// Promemoria che si ripetono ogni giorno, con l'avviso all'ora giusta: il
// calendario del telefono li fa suonare anche senza internet
export function buildIcs(reminders: IcsReminder[], zone: string, uidSeed: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = new Date()
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`
  const tomorrow = new Date(now.getTime() + 86400000)
  const date = `${tomorrow.getFullYear()}${pad(tomorrow.getMonth() + 1)}${pad(tomorrow.getDate())}`
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KUMANI//CRONOBIOMA//IT', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:KUMANI CRONOBIOMA']
  for (const r of reminders) {
    const t = norm(r.time)
    const start = `${date}T${pad(Math.floor(t / 60))}${pad(t % 60)}00`
    lines.push(
      'BEGIN:VEVENT',
      `UID:cronobioma-${r.key}-${uidSeed}@kumani.io`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${zone}:${start}`,
      'DURATION:PT5M',
      'RRULE:FREQ=DAILY',
      `SUMMARY:${esc(r.title)}`,
      `DESCRIPTION:${esc(r.text)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(r.title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT'
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// Risultato del questionario pubblico, ricordato nel browser per ritrovarlo
// dopo l'iscrizione (non va mai al server prima del consenso)
export const QUIZ_STORAGE_KEY = 'kumani_cronobioma_quiz'

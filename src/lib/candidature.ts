// Le mie candidature: tipi, limiti dei campi (uguali al database) e calcoli
// usati sia dal server sia dal browser (date in ora italiana, contatori,
// «Da fare oggi», file .ics del colloquio).

export const APPLICATION_STATUSES = [
  'to_send',
  'sent',
  'interview_set',
  'interview_done',
  'offer',
  'accepted',
  'rejected',
  'no_answer',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_SOURCES = ['online', 'word', 'in_person', 'agency', 'spontaneous', 'other'] as const
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number]

export const SALARY_PERIODS = ['month', 'year', 'hour'] as const
export type SalaryPeriod = (typeof SALARY_PERIODS)[number]

export const APPLICATION_LIMITS = {
  company: 120,
  role: 120,
  city: 80,
  adUrl: 500,
  contactName: 120,
  contactEmail: 200,
  contactPhone: 40,
  notes: 3000,
} as const

// Giorni senza risposta dopo i quali si propone di richiamare
export const FOLLOW_UP_AFTER_DAYS = 10

// Stati «chiusi»: niente richiami né suggerimenti
export const CLOSED_STATUSES: readonly ApplicationStatus[] = ['accepted', 'rejected', 'no_answer']
// Stati che contano come risposta ricevuta dall'azienda
export const ANSWER_STATUSES: readonly ApplicationStatus[] = ['interview_set', 'interview_done', 'offer', 'accepted', 'rejected']
// Stati che vogliono dire «c'è stato (o ci sarà) un colloquio»
export const INTERVIEW_STATUSES: readonly ApplicationStatus[] = ['interview_set', 'interview_done', 'offer', 'accepted']

export type JobApplication = {
  id: string
  company: string
  role: string | null
  city: string | null
  source: ApplicationSource | null
  ad_url: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  sent_on: string | null
  status: ApplicationStatus
  status_changed_at: string
  interview_at: string | null
  follow_up_on: string | null
  notes: string | null
  salary: number | null
  salary_period: SalaryPeriod
  created_at: string
  updated_at: string
}

export type ApplicationEvent = { id: string; from_status: ApplicationStatus | null; to_status: ApplicationStatus; created_at: string }

// Dati del modulo (tutto testo, come nei campi)
export type ApplicationForm = {
  company: string
  role: string
  city: string
  source: ApplicationSource | ''
  adUrl: string
  contactName: string
  contactEmail: string
  contactPhone: string
  sentOn: string
  status: ApplicationStatus
  // «AAAA-MM-GGTHH:MM» in ora italiana
  interviewAt: string
  followUpOn: string
  notes: string
  salary: string
  salaryPeriod: SalaryPeriod
}

export const isStatus = (value: unknown): value is ApplicationStatus => (APPLICATION_STATUSES as readonly string[]).includes(String(value))
export const isSource = (value: unknown): value is ApplicationSource => (APPLICATION_SOURCES as readonly string[]).includes(String(value))

// ---------------------------------------------------------------------------
// Date in ora italiana

const ROME = 'Europe/Rome'

// Giorno di oggi a Roma (AAAA-MM-GG), spostato di n giorni
export function romeToday(offsetDays = 0): string {
  return romeDay(new Date(Date.now() + offsetDays * 86_400_000))
}

export function romeDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ROME }).format(date)
}

// Aggiunge giorni a una data AAAA-MM-GG
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000)
}

// Minuti di differenza tra l'ora di Roma e l'ora universale in quel momento
function romeOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ROME,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000)
}

// «AAAA-MM-GGTHH:MM» scritto in ora italiana → istante esatto (null se non valido)
export function romeLocalToDate(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  // Due passaggi: il cambio dell'ora legale cade proprio tra le due stime
  let guess = asUtc - romeOffsetMinutes(new Date(asUtc)) * 60_000
  guess = asUtc - romeOffsetMinutes(new Date(guess)) * 60_000
  return new Date(guess)
}

// Istante → «AAAA-MM-GGTHH:MM» in ora italiana (per il campo del modulo)
export function dateToRomeLocal(iso: string | null): string {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const local = new Date(at.getTime() + romeOffsetMinutes(at) * 60_000)
  return local.toISOString().slice(0, 16)
}

export function formatDay(day: string | null, locale: string, withWeekday = false): string {
  if (!day) return ''
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, {
    timeZone: 'UTC',
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(locale, { timeZone: ROME, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { timeZone: ROME, hour: '2-digit', minute: '2-digit' })
}

export function formatEur(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value)
}

// ---------------------------------------------------------------------------
// Richiami, colloqui e suggerimenti

// Giorno da cui contare «senza risposta»: invio o ultimo cambio di stato
export function sentDay(app: JobApplication): string {
  return app.sent_on ?? romeDay(new Date(app.status_changed_at))
}

// «Inviata» da almeno 10 giorni, senza richiamo segnato: si propone una data
export function suggestFollowUp(app: JobApplication, today: string): string | null {
  if (app.status !== 'sent' || app.follow_up_on) return null
  const due = addDays(sentDay(app), FOLLOW_UP_AFTER_DAYS)
  return due <= today ? today : null
}

export type TodayItem =
  | { kind: 'followUp'; app: JobApplication; late: number }
  | { kind: 'interview'; app: JobApplication; tomorrow: boolean }
  | { kind: 'suggest'; app: JobApplication; waiting: number }

export function todayItems(apps: JobApplication[], today: string): TodayItem[] {
  const tomorrow = addDays(today, 1)
  const items: TodayItem[] = []
  for (const app of apps) {
    if (app.interview_at && app.status === 'interview_set') {
      const day = romeDay(new Date(app.interview_at))
      if (day === today || day === tomorrow) items.push({ kind: 'interview', app, tomorrow: day === tomorrow })
    }
    if (CLOSED_STATUSES.includes(app.status)) continue
    if (app.follow_up_on && app.follow_up_on <= today) {
      items.push({ kind: 'followUp', app, late: daysBetween(app.follow_up_on, today) })
    } else if (suggestFollowUp(app, today)) {
      items.push({ kind: 'suggest', app, waiting: daysBetween(sentDay(app), today) })
    }
  }
  const rank = (i: TodayItem) =>
    i.kind === 'interview' ? `0${i.tomorrow ? 1 : 0}${i.app.interview_at}` : i.kind === 'followUp' ? `1${String(999 - Math.min(i.late, 999)).padStart(3, '0')}` : '2'
  return items.sort((a, b) => rank(a).localeCompare(rank(b)))
}

// Contatori in alto: solo numeri, nessun dato personale
export function applicationStats(apps: JobApplication[], today: string) {
  const month = today.slice(0, 7)
  const sent = apps.filter((a) => a.status !== 'to_send')
  const answered = sent.filter((a) => ANSWER_STATUSES.includes(a.status)).length
  return {
    sentThisMonth: sent.filter((a) => (a.sent_on ?? '').startsWith(month)).length,
    interviews: apps.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length,
    answeredPercent: sent.length ? Math.round((answered / sent.length) * 100) : null,
  }
}

// ---------------------------------------------------------------------------
// File .ics del colloquio (Google Calendar, iPhone, Outlook lo aprono)

const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// Righe lunghe spezzate a 75 byte come vuole lo standard (senza tagliare le lettere accentate)
function fold(line: string): string {
  const encoder = new TextEncoder()
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

export function interviewIcs(app: JobApplication, texts: { summary: string; description: string; alarm: string }): string | null {
  if (!app.interview_at) return null
  const start = new Date(app.interview_at)
  const end = new Date(start.getTime() + 60 * 60_000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KUMANI//Candidature//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${app.id}-${icsStamp(start)}@kumani.io`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(texts.summary)}`,
    ...(app.city ? [`LOCATION:${icsText(app.city)}`] : []),
    ...(texts.description ? [`DESCRIPTION:${icsText(texts.description)}`] : []),
    ...(app.ad_url ? [`URL:${app.ad_url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(texts.alarm)}`,
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Nome del file senza caratteri strani
export const safeFileName = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase() || 'colloquio'

// Numero di telefono per tel: (solo cifre e +)
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

// Agenda unica: gli eventi di MemoLife (appuntamenti, promemoria), Spendly
// (scadenze di pagamento) e Life Calendar (rinnovi) in un unico formato, per
// il calendario di MemoLife e il riquadro "I prossimi giorni" in dashboard.
// Le date sono giorni di calendario italiani ('YYYY-MM-DD' nel fuso di Roma):
// mai toISOString() su una data locale, che sposta di un giorno.

export const AGENDA_TIMEZONE = 'Europe/Rome'

export type AgendaKind = 'appointment' | 'task' | 'bill' | 'deadline' | 'trip' | 'event'

export type AgendaEvent = {
  key: string
  kind: AgendaKind
  date: string
  time: string | null
  title: string
  amount: number | null
  done: boolean
  // appointment/task/deadline: id; bill: id della spesa fissa + mese
  refId: string
  period?: string
  note?: string | null
  priority?: string | null
  recurring?: boolean
  // KUMANI Travel: partenza o rientro del viaggio (refId = id del viaggio)
  tripEdge?: 'start' | 'end'
  // KUMANI Events: l'utente è l'organizzatore (refId = id dell'evento)
  organizing?: boolean
  // Kumani Garage: scadenza dell'auto (si gestisce nella pagina dell'auto)
  garageVehicleId?: string
}

// Giorno di calendario a Roma di un istante ('2026-10-16').
export function dateKeyOf(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AGENDA_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}

// Ora a Roma di un istante ('15:30').
export function timeOf(instant: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: AGENDA_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(instant)
}

export function todayKey(now: Date = new Date()): string {
  return dateKeyOf(now)
}

// Aritmetica sui giorni di calendario (a mezzogiorno UTC: niente salti di ora legale).
export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000)
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const mm = String(month).padStart(2, '0')
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` }
}

// Differenza in ore tra l'ora di Roma e UTC in un dato istante (1 o 2 ore).
function romeOffsetHours(instant: Date): number {
  const romeHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: AGENDA_TIMEZONE, hour: '2-digit', hourCycle: 'h23' }).format(instant))
  let offset = romeHour - instant.getUTCHours()
  if (offset > 12) offset -= 24
  if (offset < -12) offset += 24
  return offset
}

// Istante UTC di un giorno + ora italiani (per salvare un appuntamento).
// L'offset va ricalcolato sull'istante ottenuto: a cavallo del cambio d'ora
// legale quello stimato sull'ora "come se fosse UTC" può essere sbagliato.
export function romeToInstant(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`)
  const first = new Date(guess.getTime() - romeOffsetHours(guess) * 3600000)
  const second = new Date(guess.getTime() - romeOffsetHours(first) * 3600000)
  return second.toISOString()
}

export function sortAgenda(events: AgendaEvent[]): AgendaEvent[] {
  const order: Record<AgendaKind, number> = { trip: -1, bill: 0, deadline: 1, task: 2, appointment: 3, event: 3 }
  return [...events].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || order[a.kind] - order[b.kind]
  )
}

export type AgendaStatus = 'overdue' | 'today' | 'soon' | 'later' | 'done'

export function agendaStatus(event: AgendaEvent, today: string): AgendaStatus {
  if (event.done) return 'done'
  if (event.date < today) return event.kind === 'appointment' || event.kind === 'trip' || event.kind === 'event' ? 'done' : 'overdue'
  if (event.date === today) return 'today'
  return daysBetween(today, event.date) <= 3 ? 'soon' : 'later'
}

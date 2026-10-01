// Notifiche dell'area Admin al posto di alert(): un piccolo box che compare
// in alto a destra e sparisce da solo (components/admin/AdminToaster).
// Il tipo si ricava dal messaggio se non è indicato (✅ = ok, ❌/Errore = errore).

export type AdminNoticeKind = 'success' | 'error' | 'info'
export interface AdminNotice {
  id: number
  kind: AdminNoticeKind
  message: string
}

type Listener = (notice: AdminNotice) => void
const listeners = new Set<Listener>()
let nextId = 1

export function subscribeAdminNotices(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notify(message: string, kind?: AdminNoticeKind) {
  const text = String(message ?? '')
  const inferred: AdminNoticeKind =
    kind ?? (/^\s*✅/.test(text) ? 'success' : /^\s*(❌|errore|error)/i.test(text) ? 'error' : 'info')
  const clean = text.replace(/^\s*(✅|❌|⚠️)\s*/u, '').trim()
  const notice = { id: nextId++, kind: inferred, message: clean }
  listeners.forEach((listener) => listener(notice))
}

// Testo Protetto: le «chiavi» per rimettere i dati veri nella risposta
// dell'IA. Restano solo in questo browser, per 7 giorni, al massimo 10.

export type ShieldSession = { id: string; title: string; createdAt: number; map: Record<string, string> }

const KEY = 'kumani-testo-protetto-v1'
const MAX = 10
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export function loadSessions(owner: string): ShieldSession[] {
  try {
    const list = JSON.parse(localStorage.getItem(`${KEY}:${owner}`) ?? '[]') as ShieldSession[]
    const now = Date.now()
    if (!Array.isArray(list)) return []
    const fresh = list.filter((s) => now - s.createdAt < TTL_MS)
    // Le chiavi scadute (con i dati veri dentro) si tolgono anche dalla memoria
    if (fresh.length < list.length) saveSessions(owner, fresh)
    return fresh
  } catch {
    return []
  }
}

export function saveSessions(owner: string, list: ShieldSession[]) {
  try {
    localStorage.setItem(`${KEY}:${owner}`, JSON.stringify(list.slice(0, MAX)))
  } catch {
    // memoria del browser piena o bloccata
  }
}

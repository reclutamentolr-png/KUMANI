// Ritorno alla dashboard nel punto esatto: quando si apre un servizio da una
// categoria si annotano la categoria aperta e lo scorrimento della pagina
// (sessionStorage: solo questa scheda del browser, al massimo 30 minuti).
// Tornando in dashboard la categoria si riapre e la pagina scorre lì; il
// promemoria si usa una sola volta.

const KEY = 'kumani:dashboard-return'
const MAX_AGE_MS = 30 * 60 * 1000

export type DashboardReturn = { category: string; scrollY: number; at: number }

export function readDashboardReturn(): DashboardReturn | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as DashboardReturn
    if (typeof value?.scrollY !== 'number' || Date.now() - value.at > MAX_AGE_MS) return null
    return value
  } catch {
    return null
  }
}

export function clearDashboardReturn() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // niente da fare
  }
}

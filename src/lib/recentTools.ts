// Servizi aperti di recente, in questo browser (localStorage): i più
// recenti per primi, al massimo MAX.
const KEY = 'kumani:recent-tools'
const MAX = 8

export function readRecentTools(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : []
  } catch {
    return []
  }
}

export function rememberRecentTool(toolName: string) {
  try {
    const list = [toolName, ...readRecentTools().filter((name) => name !== toolName)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // Memoria del browser non disponibile: niente "usati di recente"
  }
}

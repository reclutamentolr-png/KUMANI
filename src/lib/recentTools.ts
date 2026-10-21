import { createClient } from '@/lib/supabase/client'

// Servizi aperti di recente, in questo browser (localStorage): i più
// recenti per primi, al massimo MAX. Un elenco per account, così su un
// telefono o un computer condiviso ognuno vede solo i propri.
const LEGACY_KEY = 'kumani:recent-tools'
const MAX = 8
const keyOf = (userId: string) => `${LEGACY_KEY}:${userId}`

// Account collegato, letto dalla sessione salvata nel browser (senza rete)
export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

export function readRecentTools(userId: string | null): string[] {
  if (!userId) return []
  try {
    // Il vecchio elenco unico (condiviso tra account) non si usa più
    localStorage.removeItem(LEGACY_KEY)
    const value = JSON.parse(localStorage.getItem(keyOf(userId)) || '[]')
    return Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : []
  } catch {
    return []
  }
}

export function rememberRecentTool(userId: string | null, toolName: string) {
  if (!userId) return
  try {
    const list = [toolName, ...readRecentTools(userId).filter((name) => name !== toolName)].slice(0, MAX)
    localStorage.setItem(keyOf(userId), JSON.stringify(list))
  } catch {
    // Memoria del browser non disponibile: niente "usati di recente"
  }
}

import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/translationOverrides'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { SCAM_CARDS } from '@/lib/scamCards/cards'
import { matchScamCard } from '@/lib/scamCards/match'
import type { ScamCategory } from '@/lib/scamNet'

// CARTE ANTITRUFFA – Passo 2: la «cattura». Quando un controllo ferma una
// truffa vera, la carta di quella truffa entra nell'album con la cornice
// verde (o sale da oro a verde). Solo per chi ha le Carte nel piano; una
// carta si cattura una volta sola, quindi ripetere un controllo non conta.

export type CaptureSource = 'svat' | 'qr' | 'checkmail' | 'community'

// Carta catturata da mostrare sotto il risultato del controllo
export type CapturedCard = { no: number; name: string; isNew: boolean }

// Tipo di truffa della Rete Anti-Truffa → carta
const CATEGORY_CARD: Partial<Record<ScamCategory, number>> = {
  courier: 1,
  bank: 2,
  investment: 4,
  romance: 7,
  marketplace: 11,
  job: 13,
  rental: 17,
  prize: 18,
  support: 19,
}

export function cardForCategory(category: ScamCategory | null | undefined): number | null {
  return (category && CATEGORY_CARD[category]) || null
}

// SVAT: sito rosso. Negli elenchi delle autorità finanziarie è un falso
// investimento; altrimenti si guarda l'indirizzo (es. «poste-pacco-giacenza»)
export function cardForSite(address: string, checks: { id: string; status: string; detailsKey?: string }[]): number | null {
  const listed = checks.find((c) => c.id === 'scamList' && c.status === 'risk')?.detailsKey ?? ''
  if (/^scamList(Consob|Ivass|Bafin|Amf)/.test(listed)) return 4
  return matchScamCard(address.replace(/[./_-]+/g, ' '))
}

// CheckMail: email ad alto rischio. Prima il testo, poi gli indizi trovati
export function cardForEmail(text: string, findings: { key: string }[], aiCategory?: string | null): number | null {
  const fromText = matchScamCard(text)
  if (fromText) return fromText
  const keys = new Set(findings.map((f) => f.key))
  if (keys.has('content_parcel')) return 1
  if (keys.has('content_investment') || aiCategory === 'investment') return 4
  if (aiCategory === 'romance') return 7
  return null
}

export async function captureScamCard(userId: string, no: number | null, source: CaptureSource): Promise<CapturedCard | null> {
  try {
    const card = SCAM_CARDS.find((c) => c.no === no)
    if (!card) return null
    if (!(await hasActiveToolAccess(await createClient(), userId, 'carte-antitruffa'))) return null
    const db = serviceClient()
    const now = new Date().toISOString()
    const { data: existing } = await db.from('scam_cards').select('rarity').eq('user_id', userId).eq('card_no', card.no).maybeSingle()
    let isNew = false
    if (!existing) {
      const { error } = await db.from('scam_cards').insert({ user_id: userId, card_no: card.no, rarity: 'catturata', captured_from: source, captured_at: now })
      isNew = !error
    } else if (existing.rarity === 'oro') {
      // Presa con le domande: ora anche catturata davvero (solo se è ancora oro)
      const { data } = await db
        .from('scam_cards')
        .update({ rarity: 'catturata', captured_from: source, captured_at: now })
        .eq('user_id', userId)
        .eq('card_no', card.no)
        .eq('rarity', 'oro')
        .select('card_no')
      isNew = !!data?.length
    }
    return { no: card.no, name: card.name, isNew }
  } catch {
    // La cattura non deve mai far fallire il controllo
    return null
  }
}

// Carta rara: a chi ha segnalato per primo un caso nuovo, confermato dallo
// Staff. Vale più di ogni altra cornice (sulla carta c'è il suo nome).
// Si chiama dall'Admin, quindi l'accesso si controlla per quella persona.
export async function awardRareCard(userId: string, category: ScamCategory | null): Promise<CapturedCard | null> {
  try {
    const card = SCAM_CARDS.find((c) => c.no === cardForCategory(category))
    if (!card) return null
    const db = serviceClient()
    const { data: access } = await db.rpc('tool_access', { p_user_id: userId, p_tool: 'carte-antitruffa' }).maybeSingle<{ allowed: boolean }>()
    if (!access?.allowed) return null
    const { data: existing } = await db.from('scam_cards').select('rarity').eq('user_id', userId).eq('card_no', card.no).maybeSingle()
    if (existing?.rarity === 'rara') return { no: card.no, name: card.name, isNew: false }
    const now = new Date().toISOString()
    const { error } = existing
      ? await db.from('scam_cards').update({ rarity: 'rara', rare_at: now }).eq('user_id', userId).eq('card_no', card.no)
      : await db.from('scam_cards').insert({ user_id: userId, card_no: card.no, rarity: 'rara', rare_at: now })
    return error ? null : { no: card.no, name: card.name, isNew: true }
  } catch {
    return null
  }
}

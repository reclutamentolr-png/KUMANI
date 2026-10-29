'use server'

import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/translationOverrides'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { todayKey } from '@/lib/agenda'
import { monthKey, SCAM_CARDS } from '@/lib/scamCards/cards'
import { releaseDailySlot, takeDailySlot } from '@/lib/scamCards/capture'
import { pickQuestions } from '@/lib/scamCards/quiz'

// CARTE ANTITRUFFA: la carta si prende rispondendo giusto alle sue 3 domande.
// Le risposte si ricontrollano qui; la carta si salva con il client di
// servizio (l'utente può solo leggere le sue). Chi sbaglia riprova domani.

export type ScamCardOwned = { no: number; rarity: string; obtainedAt: string; rareAt?: string | null }

// Le 3 domande di oggi per questa carta (posizioni tra le 5 della carta)
export async function startScamQuiz(no: number): Promise<{ success: true; questions: number[] } | { success: false; message: 'notLoggedIn' | 'invalid' }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  const card = SCAM_CARDS.find((c) => c.no === no)
  if (!card) return { success: false, message: 'invalid' }
  return { success: true, questions: pickQuestions(user.id, todayKey(), no, card.quiz.length) }
}

export async function claimScamCard(
  no: number,
  answers: number[]
): Promise<{ success: true; card: ScamCardOwned } | { success: false; message: 'notLoggedIn' | 'subscriptionRequired' | 'invalid' | 'wrong' | 'tryTomorrow' | 'dailyLimit' | 'saveError' }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'carte-antitruffa'))) return { success: false, message: 'subscriptionRequired' }
  const card = SCAM_CARDS.find((c) => c.no === no)
  const today = todayKey()
  // Le domande di oggi le sceglie il server: le risposte valgono per quelle
  const questions = card ? pickQuestions(user.id, today, no, card.quiz.length) : []
  if (!card || !Array.isArray(answers) || answers.length !== questions.length) return { success: false, message: 'invalid' }
  const db = serviceClient()
  // Un tentativo al giorno per carta: la riga si scrive PRIMA di guardare le
  // risposte, così tante richieste insieme (tutte le combinazioni) non passano.
  // Se le risposte sono giuste (o la carta non si può prendere oggi) si toglie
  const { data: attempt } = await db
    .from('scam_card_fails')
    .upsert({ user_id: user.id, card_no: no, failed_on: today }, { onConflict: 'user_id,card_no,failed_on', ignoreDuplicates: true })
    .select('card_no')
  if (!attempt?.length) return { success: false, message: 'tryTomorrow' }
  const forgive = () => db.from('scam_card_fails').delete().eq('user_id', user.id).eq('card_no', no).eq('failed_on', today)
  // Una carta al giorno: oggi ne è già arrivata una (con le domande o catturata)
  const { data: gained } = await db.from('scam_card_gains').select('card_no').eq('user_id', user.id).eq('day', today).maybeSingle()
  if (gained) {
    await forgive()
    return { success: false, message: 'dailyLimit' }
  }
  if (questions.some((qi, i) => answers[i] !== card.quiz[qi].correct)) return { success: false, message: 'wrong' }
  await forgive()
  // Carta del mese presa in questo mese: cornice arcobaleno (anche se era già oro)
  const { data: month } = await db.from('scam_card_month').select('card_no').eq('month', monthKey(today)).maybeSingle()
  const ofTheMonth = month?.card_no === no
  // Carta già nell'album e niente da cambiare: non consuma la carta di oggi
  const { data: owned } = await db.from('scam_cards').select('rarity').eq('user_id', user.id).eq('card_no', no).maybeSingle()
  const changes = !owned || (ofTheMonth && owned.rarity === 'oro')
  if (changes && !(await takeDailySlot(db, user.id, no, 'quiz'))) return { success: false, message: 'dailyLimit' }
  const { error } = await db
    .from('scam_cards')
    .upsert({ user_id: user.id, card_no: no, rarity: ofTheMonth ? 'mese' : 'oro' }, { onConflict: 'user_id,card_no', ignoreDuplicates: true })
  if (error) {
    if (changes) await releaseDailySlot(db, user.id)
    return { success: false, message: 'saveError' }
  }
  if (ofTheMonth) await db.from('scam_cards').update({ rarity: 'mese' }).eq('user_id', user.id).eq('card_no', no).eq('rarity', 'oro')
  const { data } = await db.from('scam_cards').select('card_no, rarity, obtained_at, rare_at').eq('user_id', user.id).eq('card_no', no).maybeSingle()
  await awardToolPoint('carte-antitruffa')
  return { success: true, card: { no, rarity: (data?.rarity as string) ?? 'oro', obtainedAt: (data?.obtained_at as string) ?? new Date().toISOString(), rareAt: (data?.rare_at as string | null) ?? null } }
}

// ── Staff: la carta del mese ─────────────────────────────────────────────

export type ScamMonthCard = { month: string; cardNo: number }

// Le carte del mese già scelte (ultime 12) e quella dei prossimi mesi
export async function adminScamMonthCards(): Promise<ScamMonthCard[] | null> {
  if (!(await verifyAdmin('listings.read'))) return null
  const { data } = await serviceClient().from('scam_card_month').select('month, card_no').order('month', { ascending: false }).limit(14)
  return (data ?? []).map((r) => ({ month: r.month as string, cardNo: r.card_no as number }))
}

// Sceglie (o toglie, con null) la carta di un mese ('2026-11')
export async function adminSetScamMonthCard(month: string, cardNo: number | null): Promise<{ success: boolean; error?: string }> {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { success: false, error: 'Mese non valido' }
  const db = serviceClient()
  if (cardNo === null) {
    await db.from('scam_card_month').delete().eq('month', month)
    return { success: true }
  }
  if (!SCAM_CARDS.some((c) => c.no === cardNo)) return { success: false, error: 'Carta non valida' }
  const { error } = await db.from('scam_card_month').upsert({ month, card_no: cardNo, created_by: admin.id }, { onConflict: 'month' })
  return error ? { success: false, error: error.message } : { success: true }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { awardToolPoint } from '@/lib/toolPoints'
import type { VeritasRoomInfo, VeritasState } from '@/lib/veritas'

// Veritas: le regole (turni, bugiardo, voti, punti) sono nelle funzioni SQL
// veritas_*; qui solo il passaggio dal browser. Gli ospiti senza account
// usano le stesse funzioni con il loro codice segreto di stanza.

export async function createVeritasRoom(nickname: string, locale: string, rounds: number) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('veritas_create_room', { p_nickname: nickname, p_locale: locale, p_rounds: rounds })
  // Oltre le 20 stanze al giorno: messaggio dedicato invece dell'errore generico
  if (error?.message?.includes('too_many_rooms')) return { success: false as const, error: 'too_many_rooms' }
  if (error || !data) return { success: false as const, error: 'error' }
  await awardToolPoint('veritas')
  return { success: true as const, ...(data as { code: string; room_id: string; player_id: string; token: string }) }
}

export async function joinVeritasRoom(code: string, nickname: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('veritas_join', { p_code: code, p_nickname: nickname })
  if (error || !data) return { success: false as const, error: 'error' }
  const result = data as { error?: string; room_id?: string; token?: string }
  if (result.error || !result.room_id || !result.token) return { success: false as const, error: result.error ?? 'error' }
  await awardToolPoint('veritas')
  return { success: true as const, room_id: result.room_id, token: result.token }
}

export async function getVeritasRoom(code: string): Promise<VeritasRoomInfo | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('veritas_room_by_code', { p_code: code })
  return (data as VeritasRoomInfo | null) ?? null
}

export async function getVeritasState(roomId: string, token: string): Promise<VeritasState | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('veritas_state', { p_room: roomId, p_token: token })
  if (error || !data) return { error: 'error' }
  return data as VeritasState | { error: string }
}

export async function startVeritas(roomId: string, token: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('veritas_start', { p_room: roomId, p_token: token })
  return error ? 'error' : String(data)
}

export async function answerVeritas(roomId: string, token: string, body: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('veritas_answer', { p_room: roomId, p_token: token, p_body: body })
  return error ? 'error' : String(data)
}

export async function voteVeritas(roomId: string, token: string, slot: number): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('veritas_vote', { p_room: roomId, p_token: token, p_slot: slot })
  return error ? 'error' : String(data)
}

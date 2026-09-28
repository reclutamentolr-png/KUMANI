'use server'

import { createClient } from '@/lib/supabase/server'
import { awardToolPoint } from '@/lib/toolPoints'
import type { MosaicStatus } from '@/lib/mosaic'

// KUMANI Mosaic: le regole (stagione, tessere al giorno, bonus, giorni di
// accesso, caselle già occupate) sono nelle funzioni SQL mosaic_*.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getMosaicStatus(): Promise<MosaicStatus | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mosaic_status')
  if (error) {
    console.error('[Mosaic] status failed:', error.message)
    return null
  }
  return data as MosaicStatus | null
}

// Tela aggiornata (dopo un "reload" dello Staff o al ritorno sulla pagina)
export async function getMosaicCanvas(seasonId: string): Promise<string | null> {
  if (!UUID_RE.test(seasonId)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('mosaic_canvas', { p_season: seasonId })
  return (data as string | null) ?? null
}

export async function placeMosaicPixel(seasonId: string, x: number, y: number, color: number): Promise<{ ok?: boolean; left?: number; error?: string }> {
  if (!UUID_RE.test(seasonId) || ![x, y, color].every(Number.isInteger) || color < 0 || color > 31) return { error: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mosaic_place', { p_season: seasonId, p_x: x, p_y: y, p_color: color })
  if (error) {
    if (error.message?.includes('suspended')) return { error: 'suspended' }
    console.error('[Mosaic] place failed:', error.message)
    return { error: 'saveError' }
  }
  const result = data as { ok?: boolean; left?: number; error?: string }
  if (result.ok) await awardToolPoint('mosaic')
  return result
}

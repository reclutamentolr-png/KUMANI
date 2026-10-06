'use server'

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'

// Collegamenti tra i servizi dell'Ecosistema (Ricevuta digitale → Spendly,
// Kumi Card Fidelity → Wallet). Le regole stanno nelle funzioni del database.

export type ReceiptSpendlyStatus = 'expense' | 'income' | 'added' | 'no_value' | 'no_access' | 'login'

const CODE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/

export async function addReceiptToSpendly(code: string): Promise<ReceiptSpendlyStatus> {
  if (!CODE_PATTERN.test(code)) return 'no_value'
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('receipt_to_spendly', { p_code: code })
  if (error) {
    console.error('[ecosistema] ricevuta → Spendly:', error.message)
    return 'no_value'
  }
  return (data as ReceiptSpendlyStatus | null) ?? 'no_value'
}

// Viaggi → Spendly: le mie quote delle spese del viaggio
export type TripSpendlyStatus = { status: 'ok' | 'login' | 'not_member' | 'currency' | 'no_access'; shares?: number; imported?: number; total?: number }

export async function tripSpendlyStatus(tripId: string): Promise<TripSpendlyStatus> {
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return { status: 'not_member' }
  const supabase = await createClient()
  const { data } = await supabase.rpc('trip_spendly_status', { p_trip: tripId })
  return (data as TripSpendlyStatus | null) ?? { status: 'not_member' }
}

export async function syncTripToSpendly(tripId: string): Promise<TripSpendlyStatus> {
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) return { status: 'not_member' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('trip_to_spendly', { p_trip: tripId })
  if (error) console.error('[ecosistema] viaggio → Spendly:', error.message)
  return (data as TripSpendlyStatus | null) ?? { status: 'not_member' }
}

// CV → Link in bio: aggiunge il link pubblico del CV tra i link (una volta sola)
export async function addCvToLinkInBio(publicUrl: string): Promise<'added' | 'exists' | 'no_access' | 'error'> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !/^https?:\/\/[^\s]+\/cv\/[A-Za-z0-9_-]{4,64}$/.test(publicUrl)) return 'error'
  if (!(await hasActiveToolAccess(supabase, user.id, 'link-in-bio'))) return 'no_access'
  const { data: row } = await supabase.from('link_in_bio').select('links, theme, bio_text').eq('user_id', user.id).maybeSingle()
  const raw = row?.links
  const links: { id?: string; title: string; url: string; icon: string; enabled?: boolean }[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw || '[]') : []
  const code = publicUrl.split('/cv/')[1]
  if (links.some((l) => typeof l.url === 'string' && l.url.includes(`/cv/${code}`))) return 'exists'
  const t = await getTranslations('ecosystem')
  links.push({ id: crypto.randomUUID(), title: t('cvToBioLinkTitle'), url: publicUrl, icon: 'default', enabled: true })
  const { error } = await supabase
    .from('link_in_bio')
    .upsert({ user_id: user.id, links: JSON.stringify(links), bio_text: row?.bio_text ?? '', theme: row?.theme ?? undefined, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    console.error('[ecosistema] CV → Link in bio:', error.message)
    return 'error'
  }
  return 'added'
}

// «Il tuo benessere di oggi»: stato dei tre passi e bonus di KU Karma
export type WellnessToday = { breath: boolean; focus: boolean; mind: boolean; claimed: boolean; bonus: number; streak: number; awarded?: number }

export async function claimWellnessBonus(): Promise<WellnessToday | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('claim_wellness_path_bonus')
  if (error) {
    console.error('[ecosistema] bonus benessere:', error.message)
    return null
  }
  const result = data as (WellnessToday & { error?: string }) | null
  if (!result || result.error) {
    const { data: state } = await supabase.rpc('wellness_path_today')
    return (state as WellnessToday | null) ?? null
  }
  return result
}

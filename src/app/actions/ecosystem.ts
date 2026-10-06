'use server'

import { createClient } from '@/lib/supabase/server'

// Collegamenti tra i servizi dell'Ecosistema (Ricevuta digitale → Spendly,
// Kumi Card Fidelity → Wallet). Le regole stanno nelle funzioni del database.

export type ReceiptSpendlyStatus = 'expense' | 'income' | 'added' | 'no_value' | 'no_access' | 'login'

const CODE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/

export async function receiptSpendlyStatus(code: string): Promise<ReceiptSpendlyStatus> {
  if (!CODE_PATTERN.test(code)) return 'no_value'
  const supabase = await createClient()
  const { data } = await supabase.rpc('receipt_spendly_status', { p_code: code })
  return (data as ReceiptSpendlyStatus | null) ?? 'no_value'
}

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

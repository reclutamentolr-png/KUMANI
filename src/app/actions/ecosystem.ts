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

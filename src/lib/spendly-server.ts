import type { SupabaseClient } from '@supabase/supabase-js'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { addDays, todayKey } from '@/lib/agenda'
import { dueDatesUntil, type SpendlyFixedExpense } from '@/lib/spendly'

export function hasActiveSpendlyAccess(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return hasActiveToolAccess(supabase, userId, 'spendly')
}

/**
 * Addebito automatico: le scadenze arrivate (da auto_pay_from a oggi) si
 * registrano pagate con l'importo previsto e il metodo della spesa, senza
 * toccare i pagamenti già segnati. Poi auto_pay_from passa a domani, così un
 * «Annulla» su una scadenza registrata non viene rifatto. Da chiamare prima
 * di leggere le scadenze; un errore non blocca la pagina.
 */
export async function settleAutoPayments(supabase: SupabaseClient, userIds: string | string[]): Promise<void> {
  const ids = Array.isArray(userIds) ? userIds : [userIds]
  if (ids.length === 0) return
  const today = todayKey()
  const { data: expenses, error } = await supabase
    .from('spendly_fixed_expenses')
    .select('id, user_id, description, amount, frequency, category, start_date, end_date, billing_day, notes, payment_method, auto_pay_from')
    .in('user_id', ids)
    .not('auto_pay_from', 'is', null)
    .lte('auto_pay_from', today)
    .returns<(SpendlyFixedExpense & { user_id: string; auto_pay_from: string })[]>()
  if (error) {
    console.error('[Spendly] settleAutoPayments read failed:', error)
    return
  }
  if (!expenses?.length) return

  const rows = expenses.flatMap((e) =>
    dueDatesUntil({ ...e, amount: Number(e.amount) }, today)
      .filter((d) => d.date >= e.auto_pay_from)
      .map((d) => ({ user_id: e.user_id, expense_id: e.id, period: d.period, amount: Number(e.amount), paid_on: d.date, payment_method: e.payment_method ?? null }))
  )
  if (rows.length > 0) {
    const { error: payError } = await supabase
      .from('spendly_fixed_payments')
      .upsert(rows, { onConflict: 'expense_id,period', ignoreDuplicates: true })
    if (payError) {
      console.error('[Spendly] settleAutoPayments insert failed:', payError)
      return
    }
  }
  // Solo se nel frattempo l'addebito non è stato spento
  const { error: moveError } = await supabase
    .from('spendly_fixed_expenses')
    .update({ auto_pay_from: addDays(today, 1) })
    .in('id', expenses.map((e) => e.id))
    .not('auto_pay_from', 'is', null)
  if (moveError) console.error('[Spendly] settleAutoPayments update failed:', moveError)
}

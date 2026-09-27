'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { loadAgenda } from '@/lib/agenda-server'
import { addDays, daysBetween, todayKey, type AgendaEvent } from '@/lib/agenda'

// Azioni rapide dell'agenda unica (dashboard e calendario di MemoLife):
// ognuna ricontrolla l'accesso allo strumento a cui appartiene il dato.

async function session() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

// Intervallo massimo leggibile in una volta (un mese di calendario più margine):
// evita richieste enormi da client manipolati.
const MAX_RANGE_DAYS = 62

// Data 'YYYY-MM-DD' realmente esistente (no 2026-02-31).
function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const d = new Date(`${key}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key
}

// Eventi di un intervallo (calendario di MemoLife), dai soli strumenti utilizzabili.
export async function getAgendaRange(from: string, to: string): Promise<AgendaEvent[]> {
  if (!isValidDateKey(from) || !isValidDateKey(to)) return []
  const span = daysBetween(from, to)
  if (span < 0 || span > MAX_RANGE_DAYS) return []
  const { supabase, user } = await session()
  if (!user) return []
  const [memolife, spendly, lifeCalendar] = await Promise.all([
    hasActiveToolAccess(supabase, user.id, 'memolife'),
    hasActiveToolAccess(supabase, user.id, 'spendly'),
    hasActiveToolAccess(supabase, user.id, 'life-calendar'),
  ])
  return loadAgenda(supabase, user.id, {
    from,
    to,
    sources: { memolife, spendly, lifeCalendar },
    includeDone: true,
    overdueSince: from < todayKey() ? from : addDays(todayKey(), -90),
  })
}

// Bolletta / spesa fissa pagata per un mese, con l'importo reale.
export async function markBillPaid(expenseId: string, period: string, amount: number): Promise<boolean> {
  const { supabase, user } = await session()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'spendly'))) return false
  if (!/^\d{4}-\d{2}-01$/.test(period) || !(amount >= 0)) return false
  const { error } = await supabase
    .from('spendly_fixed_payments')
    .upsert(
      { user_id: user.id, expense_id: expenseId, period, amount: Math.round(amount * 100) / 100, paid_on: todayKey() },
      { onConflict: 'expense_id,period' }
    )
  return !error
}

export async function unmarkBillPaid(expenseId: string, period: string): Promise<boolean> {
  const { supabase, user } = await session()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'spendly'))) return false
  const { error } = await supabase.from('spendly_fixed_payments').delete().eq('expense_id', expenseId).eq('period', period).eq('user_id', user.id)
  return !error
}

// Promemoria di MemoLife fatto / da fare.
export async function setTaskDone(taskId: string, done: boolean): Promise<boolean> {
  const { supabase, user } = await session()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'memolife'))) return false
  const { error } = await supabase.from('tasks').update({ completed: done }).eq('id', taskId).eq('user_id', user.id)
  return !error
}

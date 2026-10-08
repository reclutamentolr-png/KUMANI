import type { SupabaseClient } from '@supabase/supabase-js'
import { fixedExpenseDueDate, type SpendlyFixedExpense } from '@/lib/spendly'
import type { CasaAppliance, CasaBill, CasaDeadline, CasaDocument, CasaHome, CasaUtility } from '@/lib/casa'
import { todayKey } from '@/lib/agenda'

const HOME_COLUMNS = 'id, name, kind, address, notes, created_at'
const DEADLINE_COLUMNS = 'id, title, category, due_date, recurrence, recurrence_custom_days, notes, casa_home_id'
const UTILITY_COLUMNS = 'id, home_id, kind, provider, customer_code, supply_code, support_phone, offer_ends_on, notes, spendly_fixed_id'
const APPLIANCE_COLUMNS =
  'id, home_id, name, brand, model, serial_number, room, purchased_on, price, store, warranty_until, support_phone, notes, receipt_path, manual_path'
const DOCUMENT_COLUMNS = 'id, home_id, kind, title, file_path, file_name, mime_type, size_bytes, expires_on, created_at'

const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value))

// Prossima data della bolletta (entro un anno da oggi)
export function nextBillDue(expense: SpendlyFixedExpense, today = todayKey()): string | null {
  let y = Number(today.slice(0, 4))
  let m = Number(today.slice(5, 7))
  for (let i = 0; i < 13; i++) {
    const date = fixedExpenseDueDate(expense, y, m)
    if (date && date >= today) return date
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return null
}

// Panoramica: tutte le case con le prossime scadenze e i numeri
export async function loadHomes(supabase: SupabaseClient, userId: string) {
  const [h, d, a, docs] = await Promise.all([
    supabase.from('casa_homes').select(HOME_COLUMNS).eq('user_id', userId).order('created_at'),
    supabase
      .from('life_calendar_items')
      .select(DEADLINE_COLUMNS)
      .eq('user_id', userId)
      .eq('status', 'active')
      .not('casa_home_id', 'is', null)
      .order('due_date'),
    supabase.from('casa_appliances').select('id, home_id, warranty_until').eq('user_id', userId),
    supabase.from('casa_documents').select('id, home_id').eq('user_id', userId),
  ])
  return {
    homes: (h.data ?? []) as CasaHome[],
    deadlines: (d.data ?? []) as (CasaDeadline & { casa_home_id: string })[],
    appliances: (a.data ?? []) as { id: string; home_id: string; warranty_until: string | null }[],
    documents: (docs.data ?? []) as { id: string; home_id: string }[],
  }
}

// Una casa con tutto ciò che contiene (letto con il client dell'utente: le
// RLS limitano ai suoi dati) e i link firmati per aprire i file
export async function loadHome(supabase: SupabaseClient, userId: string, homeId: string) {
  const { data: home } = await supabase.from('casa_homes').select(HOME_COLUMNS).eq('id', homeId).eq('user_id', userId).maybeSingle()
  if (!home) return null
  const [d, u, a, docs, bills, linked] = await Promise.all([
    supabase.from('life_calendar_items').select(DEADLINE_COLUMNS).eq('user_id', userId).eq('casa_home_id', homeId).eq('status', 'active').order('due_date'),
    supabase.from('casa_utilities').select(UTILITY_COLUMNS).eq('user_id', userId).eq('home_id', homeId).order('created_at'),
    supabase.from('casa_appliances').select(APPLIANCE_COLUMNS).eq('user_id', userId).eq('home_id', homeId).order('name'),
    supabase.from('casa_documents').select(DOCUMENT_COLUMNS).eq('user_id', userId).eq('home_id', homeId).order('created_at', { ascending: false }),
    // Le bollette di Spendly: per collegarle alle utenze
    supabase
      .from('spendly_fixed_expenses')
      .select('id, description, amount, frequency, category, start_date, end_date, billing_day, notes')
      .eq('user_id', userId)
      .eq('category', 'bollette')
      .order('description'),
    // Bollette già collegate a un'utenza (anche di altre case)
    supabase.from('casa_utilities').select('spendly_fixed_id').eq('user_id', userId).not('spendly_fixed_id', 'is', null),
  ])
  const today = todayKey()
  const appliances = (a.data ?? []).map((row) => ({ ...row, price: toNumber(row.price) })) as CasaAppliance[]
  const documents = (docs.data ?? []) as CasaDocument[]

  const paths = [...documents.map((doc) => doc.file_path), ...appliances.flatMap((x) => [x.receipt_path, x.manual_path])].filter((p): p is string => !!p)
  const fileUrls: Record<string, string> = {}
  if (paths.length) {
    const { data: signed } = await supabase.storage.from('casa-files').createSignedUrls(paths, 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) fileUrls[s.path] = s.signedUrl
  }

  return {
    home: home as CasaHome,
    deadlines: (d.data ?? []) as CasaDeadline[],
    utilities: (u.data ?? []) as CasaUtility[],
    appliances,
    documents,
    bills: (bills.data ?? []).map((row) => {
      const expense = { ...(row as SpendlyFixedExpense), amount: Number(row.amount) }
      return {
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        frequency: expense.frequency,
        start_date: expense.start_date,
        end_date: expense.end_date,
        billing_day: expense.billing_day,
        next_due: nextBillDue(expense, today),
      }
    }) as CasaBill[],
    linkedBillIds: (linked.data ?? []).map((row) => row.spendly_fixed_id as string),
    fileUrls,
  }
}

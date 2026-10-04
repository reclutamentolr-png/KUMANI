import type { SupabaseClient } from '@supabase/supabase-js'
import type { GarageDeadline, GarageExpense, GarageReading, GarageVehicle } from '@/lib/garage'

const VEHICLE_COLUMNS =
  'id, kind, name, model, plate, initial_km, rental_start, rental_months, rental_km_included, rental_monthly_fee, rental_down_payment, rental_extra_km_cost, rental_unused_km_refund, rental_includes_tax, rental_includes_insurance, spendly_fixed_id, created_at'

const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value))

function normalizeVehicle(row: Record<string, unknown>): GarageVehicle {
  return {
    ...(row as GarageVehicle),
    rental_monthly_fee: toNumber(row.rental_monthly_fee),
    rental_down_payment: toNumber(row.rental_down_payment),
    rental_extra_km_cost: toNumber(row.rental_extra_km_cost),
    rental_unused_km_refund: toNumber(row.rental_unused_km_refund),
  }
}

// Tutto il garage dell'utente (letto con il suo client: le RLS limitano ai suoi dati)
export async function loadGarage(supabase: SupabaseClient, userId: string, vehicleId?: string) {
  // Con vehicleId solo quell'auto (il secondo filtro altrimenti ripete user_id)
  const only = (column: string) => [vehicleId ? column : 'user_id', vehicleId ?? userId] as const
  const vehicles = supabase.from('garage_vehicles').select(VEHICLE_COLUMNS).eq('user_id', userId).eq(...only('id')).order('created_at')
  const readings = supabase.from('garage_readings').select('id, vehicle_id, km, read_on, note').eq('user_id', userId).eq(...only('vehicle_id')).order('read_on').order('created_at')
  const deadlines = supabase.from('garage_deadlines').select('id, vehicle_id, kind, title, due_date, amount, recurrence').eq('user_id', userId).eq(...only('vehicle_id')).order('due_date')
  const expenses = supabase
    .from('garage_expenses')
    .select('id, vehicle_id, kind, amount, spent_on, note')
    .eq('user_id', userId)
    .eq(...only('vehicle_id'))
    .order('spent_on', { ascending: false })
    .limit(2000)
  const [v, r, d, e] = await Promise.all([vehicles, readings, deadlines, expenses])
  return {
    vehicles: (v.data ?? []).map((row) => normalizeVehicle(row as Record<string, unknown>)),
    readings: (r.data ?? []) as GarageReading[],
    deadlines: (d.data ?? []).map((row) => ({ ...row, amount: toNumber(row.amount) })) as GarageDeadline[],
    expenses: (e.data ?? []).map((row) => ({ ...row, amount: Number(row.amount) })) as GarageExpense[],
  }
}

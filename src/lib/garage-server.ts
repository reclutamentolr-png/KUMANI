import type { SupabaseClient } from '@supabase/supabase-js'
import type { GarageDeadline, GarageDocument, GarageExpense, GarageReading, GarageVehicle } from '@/lib/garage'

const VEHICLE_COLUMNS =
  'id, kind, vehicle_type, name, model, plate, initial_km, rental_start, rental_months, rental_km_included, rental_monthly_fee, rental_down_payment, rental_extra_km_cost, rental_unused_km_refund, rental_includes_tax, rental_includes_insurance, spendly_fixed_id, created_at'

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
  // Documenti solo nella pagina del veicolo, con i link firmati per aprirli
  const documents = vehicleId
    ? supabase
        .from('garage_documents')
        .select('id, vehicle_id, kind, title, file_path, file_name, mime_type, size_bytes, created_at')
        .eq('user_id', userId)
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: [] as GarageDocument[] })
  const [v, r, d, e, docs] = await Promise.all([vehicles, readings, deadlines, expenses, documents])
  const docList = (docs.data ?? []) as GarageDocument[]
  const fileUrls: Record<string, string> = {}
  if (docList.length) {
    const { data: signed } = await supabase.storage.from('garage-files').createSignedUrls(docList.map((x) => x.file_path), 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) fileUrls[s.path] = s.signedUrl
  }
  return {
    documents: docList,
    fileUrls,
    vehicles: (v.data ?? []).map((row) => normalizeVehicle(row as Record<string, unknown>)),
    readings: (r.data ?? []) as GarageReading[],
    deadlines: (d.data ?? []).map((row) => ({ ...row, amount: toNumber(row.amount) })) as GarageDeadline[],
    expenses: (e.data ?? []).map((row) => ({ ...row, amount: Number(row.amount) })) as GarageExpense[],
  }
}

'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'

// Iscritti arrivati da una pagina (es. il test anti-truffa, ?da=test-truffa):
// totale, ultimi 30 e ultimi 7 giorni (funzione signup_from_stats)
export async function adminSignupsFrom(source: 'test-truffa'): Promise<{ total: number; last30: number; last7: number } | null> {
  if (!(await verifyAdmin('listings.read'))) return null
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await db.rpc('signup_from_stats', { p_source: source }).maybeSingle<{ total: number; last30: number; last7: number }>()
  if (error || !data) return null
  return { total: Number(data.total), last30: Number(data.last30), last7: Number(data.last7) }
}

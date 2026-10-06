'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'

// Admin → Punti e premi → Qualificati: chi ha raggiunto Kuman Green, Star o
// Black, con i dati per contattarli (vetrina, evento annuale, Consiglio dei Black)
export type QualifiedMember = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  province: string | null
  country: string | null
  referral_code: string | null
  plan: string
  ranks: Record<string, string>
  activations: number
  confirmed_points: number
  vouchers_total: number
  vouchers_used: number
  black_plus: number
}

export async function adminListQualifiedMembers(): Promise<{ members: QualifiedMember[]; error: string | null }> {
  const admin = await verifyAdmin('users.read')
  if (!admin) return { members: [], error: 'Non autorizzato' }
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await db.rpc('admin_qualified_members')
  if (error) return { members: [], error: error.message }
  return { members: (data ?? []) as QualifiedMember[], error: null }
}

import { createClient as createServiceClient } from '@supabase/supabase-js'

// Può ancora indicare chi l'ha invitato? (solo lato server, per la dashboard)
export async function getLateSponsorStatus(userId: string): Promise<{ eligible: boolean; until?: string }> {
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await db.rpc('late_sponsor_status', { p_user: userId })
  if (error) return { eligible: false }
  const s = (data ?? {}) as { eligible?: boolean; until?: string }
  return { eligible: s.eligible === true, until: s.until }
}

import 'server-only'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Link in Bio come privato o come azienda: «azienda» solo con il Pro, che ha
// la Scheda attività. Il piano si legge dal database (stessa regola del sito).
export type BioMode = 'personal' | 'business'

export async function bioPlanIsPro(userId: string): Promise<boolean> {
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data } = await service.rpc('plan_of', { p_user_id: userId })
  return data === 'pro'
}

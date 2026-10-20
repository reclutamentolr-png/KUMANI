'use server'

import { getLocale } from 'next-intl/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { locales, defaultLocale } from '../../../i18n'

// «Avvisami» dei piani in arrivo (vedi lib/plansGate): la persona entra in
// lista con il piano che voleva e la sua lingua, per l'avviso dell'apertura
export async function joinPlanWaitlist(plan: 'base' | 'pro'): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  const current = await getLocale().catch(() => defaultLocale)
  const locale = locales.includes(current) ? current : defaultLocale
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await service
    .from('plan_waitlist')
    .upsert({ user_id: user.id, plan: plan === 'pro' ? 'pro' : 'base', locale, notified_at: null }, { onConflict: 'user_id' })
  if (error) console.error('[lista piani]', error.message)
  return { ok: !error }
}

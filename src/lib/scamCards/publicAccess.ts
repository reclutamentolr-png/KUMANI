import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getDisabledTools } from '@/lib/freeTools'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'

// Pagine pubbliche delle Carte Antitruffa: aperte a tutti (e su Google) quando
// il servizio è acceso; con il servizio spento («Solo Staff») le vede solo
// chi può già usarlo, e non vanno su Google.
export async function scamCardsPublic(): Promise<{ visible: boolean; indexable: boolean; userId: string | null }> {
  const supabase = await createClient()
  const [
    disabled,
    {
      data: { user },
    },
  ] = await Promise.all([getDisabledTools().catch(() => ['carte-antitruffa']), supabase.auth.getUser()])
  if (!disabled.includes('carte-antitruffa')) return { visible: true, indexable: true, userId: user?.id ?? null }
  const staff = !!user && (await hasActiveToolAccess(supabase, user.id, 'carte-antitruffa'))
  return { visible: staff, indexable: false, userId: user?.id ?? null }
}

// Codice d'invito da mettere nel link: quello di chi condivide (se iscritto),
// altrimenti quello con cui è arrivato chi guarda
export async function inviteCodeFor(userId: string | null, incoming: string | undefined): Promise<string | null> {
  if (userId) {
    const supabase = await createClient()
    const { data } = await supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null }>()
    if (data?.referral_code) return data.referral_code
  }
  return typeof incoming === 'string' && /^[A-Z0-9-]{4,20}$/i.test(incoming) ? incoming.toUpperCase() : null
}

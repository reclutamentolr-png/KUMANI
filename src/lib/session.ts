import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasAdminRole } from '@/lib/admin-auth'
import type { MyProfile } from '@/lib/myProfile'

// Letture della sessione condivise da tutta la pagina (una sola volta per
// richiesta, grazie a cache di React): utente, profilo e ruolo Staff servono
// sia alla pagina sia all'intestazione, prima venivano letti due volte.

export const getSessionClient = cache(async (): Promise<SupabaseClient> => createClient())

export const getSessionUser = cache(async () => {
  const supabase = await getSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const getSessionProfile = cache(async (): Promise<MyProfile | null> => {
  const supabase = await getSessionClient()
  const { data } = await supabase.rpc('get_my_profile').maybeSingle<MyProfile>()
  return data ?? null
})

export const getSessionIsAdmin = cache(async (userId: string): Promise<boolean> => {
  const supabase = await getSessionClient()
  const [role, profile] = await Promise.all([hasAdminRole(supabase, userId), getSessionProfile()])
  return role || profile?.is_admin === true
})

// Fa partire subito le letture dell'intestazione (in parallelo a quelle della
// pagina): quando l'intestazione le chiede, sono già pronte o in arrivo.
export function preloadSession() {
  getSessionUser()
    .then((user) => {
      if (user) {
        getSessionProfile().catch(() => {})
        getSessionIsAdmin(user.id).catch(() => {})
      }
    })
    .catch(() => {})
}

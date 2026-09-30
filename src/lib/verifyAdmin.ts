import { createClient } from '@/lib/supabase/server'
import type { Permission } from '@/lib/admin-permissions'

// Utente della sessione se è Staff con il permesso richiesto: profiles.is_admin
// (admin completo) oppure un ruolo con quel permesso (o '*'). Stessa regola
// di verifyAdmin in actions/admin.ts.
export async function verifyAdmin(requiredPermission: Permission) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (profile?.is_admin) return user
  const { data: adminRecord } = await supabase.from('admin_users').select('admin_roles(permissions)').eq('user_id', user.id).maybeSingle()
  const roles = adminRecord?.admin_roles as { permissions?: string[] } | { permissions?: string[] }[] | null | undefined
  const permissions = Array.isArray(roles) ? (roles[0]?.permissions ?? []) : (roles?.permissions ?? [])
  return permissions.includes('*') || permissions.includes(requiredPermission) ? user : null
}

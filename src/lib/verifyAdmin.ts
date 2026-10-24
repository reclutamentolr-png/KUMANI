import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

// Admin "pieno": profiles.is_admin oppure un ruolo con il permesso '*'.
// Solo loro possono nominare altri admin o impersonare un admin.
export async function isFullAdmin(userId: string) {
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [{ data: profile }, { data: adminRecord }] = await Promise.all([
    db.from('profiles').select('is_admin').eq('id', userId).maybeSingle(),
    db.from('admin_users').select('admin_roles(permissions)').eq('user_id', userId).maybeSingle(),
  ])
  if (profile?.is_admin) return true
  const roles = adminRecord?.admin_roles as { permissions?: string[] } | { permissions?: string[] }[] | null | undefined
  const permissions = Array.isArray(roles) ? (roles[0]?.permissions ?? []) : (roles?.permissions ?? [])
  return permissions.includes('*')
}

// Regali a sé stessi (abbonamenti, punti, coupon, Pass): solo un
// amministratore completo. Lo Staff con permessi limitati li fa per gli altri.
export async function selfRewardRefused(adminId: string, targetId: string | null | undefined) {
  return !!targetId && targetId === adminId && !(await isFullAdmin(adminId))
}

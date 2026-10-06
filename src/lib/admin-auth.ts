import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Permission = 
  | '*' 
  | 'users.read' | 'users.write' | 'users.delete'
  | 'matrix.read' | 'matrix.write'
  | 'marketplace.read' | 'marketplace.write'
  | 'listings.read' | 'listings.write'
  | 'coupons.read' | 'coupons.write'
  | 'vouchers.read' | 'vouchers.write'
  | 'rewards.read' | 'rewards.write'
  | 'stats.read'
  | 'support.read' | 'support.write'
  | 'settings.read' | 'settings.write'

export async function getAdminPermissions(): Promise<Permission[]> {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return []
    }

    // ✅ FIX: Usa .maybeSingle() invece di .single()
    // .maybeSingle() restituisce null se non trova righe, invece di lanciare errore
    const { data: adminUser, error: queryError } = await supabase
      .from('admin_users')
      .select('role_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Se c'è un errore (diverso da "nessuna riga"), loggalo
    if (queryError && queryError.code !== 'PGRST116') {
      console.error(' Errore query admin_users:', queryError)
      return []
    }

    // Se l'utente non è admin (nessuna riga trovata), ritorna array vuoto
    if (!adminUser) {
      return []
    }

    // ✅ FIX: Anche qui usa .maybeSingle()
    const { data: roleData, error: roleError } = await supabase
      .from('admin_roles')
      .select('name, permissions')
      .eq('id', adminUser.role_id)
      .maybeSingle()

    if (roleError && roleError.code !== 'PGRST116') {
      console.error('❌ Errore query admin_roles:', roleError)
      return []
    }

    if (!roleData) {
      return []
    }

    const permissions = roleData.permissions || []
    
    if (permissions.includes('*')) {
      return ['*']
    }

    return permissions as Permission[]
  } catch (error) {
    console.error('❌ Errore generico in getAdminPermissions:', error)
    return []
  }
}

// Versione veloce per la dashboard (solo per mostrare il pulsante Admin):
// una sola lettura, ruolo con i suoi permessi. Chi ha profiles.is_admin lo
// sa già dal profilo. La protezione vera resta nella pagina Admin.
export async function hasAdminRole(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('admin_users').select('admin_roles(permissions)').eq('user_id', userId).maybeSingle()
  const roles = data?.admin_roles as { permissions?: string[] | null } | { permissions?: string[] | null }[] | null | undefined
  const permissions = Array.isArray(roles) ? roles[0]?.permissions : roles?.permissions
  return Array.isArray(permissions) && permissions.length > 0
}

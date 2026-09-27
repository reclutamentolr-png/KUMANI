import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, Shield } from 'lucide-react'
import AdminDashboard from '@/components/AdminDashboard'
import { Permission } from '@/lib/admin-permissions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Tutti i permessi del pannello (admin completo): stesso elenco del tipo
// Permission in src/lib/admin-permissions.ts, così una nuova sezione non
// resta nascosta a chi ha pieni poteri.
const ALL_PERMISSIONS: Permission[] = [
  'users.read',
  'users.write',
  'users.delete',
  'matrix.read',
  'matrix.write',
  'marketplace.read',
  'marketplace.write',
  'listings.read',
  'listings.write',
  'coupons.read',
  'coupons.write',
  'vouchers.read',
  'vouchers.write',
  'rewards.read',
  'rewards.write',
  'messages.read',
  'messages.write',
  'stats.read',
  'support.read',
  'support.write',
  'settings.read',
  'settings.write',
]

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ section?: string | string[] }>
}) {
  const { locale } = await params
  // Sezione attiva tenuta nell'URL (?section=...): un refresh riapre la
  // stessa voce invece di tornare sempre alla Panoramica.
  const { section } = await searchParams
  const initialSection = typeof section === 'string' ? section : undefined
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, first_name, last_name')
    .eq('id', user.id)
    .single()
  
  // ✅ Join semplice (senza !inner, più sicuro)
  const { data: adminRecord } = await supabase
    .from('admin_users')
    .select('role_id, admin_roles(permissions)')
    .eq('user_id', user.id)
    .single()

  const isAdmin = profile?.is_admin || adminRecord
  
  if (!isAdmin) {
    redirect(`/${locale}/dashboard`)
  }
  
  // ✅ ROBUSTO: admin_roles può essere un OGGETTO o un ARRAY
  const roles: any = (adminRecord as any)?.admin_roles
  const rawPermissions: any[] = Array.isArray(roles)
    ? (roles?.[0]?.permissions || [])
    : (roles?.permissions || [])

  // ✅ WILDCARD: se il ruolo ha ["*"], espandi in tutti i permessi
  // Anche profiles.is_admin è un admin completo (come in verifyAdmin lato server).
  const permissions: Permission[] = profile?.is_admin || rawPermissions.includes('*')
    ? ALL_PERMISSIONS
    : (rawPermissions as Permission[])


  const userName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[var(--gold-pale)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-white hover:text-[var(--gold-bright)] font-medium transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Torna alla Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--gold-bright)]" />
            <h1 className="text-xl font-bold text-white">Pannello Amministratore</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminDashboard 
          userId={user.id}
          permissions={permissions}
          userName={userName}
          locale={locale}
          initialSection={initialSection}
        />
      </main>
    </div>
  )
}
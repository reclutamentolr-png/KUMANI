import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import MaintenanceScreen from '@/components/MaintenanceScreen'
import { createClient } from '@/lib/supabase/server'

// Pagina mostrata dal proxy durante la manutenzione (Admin → Impostazioni).
// Finita la manutenzione si torna alla Home.
export default async function MaintenancePage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('maintenance_status')
  const state = data as { enabled?: boolean; message?: string } | null
  if (!state?.enabled) {
    const locale = await getLocale()
    redirect(locale === 'it' ? '/' : `/${locale}`)
  }
  return <MaintenanceScreen message={state?.message || 'Sito in manutenzione. Torna presto!'} />
}

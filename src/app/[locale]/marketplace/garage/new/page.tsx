import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import VehicleFormView from '@/components/garage/VehicleFormView'

export const dynamic = 'force-dynamic'

export default async function NewVehiclePage() {
  const t = await getTranslations('garage')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const spendlyAvailable = await hasActiveToolAccess(supabase, user!.id, 'spendly')

  return (
    <div className="space-y-5">
      <Link href="/marketplace/garage" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> {t('backToGarage')}
      </Link>
      <h1 className="text-2xl font-bold text-[var(--ink)]">{t('newVehicleTitle')}</h1>
      <VehicleFormView spendlyAvailable={spendlyAvailable} />
    </div>
  )
}

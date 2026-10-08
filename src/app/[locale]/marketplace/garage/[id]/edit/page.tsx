import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { defaultLocale } from '../../../../../../../i18n'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { loadGarage } from '@/lib/garage-server'
import VehicleFormView from '@/components/garage/VehicleFormView'

export const dynamic = 'force-dynamic'

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('garage')
  const [supabase, locale] = await Promise.all([createClient(), getLocale()])
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ vehicles }, spendlyAvailable] = await Promise.all([loadGarage(supabase, user!.id, id), hasActiveToolAccess(supabase, user!.id, 'spendly')])
  const vehicle = vehicles[0]
  // Eliminato (anche da un'altra finestra): si torna all'elenco, non alla 404
  if (!vehicle) redirect(`${locale === defaultLocale ? '' : `/${locale}`}/marketplace/garage`)

  return (
    <div className="space-y-5">
      <Link href={`/marketplace/garage/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> {vehicle.name}
      </Link>
      <h1 className="text-2xl font-bold text-[var(--ink)]">{t('editVehicleTitle')}</h1>
      <VehicleFormView vehicle={vehicle} spendlyAvailable={spendlyAvailable} />
    </div>
  )
}

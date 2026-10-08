import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { loadGarage } from '@/lib/garage-server'
import { todayKey } from '@/lib/agenda'
import VehicleDetail from '@/components/garage/VehicleDetail'

export const dynamic = 'force-dynamic'

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('garage')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ vehicles, readings, deadlines, expenses, documents, fileUrls }, spendlyAvailable] = await Promise.all([
    loadGarage(supabase, user!.id, id),
    hasActiveToolAccess(supabase, user!.id, 'spendly'),
  ])
  const vehicle = vehicles[0]
  if (!vehicle) notFound()

  return (
    <div className="space-y-5">
      <Link href="/marketplace/garage" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> {t('backToGarage')}
      </Link>
      <VehicleDetail vehicle={vehicle} readings={readings} deadlines={deadlines} expenses={expenses} today={todayKey()} spendlyAvailable={spendlyAvailable} documents={documents} fileUrls={fileUrls} />
    </div>
  )
}

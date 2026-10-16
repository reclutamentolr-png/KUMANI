import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, BookUser } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ClienteCard from '@/components/clienti/ClienteCard'
import { getClientCard, getClientExtras } from '@/app/actions/clienti'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { toolMetadata } from '@/lib/toolMetadata'
import HubBar from '@/components/hubs/HubBar'

export const generateMetadata = toolMetadata('clienti')

// Scheda del cliente: contatti, conti dai preventivi, prossimo passo e note
export default async function ClientePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params
  const t = await getTranslations('clienti')
  const data = await getClientCard(id)
  if (!data) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [canQuote, canReceipt, extras] = await Promise.all([
    user ? hasActiveToolAccess(supabase, user.id, 'preventivi') : Promise.resolve(false),
    user ? hasActiveToolAccess(supabase, user.id, 'digital-receipt') : Promise.resolve(false),
    getClientExtras(id, data.client.phone),
  ])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 gap-3">
          <Link href="/marketplace/clienti" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)] shrink-0">
            <ArrowLeft className="h-5 w-5" />
            {t('title')}
          </Link>
          <p className="flex items-center gap-2 font-semibold tracking-wide">
            <BookUser className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('cardTitle')}
          </p>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <ClienteCard client={data.client} quotes={data.quotes} jobs={data.jobs} payments={data.payments} canQuote={canQuote} orders={extras.orders} stamps={extras.stamps} canReceipt={canReceipt} />
      </main>
    </div>
  )
}

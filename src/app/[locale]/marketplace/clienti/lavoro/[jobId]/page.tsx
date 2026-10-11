import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Hammer } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ClientJobView from '@/components/clienti/ClientJobView'
import { getJob } from '@/app/actions/clienti'
import { toolMetadata } from '@/lib/toolMetadata'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'

export const generateMetadata = toolMetadata('clienti')

// Lavoro di un cliente: stato, conti, pagamenti, cose da fare e dettagli
export default async function ClientJobPage({ params }: { params: Promise<{ locale: string; jobId: string }> }) {
  const { jobId } = await params
  const t = await getTranslations('clienti')
  const data = await getJob(jobId)
  if (!data) notFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const canReceipt = user ? await hasActiveToolAccess(supabase, user.id, 'digital-receipt') : false

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <Link
            href={`/marketplace/clienti/${data.client.id}`}
            className="flex min-w-0 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            <span className="truncate">{data.client.name}</span>
          </Link>
          <p className="flex shrink-0 items-center gap-2 font-semibold tracking-wide">
            <Hammer className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('jobs.pageTitle')}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <ClientJobView
          job={data.job}
          client={data.client}
          payments={data.payments}
          quote={data.quote}
          quotes={data.quotes}
          entries={data.entries}
          costs={data.costs}
          files={data.files}
          products={data.products}
          canReceipt={canReceipt}
        />
      </main>
    </div>
  )
}

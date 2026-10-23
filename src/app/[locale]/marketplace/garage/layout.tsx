import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, CarFront } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import HubBar from '@/components/hubs/HubBar'

// Kumani Garage: accesso (piano Plus o Pass) e intestazione comuni a tutte
// le pagine del servizio.
export default async function GarageLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const commonT = await getTranslations('common')
  const marketplaceT = await getTranslations('marketplace')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!(await hasActiveToolAccess(supabase, user.id, 'garage'))) redirect(`/${locale}/dashboard`)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            label={
              <>
                <ArrowLeft className="h-5 w-5" /> {commonT('backToServices')}
              </>
            }
          />
          <span className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <CarFront className="h-5 w-5 text-[var(--gold-bright)] shrink-0" /> {marketplaceT('garage')}
          </span>
        </div>
      </header>
      {/* Servizio unito «Casa e auto» (lib/serviceHubs) */}
      <HubBar />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">{children}</main>
    </div>
  )
}

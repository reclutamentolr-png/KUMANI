import { Suspense } from 'react'
import HubNav from '@/components/hubs/HubNav'
import { createClient } from '@/lib/supabase/server'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { HUB_TOOLS } from '@/lib/serviceHubs'
import { getDisabledTools } from '@/lib/freeTools'

// Barra dei servizi uniti (vedi lib/serviceHubs) con i lucchetti
// delle schede che il piano non comprende. Va nei layout dei controlli.
export default async function HubBar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // Spenti dall'Admin: la scheda non si mostra; fuori dal piano: lucchetto
  const hidden = (await getDisabledTools()).filter((tool) => HUB_TOOLS.has(tool))
  let locked: string[] = []
  if (user) {
    const access = await getMarketplaceAccessState(supabase, user.id)
    locked = [...HUB_TOOLS].filter((tool) => !hidden.includes(tool) && !access.isToolEnabled(tool))
  }
  return (
    <Suspense fallback={null}>
      <HubNav locked={locked} hidden={hidden} />
    </Suspense>
  )
}

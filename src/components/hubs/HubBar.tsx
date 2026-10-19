import { Suspense } from 'react'
import HubNav from '@/components/hubs/HubNav'
import { createClient } from '@/lib/supabase/server'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { HUB_TOOLS } from '@/lib/serviceHubs'
import { getDisabledTools } from '@/lib/freeTools'
import { getFavoriteToolNames } from '@/lib/favorites'

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
  // Servizi già nella Home (stella «Nella Home» del servizio aperto)
  let favorites: string[] | null = null
  if (user) {
    const [access, favs] = await Promise.all([getMarketplaceAccessState(supabase, user.id), getFavoriteToolNames(supabase, user.id)])
    favorites = favs
    locked = [...HUB_TOOLS].filter((tool) => !hidden.includes(tool) && !access.isToolEnabled(tool))
  }
  return (
    <Suspense fallback={null}>
      <HubNav locked={locked} hidden={hidden} favorites={favorites} />
    </Suspense>
  )
}

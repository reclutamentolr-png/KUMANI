'use server'

import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { getServicesCatalog, type ServiceItem } from '@/lib/servicesCatalog'
import { serviceGroupOf, type ServiceGroup } from '@/lib/serviceGroups'

export type RelatedServices = { group: ServiceGroup; items: ServiceItem[]; extra: ServiceItem[] }

// "Scopri gli altri servizi" in fondo a ogni servizio: gli altri del suo
// gruppo (con lo stato per l'utente) e, se sono pochi, qualche servizio
// gratuito di altri gruppi. Si carica solo quando si apre la finestra.
export async function getRelatedServices(toolName: string): Promise<RelatedServices | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { items } = await getServicesCatalog(supabase, user.id, await getLocale())
  const group = serviceGroupOf(toolName)
  const same = items.filter((item) => item.group === group && item.toolName !== toolName)
  // Prima quelli che può già aprire, poi quelli da sbloccare
  same.sort((a, b) => Number(b.open) - Number(a.open))
  const extra = same.length < 3 ? items.filter((item) => item.group !== group && item.open && item.plan === 'free').slice(0, 3 - same.length) : []
  return { group, items: same, extra }
}

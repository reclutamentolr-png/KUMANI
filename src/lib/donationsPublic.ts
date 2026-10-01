import { revalidateTag, unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { DonationSummary } from '@/lib/donationTypes'

// Riepilogo pubblico delle donazioni (Homepage, pagina Donazioni, dashboard,
// Portafoglio): uguale per tutti, in memoria 5 minuti; si aggiorna subito
// dopo una modifica dall'Admin, una donazione di punti o un pagamento.
export const DONATIONS_CACHE_TAG = 'donations'

const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export const getPublicDonationSummary = unstable_cache(
  async (): Promise<DonationSummary | null> => {
    const { data, error } = await anon().rpc('donation_public_summary')
    if (error || !data) return null
    return data as DonationSummary
  },
  ['donation-summary'],
  { tags: [DONATIONS_CACHE_TAG], revalidate: 300 }
)

export function refreshDonationSummary() {
  revalidateTag(DONATIONS_CACHE_TAG, { expire: 0 })
}

import 'server-only'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Nomi scelti per gli indirizzi pubblici: kumani.io/page/<nome> (Landing
// Page) e kumani.io/bio/<nome> (Link in Bio). Sono due elenchi diversi, ma un
// nome preso da qualcuno in uno non lo può prendere un altro nell'altro:
// chi ha kumani.io/page/community può avere anche kumani.io/bio/community,
// nessun altro sì (niente pagine che si fingono di un'altra persona).

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// true = il nome è già usato da un altro iscritto (Landing o Link in Bio)
export async function nameUsedByOthers(slug: string, userId: string): Promise<boolean> {
  const service = db()
  const [{ data: landing }, { data: bios }] = await Promise.all([
    service.from('landing_pages').select('owner_id').eq('slug', slug).maybeSingle(),
    service.from('link_in_bio').select('user_id').eq('slug', slug),
  ])
  if (landing && landing.owner_id !== userId) return true
  return (bios ?? []).some((b) => b.user_id !== userId)
}

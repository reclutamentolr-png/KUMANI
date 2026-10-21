import { unstable_cache } from 'next/cache'
import { pushDb } from '@/lib/push'
import { verifyAdmin } from '@/lib/verifyAdmin'

// KUMANI Risolvi: acceso per tutti (Admin) o, da spento, solo per lo Staff
export const SOLVE_CACHE_TAG = 'solve'

export const getSolveEnabled = unstable_cache(
  async (): Promise<boolean> => {
    const { data } = await pushDb().from('system_settings').select('value').eq('key', 'solve_enabled').maybeSingle()
    return String(data?.value ?? '').replace(/"/g, '') === 'true'
  },
  ['solve-enabled'],
  { tags: [SOLVE_CACHE_TAG], revalidate: 300 }
)

// Chi può vedere le guide adesso: tutti gli iscritti se acceso, lo Staff sempre
export async function canSeeSolve(): Promise<boolean> {
  if (await getSolveEnabled()) return true
  return !!(await verifyAdmin('users.read'))
}

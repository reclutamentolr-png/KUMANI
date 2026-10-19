'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { CHRISTMAS_CACHE_TAG, christmasState, parseChristmas, romeDate, type ChristmasSettings, type ChristmasState } from '@/lib/christmas'
import { CHRISTMAS_PREVIEW_COOKIE } from '@/lib/christmasPreview'

// Admin → Natale: decorazioni (ghirlanda e cappello) e offerta di Natale,
// salvate in system_settings.christmas (vedi lib/christmasShared.ts)
const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

type ChristmasAdmin = { settings: ChristmasSettings; state: ChristmasState; preview: boolean }

async function read(): Promise<ChristmasAdmin> {
  const { data } = await db().from('system_settings').select('value').eq('key', 'christmas').maybeSingle()
  const settings = parseChristmas(data?.value ?? null)
  return {
    settings,
    state: christmasState(settings, romeDate(new Date())),
    preview: (await cookies()).get(CHRISTMAS_PREVIEW_COOKIE)?.value === '1',
  }
}

export async function adminGetChristmas(): Promise<ChristmasAdmin | { error: string }> {
  if (!(await verifyAdmin('settings.read'))) return { error: 'Non autorizzato' }
  return read()
}

export async function adminSaveChristmas(input: ChristmasSettings): Promise<({ success: true } & ChristmasAdmin) | { success: false; error: string }> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const settings = parseChristmas(input)
  if (settings.from > settings.until) return { success: false, error: 'La data di inizio è dopo quella di fine' }
  const { error } = await db().from('system_settings').upsert({ key: 'christmas', value: JSON.stringify(settings) }, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  // Anche la homepage pubblica (cappello sul logo) usa questa memoria: si rifà subito
  updateTag(CHRISTMAS_CACHE_TAG)
  return { success: true, ...(await read()) }
}

// Anteprima delle decorazioni solo per chi la accende (cookie, vale per gli admin)
export async function adminSetChristmasPreview(on: boolean) {
  if (!(await verifyAdmin('settings.read'))) return { success: false }
  const jar = await cookies()
  if (on) jar.set(CHRISTMAS_PREVIEW_COOKIE, '1', { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', httpOnly: true })
  else jar.delete(CHRISTMAS_PREVIEW_COOKIE)
  return { success: true }
}

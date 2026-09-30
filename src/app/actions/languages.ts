'use server'

import { revalidateTag } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { ALL_SITE_LOCALES, ENABLED_LOCALES_KEY, ENABLED_LOCALES_TAG, readEnabledLocales } from '@/lib/enabledLocalesCore'

// Admin → Generale → Lingue del sito
export async function adminGetEnabledLocales() {
  if (!(await verifyAdmin('settings.read'))) return { success: false as const, error: 'Non autorizzato' }
  try {
    return { success: true as const, locales: await readEnabledLocales() }
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Lettura non riuscita' }
  }
}

export async function adminSetEnabledLocales(locales: string[]) {
  if (!(await verifyAdmin('settings.write'))) return { success: false as const, error: 'Non autorizzato' }
  // L'italiano è la base: sempre attivo
  const list = ALL_SITE_LOCALES.filter((l) => l === 'it' || locales.includes(l))
  const { error } = await createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
    .from('system_settings')
    .upsert({ key: ENABLED_LOCALES_KEY, value: JSON.stringify(list) }, { onConflict: 'key' })
  if (error) return { success: false as const, error: error.message }
  revalidateTag(ENABLED_LOCALES_TAG, { expire: 0 })
  return { success: true as const, locales: list }
}

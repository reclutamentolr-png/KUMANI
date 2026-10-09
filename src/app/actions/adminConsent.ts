'use server'

import { updateTag } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { isConsentCategory, type ConsentCategory } from '@/lib/consent'
import { COOKIE_CONSENT_CACHE_TAG, COOKIE_CONSENT_SETTING, getActiveConsentCategories } from '@/lib/consentServer'

// Admin → Impostazioni → Cookie facoltativi: quali categorie chiedono il
// consenso (banner e «Preferenze cookie»). Vale subito su tutto il sito.

export async function adminGetCookieConsent(): Promise<{ categories: ConsentCategory[]; error?: string }> {
  if (!(await verifyAdmin('settings.read'))) return { categories: [], error: 'Non autorizzato' }
  return { categories: await getActiveConsentCategories() }
}

export async function adminSetCookieConsent(categories: string[]) {
  if (!(await verifyAdmin('settings.write'))) return { success: false as const, error: 'Non autorizzato' }
  const clean = [...new Set((Array.isArray(categories) ? categories : []).filter(isConsentCategory))]
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await db.from('system_settings').upsert({ key: COOKIE_CONSENT_SETTING, value: JSON.stringify(clean) }, { onConflict: 'key' })
  if (error) return { success: false as const, error: error.message }
  updateTag(COOKIE_CONSENT_CACHE_TAG)
  return { success: true as const, categories: clean }
}

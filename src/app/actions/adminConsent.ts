'use server'

import { updateTag } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { CONSENT_OFF, isConsentCategory, parseConsentConfig, type ConsentConfig } from '@/lib/consent'
import { COOKIE_CONSENT_CACHE_TAG, COOKIE_CONSENT_SETTING } from '@/lib/consentServer'

// Admin → Impostazioni → Banner cookie: acceso o spento e quali categorie
// facoltative chiedono il consenso. Vale subito su tutto il sito.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export async function adminGetCookieConsent(): Promise<{ config: ConsentConfig; error?: string }> {
  if (!(await verifyAdmin('settings.read'))) return { config: CONSENT_OFF, error: 'Non autorizzato' }
  // Valore vero dal database (non quello in memoria del sito)
  const { data, error } = await db().from('system_settings').select('value').eq('key', COOKIE_CONSENT_SETTING).maybeSingle()
  if (error) return { config: CONSENT_OFF, error: error.message }
  let value: unknown = data?.value
  try {
    value = typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    value = null
  }
  return { config: parseConsentConfig(value) }
}

export async function adminSetCookieConsent(input: { enabled: boolean; categories: string[] }) {
  if (!(await verifyAdmin('settings.write'))) return { success: false as const, error: 'Non autorizzato' }
  const enabled = input?.enabled === true
  const categories = enabled ? [...new Set((Array.isArray(input?.categories) ? input.categories : []).filter(isConsentCategory))] : []
  const clean: ConsentConfig = { enabled, categories }
  const { error } = await db().from('system_settings').upsert({ key: COOKIE_CONSENT_SETTING, value: JSON.stringify(clean) }, { onConflict: 'key' })
  if (error) return { success: false as const, error: error.message }
  updateTag(COOKIE_CONSENT_CACHE_TAG)
  return { success: true as const, config: clean }
}

'use server'

import { getMessages } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { DOC_LOCALES, type DocLocale } from '@/lib/documents'

// Testi della presentazione in una lingua (con le correzioni dei traduttori),
// per crearla nel browser al momento del download. Solo per gli iscritti.
export async function getDeckTexts(locale: string): Promise<{ texts?: unknown; minPassEur?: number | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  if (!DOC_LOCALES.includes(locale as DocLocale)) return { error: 'locale' }
  const messages = (await getMessages({ locale })) as Record<string, unknown>
  // Prezzo del Pass più economico tra i servizi vendibili da soli (Admin)
  const { data: passes } = await supabase.from('marketplace_settings').select('pass_price_cents').eq('pass_enabled', true).eq('is_enabled', true).neq('required_plan', 'free')
  const cents = (passes ?? []).map((p) => p.pass_price_cents as number).filter((n) => n > 0)
  const minPassEur = cents.length ? Math.min(...cents) / 100 : null
  return messages.deckTexts ? { texts: messages.deckTexts, minPassEur } : { error: 'missing' }
}

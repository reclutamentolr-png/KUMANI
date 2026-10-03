'use server'

import { getMessages } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { DOC_LOCALES, type DocLocale } from '@/lib/documents'

// Testi della presentazione in una lingua (con le correzioni dei traduttori),
// per crearla nel browser al momento del download. Solo per gli iscritti.
export async function getDeckTexts(locale: string): Promise<{ texts?: unknown; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  if (!DOC_LOCALES.includes(locale as DocLocale)) return { error: 'locale' }
  const messages = (await getMessages({ locale })) as Record<string, unknown>
  return messages.deckTexts ? { texts: messages.deckTexts } : { error: 'missing' }
}

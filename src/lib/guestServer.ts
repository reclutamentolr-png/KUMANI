import { createClient } from '@/lib/supabase/server'
import { isGuestUser } from '@/lib/trials'

// Ospite in prova (codice di prova)? Per bloccare dal server ciò che in prova
// non si può fare: AI, QR per i clienti, pubblicazione.
export async function isGuestRequest(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return isGuestUser(user)
}

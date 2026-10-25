'use server'

import { verifyAdmin } from '@/lib/verifyAdmin'
import { getEmailUsage, type EmailUsage } from '@/lib/emailUsage'

// Admin: email del giorno e del mese rispetto ai limiti di Resend (avviso al 90%)
export async function adminEmailUsage(): Promise<EmailUsage | null> {
  if (!(await verifyAdmin('messages.read'))) return null
  return getEmailUsage()
}

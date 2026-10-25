import { createHmac, timingSafeEqual } from 'crypto'
import { PUBLIC_SITE_URL } from '@/lib/siteUrl'

// Link «Non ricevere più queste email» nelle comunicazioni a tutti gli
// iscritti: firmato con la chiave del server, così funziona senza accedere
// e nessuno può disiscrivere un'altra persona cambiando l'indirizzo.

// Chiave propria (EMAIL_UNSUB_SECRET) se c'è: così cambiare la chiave del
// database non rende inutili i link già spediti
const secret = () => process.env.EMAIL_UNSUB_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!
const sign = (userId: string) => createHmac('sha256', secret()).update(`email-unsub:${userId}`).digest('base64url')

export function unsubscribeUrl(userId: string, communicationId?: string, locale?: string) {
  const params = new URLSearchParams({ u: userId, t: sign(userId) })
  if (communicationId) params.set('c', communicationId)
  if (locale) params.set('l', locale)
  return `${PUBLIC_SITE_URL}/api/email/unsubscribe?${params.toString()}`
}

export function validUnsubscribe(userId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !token) return false
  const expected = Buffer.from(sign(userId))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

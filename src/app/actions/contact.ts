'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { locales } from '../../../i18n'

// Modulo della pagina Contatti: funziona anche senza login. La tabella
// contact_messages non ha policy RLS, quindi scrive solo il client di servizio
// (dopo validazione e limite di invii).

export type ContactTopic = 'support' | 'billing' | 'pro' | 'partnership' | 'privacy' | 'other'

const CONTACT_TOPICS: ContactTopic[] = ['support', 'billing', 'pro', 'partnership', 'privacy', 'other']

export type ContactInput = {
  name: string
  email: string
  topic: string
  message: string
  consent: boolean
  website?: string // honeypot: resta vuoto per le persone vere
  locale?: string
}

// Codici d'errore: il client li traduce con il namespace contactPage.
export type ContactError =
  | 'invalidName'
  | 'invalidEmail'
  | 'invalidTopic'
  | 'invalidMessage'
  | 'consentRequired'
  | 'rateLimited'
  | 'generic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_PER_EMAIL_PER_HOUR = 3
const MAX_PER_USER_PER_HOUR = 3

const getServiceClient = () =>
  createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

export async function sendContactMessage(
  input: ContactInput
): Promise<{ success: true } | { error: ContactError }> {
  // Honeypot compilato: quasi certamente un bot. Fingiamo che sia andato tutto bene.
  if (typeof input?.website === 'string' && input.website.trim() !== '') return { success: true }

  const name = String(input?.name ?? '').trim().replace(/\s+/g, ' ')
  const email = String(input?.email ?? '').trim().toLowerCase()
  const topic = String(input?.topic ?? '')
  const message = String(input?.message ?? '').trim()
  const locale = locales.includes(String(input?.locale)) ? String(input?.locale) : 'it'

  if (name.length < 2 || name.length > 100) return { error: 'invalidName' }
  if (email.length < 5 || email.length > 200 || !EMAIL_RE.test(email)) return { error: 'invalidEmail' }
  if (!CONTACT_TOPICS.includes(topic as ContactTopic)) return { error: 'invalidTopic' }
  if (message.length < 10 || message.length > 3000) return { error: 'invalidMessage' }
  if (input?.consent !== true) return { error: 'consentRequired' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const service = getServiceClient()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Limite per email (l'indice è su lower(email); salviamo già in minuscolo).
  const { count: byEmail, error: countError } = await service
    .from('contact_messages')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', since)
  if (countError) return { error: 'generic' }
  if ((byEmail ?? 0) >= MAX_PER_EMAIL_PER_HOUR) return { error: 'rateLimited' }

  // Limite per utente loggato (anche se cambia l'email nel modulo).
  if (user) {
    const { count: byUser, error: userCountError } = await service
      .from('contact_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since)
    if (userCountError) return { error: 'generic' }
    if ((byUser ?? 0) >= MAX_PER_USER_PER_HOUR) return { error: 'rateLimited' }
  }

  const { error } = await service.from('contact_messages').insert({
    user_id: user?.id ?? null,
    name,
    email,
    topic,
    message,
    locale,
    status: 'new',
  })
  if (error) return { error: 'generic' }

  return { success: true }
}

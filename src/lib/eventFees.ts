import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

// Segna come pagate le commissioni Events di una sessione Stripe conclusa.
// Usata dal webhook e, come riserva, dalla pagina di ritorno dopo il pagamento.
export async function markEventFeesPaid(sessionId: string, organizerId?: string): Promise<boolean> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId)
  if (session.metadata?.type !== 'event_fee' || session.payment_status !== 'paid') return false
  if (organizerId && session.metadata?.organizerId !== organizerId) return false
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await service
    .from('event_fees')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('stripe_session_id', sessionId)
    .eq('organizer_id', session.metadata.organizerId ?? '')
    .eq('status', 'due')
  if (error) throw new Error(error.message)
  return true
}

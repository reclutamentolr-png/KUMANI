import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

// Pass servizio: un solo servizio per un anno, senza abbonamento.
// Il pass non dà KU Points a chi ha invitato (il pagamento non è una fattura
// di abbonamento) e non cambia il prezzo di Base/Pro.

export const TOOL_PASS_DAYS = 365
export const TOOL_PASS_TYPE = 'tool_pass'

export interface ToolPassOffer {
  enabled: boolean
  priceCents: number
  requiredPlan: 'free' | 'base' | 'pro'
  known: boolean
}

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Offerta del pass per un servizio (impostata dall'Admin)
export async function getToolPassOffer(supabase: SupabaseClient, tool: string): Promise<ToolPassOffer> {
  const { data, error } = await supabase
    .from('marketplace_settings')
    .select('is_enabled, required_plan, pass_enabled, pass_price_cents')
    .eq('tool_name', tool)
    .maybeSingle()
  if (error || !data) return { enabled: false, priceCents: 0, requiredPlan: 'base', known: false }
  return {
    enabled: data.is_enabled !== false && data.pass_enabled === true && data.required_plan !== 'free',
    priceCents: data.pass_price_cents ?? 1000,
    requiredPlan: (data.required_plan ?? 'base') as ToolPassOffer['requiredPlan'],
    known: true,
  }
}

// Pass attivi dell'utente collegato: servizio → scadenza
export async function getMyToolPasses(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.rpc('my_tool_passes')
  if (error || !Array.isArray(data)) return new Map()
  return new Map((data as { tool: string; expires_at: string }[]).map((row) => [row.tool, row.expires_at]))
}

// Pagamento completato: assegna il pass (idempotente per sessione).
// Restituisce la scadenza, oppure null se la sessione non è un pass pagato.
export async function grantToolPassFromSession(session: Stripe.Checkout.Session): Promise<string | null> {
  const meta = session.metadata ?? {}
  if (meta.type !== TOOL_PASS_TYPE || !meta.userId || !meta.tool) return null
  if (session.payment_status !== 'paid') return null
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null)
  const { data, error } = await service().rpc('grant_tool_pass', {
    p_user_id: meta.userId,
    p_tool: meta.tool,
    p_days: TOOL_PASS_DAYS,
    p_source: 'stripe',
    p_session_id: session.id,
    p_payment_intent: paymentIntent,
    p_amount_cents: session.amount_total ?? 0,
    p_code: null,
  })
  if (error) throw new Error(`Pass non assegnato: ${error.message}`)
  return data as string
}

// Ritorno da Stripe (pagina del pass): se il webhook non è ancora arrivato,
// o in locale non c'è, si verifica la sessione e si assegna il pass.
export async function confirmToolPassSession(sessionId: string, userId: string): Promise<string | null> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.metadata?.userId !== userId) return null
    return await grantToolPassFromSession(session)
  } catch (err) {
    console.error('⚠️ Conferma pass servizio:', err instanceof Error ? err.message : err)
    return null
  }
}

// Rimborso: il pass pagato con quel pagamento viene revocato
export async function revokeToolPassForCharge(charge: Stripe.Charge): Promise<void> {
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntent || !charge.amount_refunded) return
  const { error } = await service().rpc('revoke_tool_pass_payment', { p_payment_intent: paymentIntent })
  if (error) throw new Error(`Pass non revocato: ${error.message}`)
}

// Codice pass leggibile: PASS-XXXX-XXXX (senza caratteri ambigui)
export function generatePassCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `PASS-${part()}-${part()}`
}

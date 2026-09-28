import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

// Commissioni KUMANI pagate con carta (Stripe Checkout, pagamento singolo):
// - 'event_fee'    → tabella event_fees,    proprietario in metadata.organizerId
// - 'convivio_fee' → tabella convivio_fees, proprietario in metadata.supplierId
// I metadati non contengono mai "userId" (quello attiva gli abbonamenti).
export type PlatformFeeType = 'event_fee' | 'convivio_fee'

const FEE_TARGETS: Record<PlatformFeeType, { table: string; ownerColumn: string; ownerKey: string }> = {
  event_fee: { table: 'event_fees', ownerColumn: 'organizer_id', ownerKey: 'organizerId' },
  convivio_fee: { table: 'convivio_fees', ownerColumn: 'supplier_id', ownerKey: 'supplierId' },
}

export const isPlatformFeeType = (value: unknown): value is PlatformFeeType => value === 'event_fee' || value === 'convivio_fee'

// Segna come pagate le commissioni di una sessione Stripe conclusa.
// Usata dal webhook e, come riserva, dalle pagine di ritorno dopo il pagamento.
// `expectedType` (se indicato) impedisce di usare una sessione dell'altro servizio;
// `ownerId` (se indicato) deve coincidere con il proprietario nei metadati.
export async function markPlatformFeesPaid(sessionId: string, options: { expectedType?: PlatformFeeType; ownerId?: string } = {}): Promise<boolean> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId)
  const type = session.metadata?.type
  if (!isPlatformFeeType(type) || session.payment_status !== 'paid') return false
  if (options.expectedType && type !== options.expectedType) return false
  const target = FEE_TARGETS[type]
  const owner = session.metadata?.[target.ownerKey] ?? ''
  if (!owner) return false
  if (options.ownerId && owner !== options.ownerId) return false
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  // Commissioni pagate con questa sessione: gli id nei metadati (vale anche se
  // nel frattempo è stato aperto un altro checkout, che ha sovrascritto
  // stripe_session_id). Per le sessioni vecchie senza id: il session id.
  const feeIds = (session.metadata?.feeIds ?? '').split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  let query = service.from(target.table).select('id, amount, status').eq(target.ownerColumn, owner)
  query = feeIds.length ? query.in('id', feeIds) : query.eq('stripe_session_id', sessionId)
  const { data: rows, error: readError } = await query
  if (readError) throw new Error(readError.message)
  const due = (rows ?? []).filter((row) => row.status === 'due')
  if (due.length === 0) return (rows ?? []).length > 0 // già segnate pagate (webhook + pagina di ritorno)
  // L'importo pagato deve coprire le commissioni che si segnano pagate
  const dueCents = Math.round(due.reduce((sum, row) => sum + Number(row.amount), 0) * 100)
  if ((session.amount_total ?? 0) < dueCents) {
    console.error(`[Fees] session ${sessionId}: paid ${session.amount_total} < due ${dueCents}`)
    return false
  }
  const { data: updated, error } = await service
    .from(target.table)
    .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_session_id: sessionId })
    .in('id', due.map((row) => row.id))
    .eq(target.ownerColumn, owner)
    .eq('status', 'due')
    .select('id')
  if (error) throw new Error(error.message)
  return (updated ?? []).length > 0
}

// KUMANI Events (organizzatore)
export async function markEventFeesPaid(sessionId: string, organizerId?: string): Promise<boolean> {
  return markPlatformFeesPaid(sessionId, { expectedType: 'event_fee', ownerId: organizerId })
}

// Kordata (fornitore Pro)
export async function markConvivioFeesPaid(sessionId: string, supplierId?: string): Promise<boolean> {
  return markPlatformFeesPaid(sessionId, { expectedType: 'convivio_fee', ownerId: supplierId })
}

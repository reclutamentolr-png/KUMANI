'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { getStripe } from '@/lib/stripe'
import { awardActivationPoints } from '@/lib/networkPoints'

// Invito indicato dopo la registrazione (entro 15 giorni; lo Staff anche
// dopo). La persona passa nella stella di chi l'ha invitata e, se aveva già
// pagato l'abbonamento, il Kumano riceve i KU Points di quell'attivazione.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export type LateSponsorResult = { success: boolean; code: string; sponsorName?: string }

// Attivazioni già pagate con carta: i punti vanno al nuovo invitante (una volta per fattura)
async function awardPastActivations(userId: string) {
  if (!process.env.STRIPE_SECRET_KEY) return
  try {
    const stripe = getStripe()
    const subs = await stripe.subscriptions.search({ query: `metadata['userId']:'${userId}'`, limit: 10 })
    for (const sub of subs.data) {
      const invoices = await stripe.invoices.list({ subscription: sub.id, status: 'paid', limit: 20 })
      for (const invoice of invoices.data) await awardActivationPoints(invoice)
    }
  } catch (error) {
    console.error('[invito dopo la registrazione] punti non assegnati:', error)
  }
}

async function assign(userId: string, code: string, ignoreDeadline: boolean): Promise<LateSponsorResult> {
  const clean = code.trim().toUpperCase().slice(0, 40)
  if (!clean) return { success: false, code: 'invalid_code' }
  const { data, error } = await db().rpc('assign_late_sponsor', { p_user: userId, p_code: clean, p_ignore_deadline: ignoreDeadline })
  if (error) {
    console.error('[invito dopo la registrazione]', error.message)
    return { success: false, code: 'error' }
  }
  if (data !== 'ok') return { success: false, code: String(data) }
  await awardPastActivations(userId)
  const { data: sponsor } = await db().from('profiles').select('first_name').eq('referral_code', clean).maybeSingle()
  return { success: true, code: 'ok', sponsorName: sponsor?.first_name ?? undefined }
}

// La persona stessa, dalla dashboard
export async function claimLateSponsor(code: string): Promise<LateSponsorResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, code: 'auth' }
  const result = await assign(user.id, code, false)
  if (result.success) revalidatePath('/[locale]/dashboard', 'page')
  return result
}

// Lo Staff, su richiesta del Kumano (anche dopo i 15 giorni)
export async function adminAssignLateSponsor(userId: string, code: string): Promise<LateSponsorResult> {
  if (!(await verifyAdmin('users.write'))) return { success: false, code: 'forbidden' }
  return assign(userId, code, true)
}

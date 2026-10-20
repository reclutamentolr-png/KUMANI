'use server'

import { updateTag } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { romeDate } from '@/lib/christmasShared'
import { PLANS_GATE_CACHE_TAG, parsePlansGate, plansGateState, type PlansGate, type PlansGateSettings } from '@/lib/plansGate'
import { notifyPlanWaitlist } from '@/lib/plansWaitlistNotify'

// Admin → Apertura piani: interruttore «Piani in arrivo», data di apertura e
// la lista di chi ha chiesto «Avvisami»
const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

type Waitlist = { total: number; base: number; pro: number; notified: number }
type Admin = { settings: PlansGateSettings; state: PlansGate; waitlist: Waitlist }

async function read(): Promise<Admin> {
  const service = db()
  const [{ data }, { data: rows }] = await Promise.all([
    service.from('system_settings').select('value').eq('key', 'plans_gate').maybeSingle(),
    service.from('plan_waitlist').select('plan, notified_at').limit(100000),
  ])
  const settings = parsePlansGate(data?.value ?? null)
  const list = rows ?? []
  return {
    settings,
    state: plansGateState(settings, romeDate(new Date())),
    waitlist: {
      total: list.length,
      base: list.filter((r) => r.plan === 'base').length,
      pro: list.filter((r) => r.plan === 'pro').length,
      notified: list.filter((r) => r.notified_at).length,
    },
  }
}

export async function adminGetPlansGate(): Promise<Admin | { error: string }> {
  if (!(await verifyAdmin('settings.read'))) return { error: 'Non autorizzato' }
  return read()
}

export async function adminSavePlansGate(input: PlansGateSettings): Promise<({ success: true } & Admin) | { success: false; error: string }> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const settings = parsePlansGate(input)
  const { error } = await db().from('system_settings').upsert({ key: 'plans_gate', value: JSON.stringify(settings) }, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  updateTag(PLANS_GATE_CACHE_TAG)
  return { success: true, ...(await read()) }
}

// «Avvisa adesso»: solo a piani aperti (altrimenti non parte nulla)
export async function adminNotifyPlanWaitlist(): Promise<({ success: true; notified: number; emails: number } & Admin) | { success: false; error: string }> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const result = await notifyPlanWaitlist()
  return { success: true, ...result, ...(await read()) }
}

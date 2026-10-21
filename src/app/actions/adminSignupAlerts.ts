'use server'

import { verifyAdmin } from '@/lib/verifyAdmin'
import { pushDb } from '@/lib/push'

// Admin → Panoramica: «Avvisami a ogni nuova iscrizione». Ogni admin lo
// accende per sé; gli id stanno in system_settings.signup_alert_admins
// (separati da virgola) e li legge notifyInviterOfSignup.

const KEY = 'signup_alert_admins'

async function readIds(): Promise<string[]> {
  const { data } = await pushDb().from('system_settings').select('value').eq('key', KEY).maybeSingle()
  return String(data?.value ?? '')
    .replace(/"/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function adminGetSignupAlerts(): Promise<{ on: boolean; devices: number } | { error: string }> {
  const admin = await verifyAdmin('users.read')
  if (!admin) return { error: 'Non autorizzato' }
  const [ids, { count }] = await Promise.all([
    readIds(),
    pushDb().from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', admin.id),
  ])
  return { on: ids.includes(admin.id), devices: count ?? 0 }
}

export async function adminSetSignupAlerts(on: boolean): Promise<{ success: boolean; error?: string }> {
  const admin = await verifyAdmin('users.read')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const ids = new Set(await readIds())
  if (on) ids.add(admin.id)
  else ids.delete(admin.id)
  const { error } = await pushDb()
    .from('system_settings')
    .upsert({ key: KEY, value: [...ids].join(','), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  return error ? { success: false, error: error.message } : { success: true }
}

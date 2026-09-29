'use server'

import { createClient } from '@/lib/supabase/server'

export async function getMaintenanceGate() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['maintenance_mode', 'maintenance_message'])

    if (error) {
      console.error('❌ [MAINTENANCE GATE] Errore query:', error)
      return { enabled: false, message: '' }
    }

    let enabled = false
    let message = 'Sito in manutenzione. Torna presto!'

    // Il valore può essere testo JSON oppure già vero/falso
    data?.forEach((s: { key: string; value: string | boolean }) => {
      try {
        const parsed = JSON.parse(String(s.value))
        if (s.key === 'maintenance_mode') {
          enabled = parsed === true
        }
        if (s.key === 'maintenance_message' && parsed) {
          message = parsed
        }
      } catch {
        if (s.key === 'maintenance_mode') {
          enabled = s.value === 'true' || s.value === true
        }
        if (s.key === 'maintenance_message' && s.value) {
          message = String(s.value)
        }
      }
    })

    if (!enabled) {
      return { enabled, message }
    }

    // Bypass per gli admin: la manutenzione blocca tutti tranne loro.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { enabled: true, message }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const { data: adminRecord } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    if (profile?.is_admin || adminRecord) {
      return { enabled: false, message }
    }

    return { enabled, message }
  } catch (error) {
    console.error('❌ [MAINTENANCE GATE] Errore generale:', error)
    return { enabled: false, message: '' }
  }
}

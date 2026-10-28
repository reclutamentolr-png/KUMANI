'use server'

import { createClient } from '@/lib/supabase/server'
import { disconnectGoogleCalendar, syncGoogleCalendar, type GoogleSyncResult } from '@/lib/googleCalendar'

// Link del calendario KUMANI collegato (vedi /api/calendario/[token])
export async function rotateCalendarFeed(locale: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('calendar_feed_token', { p_rotate: true, p_locale: locale })
  return !error
}

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// Google Calendar collegato con l'API: «Aggiorna ora» e «Scollega»
export async function syncGoogleCalendarNow(): Promise<GoogleSyncResult> {
  const userId = await sessionUserId()
  return userId ? syncGoogleCalendar(userId) : 'none'
}

export async function disconnectGoogleCalendarAction(): Promise<boolean> {
  const userId = await sessionUserId()
  if (!userId) return false
  await disconnectGoogleCalendar(userId)
  return true
}

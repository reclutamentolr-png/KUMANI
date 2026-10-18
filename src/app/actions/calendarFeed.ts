'use server'

import { createClient } from '@/lib/supabase/server'

// Link del calendario KUMANI collegato (vedi /api/calendario/[token])
export async function rotateCalendarFeed(locale: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('calendar_feed_token', { p_rotate: true, p_locale: locale })
  return !error
}

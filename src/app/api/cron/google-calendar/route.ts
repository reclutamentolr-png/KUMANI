import { NextResponse } from 'next/server'
import { pushDb } from '@/lib/push'
import { googleCalendarConfigured, syncGoogleCalendar } from '@/lib/googleCalendar'

// Google Calendar collegato (Vercel Cron, vedi vercel.json): una volta al giorno
// riallinea tutti i calendari KUMANI. Appuntamenti e attività vanno su Google
// subito; questo giro porta anche bollette, scadenze, eventi e viaggi cambiati
// da altri servizi, e i giorni che entrano nella finestra dei prossimi sei mesi.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!googleCalendarConfigured()) return NextResponse.json({ skipped: 'not configured' })

  const started = Date.now()
  const { data } = await pushDb().from('google_calendar_links').select('user_id').order('last_sync_at', { ascending: true, nullsFirst: true }).limit(1000)
  const counts: Record<string, number> = {}
  for (const { user_id } of (data ?? []) as { user_id: string }[]) {
    // Margine sul tempo massimo: chi resta fuori passa per primo domani
    if (Date.now() - started > 240_000) break
    const result = await syncGoogleCalendar(user_id)
    counts[result] = (counts[result] ?? 0) + 1
  }
  return NextResponse.json({ ok: true, ...counts })
}

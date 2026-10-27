import { NextResponse } from 'next/server'
import { pushDb } from '@/lib/push'
import { dailyReminders, timedReminders, usersDueNow } from '@/lib/deadlineReminders'

// Avvisi di scadenze e agenda, ogni 5 minuti (Vercel Cron, vedi vercel.json):
// gli appuntamenti e i promemoria con l'ora all'ora giusta, le scadenze e i
// promemoria senza ora all'ora degli avvisi scelta nel profilo.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const db = pushDb()
  const now = Date.now()
  const timed = await timedReminders(db, now)
  const users = await usersDueNow(db, now)
  const daily = users.length ? await dailyReminders(db, users, now) : null
  return NextResponse.json({ ...timed, users: users.length, daily })
}

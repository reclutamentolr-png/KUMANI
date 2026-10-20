import { NextResponse } from 'next/server'
import { notifyPlanWaitlist } from '@/lib/plansWaitlistNotify'

// Ogni mattina (Vercel Cron, vedi vercel.json): se i piani sono aperti, avvisa
// chi aveva chiesto «Avvisami» e non è ancora stato avvisato (lib/plansWaitlistNotify)
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await notifyPlanWaitlist())
}

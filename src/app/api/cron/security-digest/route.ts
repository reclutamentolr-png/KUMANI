import { NextResponse } from 'next/server'
import { notifyAdminsDigest } from '@/lib/security'

// Riepilogo giornaliero per gli admin (Vercel Cron, vedi vercel.json): una
// notifica push con il numero di avvisi di sicurezza aperti e non ancora
// segnalati (quelli del controllo orario e quelli leggeri, che non mandano
// una notifica subito). Admin → Sicurezza per i dettagli.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const notified = await notifyAdminsDigest()
  return NextResponse.json({ ok: true, notified })
}

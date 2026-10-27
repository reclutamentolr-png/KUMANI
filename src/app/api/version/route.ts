import { NextResponse } from 'next/server'

// Versione del sito appena pubblicata. L'app installata sulla schermata Home
// la confronta con quella che ha in memoria (UpdateWatcher) per accorgersi
// degli aggiornamenti senza doverla chiudere.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ v: siteVersion() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

function siteVersion() {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'dev'
}

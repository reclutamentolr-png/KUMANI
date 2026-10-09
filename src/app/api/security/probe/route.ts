import { after, NextRequest, NextResponse } from 'next/server'
import { clientIp, recordSecurityEvent } from '@/lib/securityCore'

// File che cercano solo gli hacker (.php, .env, .git…), riscritti qui da
// next.config: si registra il tentativo (Admin → Sicurezza) e si risponde
// «non trovato», come per qualsiasi file inesistente.
export const dynamic = 'force-dynamic'

function handle(request: NextRequest) {
  // Dopo la riscrittura l'indirizzo della richiesta resta quello originale
  const original = request.nextUrl.pathname
  const path = original.startsWith('/api/security/probe') ? '/' + (request.nextUrl.searchParams.get('p') ?? '').replace(/^\/+/, '') : original
  after(() =>
    recordSecurityEvent({ kind: 'probe', severity: 'low', ip: clientIp(request.headers), path, userAgent: request.headers.get('user-agent') })
  )
  return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

export const GET = handle
export const POST = handle
export const HEAD = handle

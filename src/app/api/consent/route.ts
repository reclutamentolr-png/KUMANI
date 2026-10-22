import { NextRequest, NextResponse } from 'next/server'
import { CONSENT_COOKIE, CONSENT_MAX_AGE, CONSENT_VERSION, parseConsent } from '@/lib/consent'

// Banner dei cookie: la scelta viene riscritta dal server. Safari (iPhone,
// iPad e Mac) tiene al massimo 7 giorni i cookie scritti dalla pagina, e il
// banner ricompariva; un cookie inviato dal server vale invece i 6 mesi
// previsti. Si salva solo la scelta, controllata, nient'altro.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { value?: unknown } | null
  const state = typeof body?.value === 'string' ? parseConsent(body.value) : null
  if (!state || state.v !== CONSENT_VERSION) return NextResponse.json({ ok: false }, { status: 400 })

  const choices = Object.fromEntries(Object.entries(state.choices).filter(([, v]) => typeof v === 'boolean'))
  const clean = { v: state.v, at: new Date().toISOString(), choices }
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  // Leggibile dalla pagina (httpOnly spento): il banner lo legge nel browser
  // Next codifica già il valore come fa encodeURIComponent
  response.cookies.set(CONSENT_COOKIE, JSON.stringify(clean), {
    path: '/',
    maxAge: CONSENT_MAX_AGE,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    httpOnly: false,
  })
  return response
}

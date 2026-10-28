import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { googleAuthUrl, googleCalendarAllowed } from '@/lib/googleCalendar'
import { SITE_URL } from '@/lib/siteUrl'

// «Collega Google Calendar»: porta alla pagina di Google che chiede il permesso.
// Lo «state» in un cookie protegge il ritorno su /api/google-calendar/callback.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${SITE_URL}/login?next=${encodeURIComponent('/calendario-collegato')}`)
  if (!(await googleCalendarAllowed(user.id))) return NextResponse.redirect(`${SITE_URL}/calendario-collegato`)

  const state = randomBytes(24).toString('hex')
  ;(await cookies()).set('gcal_state', state, { httpOnly: true, secure: SITE_URL.startsWith('https'), sameSite: 'lax', path: '/api/google-calendar', maxAge: 600 })
  return NextResponse.redirect(googleAuthUrl(state))
}

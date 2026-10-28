import { cookies } from 'next/headers'
import { after, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { connectGoogleCalendar, googleCalendarAllowed, syncGoogleCalendar } from '@/lib/googleCalendar'
import { SITE_URL } from '@/lib/siteUrl'
import { locales, defaultLocale } from '../../../../../i18n'

// Ritorno da Google dopo «Collega Google Calendar»: salva il permesso, riempie
// subito il calendario KUMANI e torna alla pagina con l'esito (?google=…).
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const jar = await cookies()
  const expected = jar.get('gcal_state')?.value
  jar.delete({ name: 'gcal_state', path: '/api/google-calendar' })
  const cookieLocale = jar.get('NEXT_LOCALE')?.value
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale
  const back = (outcome: string) => NextResponse.redirect(`${SITE_URL}${locale === defaultLocale ? '' : `/${locale}`}/calendario-collegato?google=${outcome}`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${SITE_URL}/login?next=${encodeURIComponent('/calendario-collegato')}`)
  if (params.get('error')) return back('denied')
  const code = params.get('code')
  if (!code || !expected || params.get('state') !== expected || !(await googleCalendarAllowed(user.id))) return back('failed')

  try {
    const outcome = await connectGoogleCalendar(user.id, code, locale)
    if (outcome === 'scope') return back('scope')
  } catch (error) {
    console.error('[google-calendar] connect', user.id, error)
    return back('failed')
  }
  after(() => syncGoogleCalendar(user.id))
  return back('ok')
}

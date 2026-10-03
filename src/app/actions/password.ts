'use server'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { escapeHtml, sendEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/siteUrl'
import { CONTACT_INFO } from '@/lib/contactInfo'
import { locales, defaultLocale } from '../../../i18n'

// Cambio password dal profilo (con la password attuale) e link per
// reimpostarla inviato dallo Staff. Lo Staff non vede né sceglie mai la
// password: la sceglie sempre il Kumano.

const MIN_LENGTH = 6
const MAX_LENGTH = 72

const anonClient = () =>
  createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const serviceClient = () =>
  createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export type ChangePasswordResult = {
  success: boolean
  code?: 'auth' | 'too_short' | 'too_long' | 'same' | 'wrong_current' | 'rate_limit' | 'error'
}

// Avviso via email: se non è stato il Kumano a cambiarla, se ne accorge subito
async function sendPasswordChangedEmail(to: string, firstName: string | null, locale: string) {
  const t = await getTranslations({ locale, namespace: 'passwordEmail' })
  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date())
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const resetUrl = `${SITE_URL}${prefix}/forgot-password`
  const lines = [
    t('greeting', { name: firstName || 'Kumano' }),
    t('body', { date: when }),
    t('notYou', { email: CONTACT_INFO.supportEmail ?? 'support@kumani.io' }),
  ]
  const text = [...lines, resetUrl, '', t('signature')].join('\n\n')
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#111;color:#e8c872;font-weight:bold;font-size:20px;padding:16px 20px;border-radius:12px 12px 0 0">KUMANI</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;line-height:1.5;font-size:15px">
${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
<p><a href="${escapeHtml(resetUrl)}" style="color:#8a6d1f">${escapeHtml(resetUrl)}</a></p>
<p>${escapeHtml(t('signature'))}</p>
</div></div></body></html>`
  await sendEmail({ to, subject: t('subject'), html, text })
}

export async function changeMyPassword(current: string, next: string, locale: string): Promise<ChangePasswordResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { success: false, code: 'auth' }
  if (typeof current !== 'string' || typeof next !== 'string') return { success: false, code: 'error' }
  if (next.length < MIN_LENGTH) return { success: false, code: 'too_short' }
  if (next.length > MAX_LENGTH) return { success: false, code: 'too_long' }
  if (next === current) return { success: false, code: 'same' }

  // Controllo della password attuale con un accesso separato, poi chiuso
  const check = anonClient()
  const { error: signInError } = await check.auth.signInWithPassword({ email: user.email, password: current })
  if (signInError) {
    const rateLimited = signInError.status === 429 || /rate limit/i.test(signInError.message)
    return { success: false, code: rateLimited ? 'rate_limit' : 'wrong_current' }
  }
  await check.auth.signOut({ scope: 'local' }).catch(() => {})

  const { error } = await serviceClient().auth.admin.updateUserById(user.id, { password: next })
  if (error) {
    console.error('[cambio password]', error.message)
    return { success: false, code: 'error' }
  }

  // Fuori tutti gli altri dispositivi (anche un eventuale intruso), resta
  // collegato solo quello da cui si è cambiata la password
  await supabase.auth.signOut({ scope: 'others' }).catch(() => {})

  const { data: profile } = await serviceClient().from('profiles').select('first_name').eq('id', user.id).maybeSingle()
  const lang = locales.includes(locale) ? locale : defaultLocale
  await sendPasswordChangedEmail(user.email, profile?.first_name ?? null, lang).catch((err) =>
    console.error('[cambio password] avviso non inviato:', err)
  )
  return { success: true }
}

// Lo Staff invia al Kumano il link per scegliere una nuova password
export async function adminSendPasswordReset(userId: string, locale: string): Promise<{ success: boolean; error?: string; email?: string }> {
  if (!(await verifyAdmin('users.write'))) return { success: false, error: 'Non autorizzato.' }
  const { data, error } = await serviceClient().auth.admin.getUserById(userId)
  const email = data?.user?.email
  if (error || !email) return { success: false, error: 'Utente o email non trovati.' }
  const lang = locales.includes(locale) ? locale : defaultLocale
  const { error: resetError } = await anonClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/${lang}/reset-password`,
  })
  if (resetError) {
    console.error('[link password dallo Staff]', resetError.message)
    const rateLimited = resetError.status === 429 || /rate limit/i.test(resetError.message)
    return { success: false, error: rateLimited ? 'Troppi invii ravvicinati: riprova tra qualche minuto.' : 'Invio non riuscito.' }
  }
  return { success: true, email }
}

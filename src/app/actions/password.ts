'use server'

import { createHmac, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { clientIp, logSecurityEvent } from '@/lib/security'
import { escapeHtml, sendEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/siteUrl'
import { CONTACT_INFO } from '@/lib/contactInfo'
import { locales, defaultLocale } from '../../../i18n'

// Cambio password dal profilo (con la password attuale) e link per
// reimpostarla inviato dallo Staff. Lo Staff non vede né sceglie mai la
// password: la sceglie sempre il Kumano.

const MIN_LENGTH = 8
const MAX_LENGTH = 72

const anonClient = () =>
  createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const serviceClient = () =>
  createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Errore di Supabase Auth da tradurre nella pagina (src/lib/authErrors.ts):
// password debole, rubata, uguale alla precedente…
export type AuthErrorInfo = { code?: string; message?: string; name?: string; reasons?: string[] }

const authErrorInfo = (error: unknown): AuthErrorInfo => {
  const { code, message, name, reasons } = error as AuthErrorInfo
  return { code, message, name, reasons }
}

export type ChangePasswordResult = {
  success: boolean
  code?: 'auth' | 'too_short' | 'too_long' | 'same' | 'wrong_current' | 'rate_limit' | 'captcha' | 'auth_error' | 'error'
  error?: AuthErrorInfo
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

// captchaToken: token di Cloudflare Turnstile dal widget del profilo, girato a
// Supabase per l'accesso di controllo (con la protezione CAPTCHA attiva senza
// token l'accesso verrebbe rifiutato). Senza chiave Turnstile resta undefined.
export async function changeMyPassword(
  current: string,
  next: string,
  locale: string,
  captchaToken?: string
): Promise<ChangePasswordResult> {
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
  const { error: signInError } = await check.auth.signInWithPassword({
    email: user.email,
    password: current,
    options: { captchaToken: typeof captchaToken === 'string' && captchaToken ? captchaToken : undefined },
  })
  if (signInError) {
    const rateLimited = signInError.status === 429 || /rate limit/i.test(signInError.message)
    if (rateLimited) return { success: false, code: 'rate_limit' }
    if (signInError.code === 'captcha_failed' || /captcha/i.test(signInError.message)) return { success: false, code: 'captcha' }
    // Solo «credenziali errate» è una password attuale sbagliata: un problema
    // temporaneo di Supabase non va detto all'utente né registrato come sospetto
    const wrong = signInError.code === 'invalid_credentials' || /invalid login credentials/i.test(signInError.message)
    if (!wrong) {
      console.error('[cambio password] controllo non riuscito:', signInError.code ?? signInError.message)
      return { success: false, code: 'error' }
    }
    // Password attuale sbagliata più volte: account forse in mano ad altri
    const h = await headers()
    await logSecurityEvent({ kind: 'password_check_failed', userId: user.id, ip: clientIp(h), userAgent: h.get('user-agent') })
    return { success: false, code: 'wrong_current' }
  }
  await check.auth.signOut({ scope: 'local' }).catch(() => {})

  // Supabase può rifiutare la nuova password (troppo debole, tra quelle rubate
  // su internet…): il motivo va mostrato, non un «riprova tra poco»
  const { error } = await serviceClient().auth.admin.updateUserById(user.id, { password: next })
  if (error) {
    console.error('[cambio password]', error.code ?? error.message)
    return { success: false, code: 'auth_error', error: authErrorInfo(error) }
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

// Nuova password dopo il codice o il link di recupero (Password dimenticata,
// link dello Staff). Vale solo per una sessione appena aperta con il recupero:
// chi trova un account già aperto (o lo Staff che entra «come utente») non può
// cambiare la password senza conoscere quella attuale (per quello c'è il
// profilo, con changeMyPassword). Poi fuori gli altri dispositivi e avviso.
//
// Due prove di recupero valgono:
// - il link dell'email «Password dimenticata» (?code=…): Supabase scrive
//   «recovery» nella sessione;
// - il codice a 6 cifre o il link dello Staff (?token_hash=…), verificati qui
//   sul server con verifyRecoveryCode. Supabase li registra come «otp», come
//   ogni altro codice (anche l'accesso dello Staff come utente): il server
//   lascia quindi un contrassegno firmato, non leggibile dal browser, valido
//   15 minuti e solo per quell'utente.
const RECOVERY_METHODS = ['recovery']
const RECOVERY_WINDOW_S = 60 * 60
const RECOVERY_COOKIE = 'kumani_recovery'
const RECOVERY_COOKIE_S = 15 * 60

const recoverySignature = (userId: string, expires: number) =>
  createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(`password-recovery:${userId}:${expires}`).digest('base64url')

async function hasRecoveryMark(userId: string) {
  const value = (await cookies()).get(RECOVERY_COOKIE)?.value
  const [id, exp, signature] = value?.split('.') ?? []
  const expires = Number(exp)
  if (id !== userId || !signature || !Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false
  const expected = Buffer.from(recoverySignature(userId, expires))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

async function recoverySession() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims as { sub?: string; email?: string; amr?: { method?: string; timestamp?: number }[] } | undefined
  if (!claims?.sub) return null
  const now = Math.floor(Date.now() / 1000)
  const recent = (claims.amr ?? []).some((entry) => RECOVERY_METHODS.includes(entry.method ?? '') && now - (entry.timestamp ?? 0) < RECOVERY_WINDOW_S)
  return recent || (await hasRecoveryMark(claims.sub)) ? { supabase, userId: claims.sub, email: claims.email ?? null } : null
}

export type VerifyRecoveryResult = { success: true } | { success: false; code: 'invalid_code' | 'rate_limit' }

// Verifica del codice di recupero (email + 6 cifre) o del link dello Staff
// (token_hash): apre la sessione e lascia il contrassegno del recupero
export async function verifyRecoveryCode(input: { email: string; token: string } | { tokenHash: string }): Promise<VerifyRecoveryResult> {
  const supabase = await createClient()
  const { data, error } =
    'tokenHash' in input
      ? await supabase.auth.verifyOtp({ token_hash: String(input.tokenHash), type: 'recovery' })
      : await supabase.auth.verifyOtp({ email: String(input.email).trim(), token: String(input.token).trim(), type: 'recovery' })
  if (error || !data.user) {
    const rateLimited = error?.status === 429 || /rate limit/i.test(error?.message ?? '')
    return { success: false, code: rateLimited ? 'rate_limit' : 'invalid_code' }
  }
  const expires = Math.floor(Date.now() / 1000) + RECOVERY_COOKIE_S
  const cookieStore = await cookies()
  cookieStore.set(RECOVERY_COOKIE, `${data.user.id}.${expires}.${recoverySignature(data.user.id, expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: RECOVERY_COOKIE_S,
  })
  return { success: true }
}

export async function canResetPassword(): Promise<boolean> {
  return !!(await recoverySession())
}

export type ResetPasswordResult =
  | { success: true }
  | { success: false; code: 'not_recovery' | 'too_short' | 'too_long' | 'auth_error'; error?: AuthErrorInfo }

export async function resetPasswordAfterRecovery(next: string, locale: string): Promise<ResetPasswordResult> {
  if (typeof next !== 'string' || next.length < 8) return { success: false, code: 'too_short' }
  if (next.length > MAX_LENGTH) return { success: false, code: 'too_long' }
  const session = await recoverySession()
  if (!session) return { success: false, code: 'not_recovery' }

  const { error } = await session.supabase.auth.updateUser({ password: next })
  if (error) return { success: false, code: 'auth_error', error: authErrorInfo(error) }
  // Il recupero vale per un solo cambio
  const cookieStore = await cookies()
  cookieStore.delete(RECOVERY_COOKIE)
  await session.supabase.auth.signOut({ scope: 'others' }).catch(() => {})
  if (session.email) {
    const { data: profile } = await serviceClient().from('profiles').select('first_name').eq('id', session.userId).maybeSingle()
    const lang = locales.includes(locale) ? locale : defaultLocale
    await sendPasswordChangedEmail(session.email, profile?.first_name ?? null, lang).catch((err) =>
      console.error('[nuova password] avviso non inviato:', err)
    )
  }
  return { success: true }
}

// Email dello Staff con il codice (e il link) per scegliere una nuova password.
// Il link porta a /reset-password?token_hash=…&type=recovery: la pagina lo
// verifica con verifyOtp e apre il modulo della nuova password.
async function sendPasswordResetEmail(to: string, firstName: string | null, locale: string, code: string, link: string) {
  const t = await getTranslations({ locale, namespace: 'passwordResetEmail' })
  const intro = [t('greeting', { name: firstName || 'Kumano' }), t('body')]
  const codeLine = t('codeIntro')
  const linkLine = t('linkIntro')
  const outro = [t('expiry'), t('notYou')]
  const text = [...intro, codeLine, code, linkLine, link, ...outro, t('signature')].join('\n\n')
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#111;color:#e8c872;font-weight:bold;font-size:20px;padding:16px 20px;border-radius:12px 12px 0 0">KUMANI</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;line-height:1.5;font-size:15px">
${intro.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
<p>${escapeHtml(codeLine)}</p>
<p style="font-family:'Courier New',monospace;font-size:28px;font-weight:bold;letter-spacing:6px;text-align:center;background:#f5f3ee;border-radius:10px;padding:12px">${escapeHtml(code)}</p>
<p>${escapeHtml(linkLine)}</p>
<p style="text-align:center"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#e8c872;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">${escapeHtml(t('button'))}</a></p>
${outro.map((line) => `<p style="font-size:13px;color:#555">${escapeHtml(line)}</p>`).join('\n')}
<p>${escapeHtml(t('signature'))}</p>
</div></div></body></html>`
  return sendEmail({ to, subject: t('subject'), html, text })
}

// Lo Staff invia al Kumano il codice (e il link) per scegliere una nuova
// password. Niente resetPasswordForEmail: con la protezione CAPTCHA di
// Supabase attiva servirebbe un token anti-robot che dal server non c'è. Il
// codice si genera con l'API admin (chiave service role, senza CAPTCHA e senza
// email da Supabase) e l'email parte da KUMANI con Resend.
export async function adminSendPasswordReset(userId: string, locale: string): Promise<{ success: boolean; error?: string; email?: string }> {
  if (!(await verifyAdmin('users.write'))) return { success: false, error: 'Non autorizzato.' }
  const service = serviceClient()
  const { data, error } = await service.auth.admin.getUserById(userId)
  const email = data?.user?.email
  if (error || !email) return { success: false, error: 'Utente o email non trovati.' }
  // Lingua dell'email: quella scelta all'iscrizione, altrimenti quella indicata
  const metaLocale = (data.user.user_metadata as { locale?: unknown } | undefined)?.locale
  const lang =
    typeof metaLocale === 'string' && locales.includes(metaLocale)
      ? metaLocale
      : locales.includes(locale)
        ? locale
        : defaultLocale
  const redirectTo = `${SITE_URL}/${lang}/reset-password`
  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })
  const code = link?.properties?.email_otp
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !code || !tokenHash) {
    console.error('[link password dallo Staff]', linkError?.message ?? 'codice mancante')
    const rateLimited = linkError?.status === 429 || /rate limit/i.test(linkError?.message ?? '')
    return { success: false, error: rateLimited ? 'Troppi invii ravvicinati: riprova tra qualche minuto.' : 'Invio non riuscito.' }
  }
  const resetUrl = `${redirectTo}?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
  const { data: profile } = await service.from('profiles').select('first_name').eq('id', userId).maybeSingle()
  const sent = await sendPasswordResetEmail(email, profile?.first_name ?? null, lang, code, resetUrl)
  if (!sent.sent) {
    return {
      success: false,
      error: sent.error === 'not_configured' ? 'Invio email non configurato (RESEND_API_KEY / EMAIL_FROM).' : 'Invio non riuscito.',
    }
  }
  return { success: true, email }
}

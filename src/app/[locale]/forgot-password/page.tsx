'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from '@/components/LocalizedLink'
import { Mail, Lock, AlertCircle, Loader2, Home, CheckCircle, ShieldCheck } from 'lucide-react'
import MaintenanceGate from '@/components/MaintenanceGate'
import Logo from '@/components/Logo'

const RESEND_COOLDOWN_SECONDS = 30

type Step = 'request' | 'verify' | 'done'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('request')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const t = useTranslations('auth')
  const locale = useLocale()
  const router = useRouter()
  const supabase = createClient()
  // Il codice si usa una volta sola: se è già stato verificato e il
  // salvataggio della password fallisce, al nuovo tentativo non va riverificato
  const [codeVerified, setCodeVerified] = useState(false)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)

    // finché il template email di Supabase non mostra {{ .Token }} (richiede
    // piano Pro o SMTP custom — vedi nota in reset-password/page.tsx), il
    // link nell'email resta l'unico modo reale con cui l'utente può arrivare
    // a reimpostare la password: lo teniamo attivo come fallback.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/${locale}/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setStep('verify')
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    setLoading(false)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'))
      return
    }
    if (password.length < 6) {
      setError(t('passwordTooShort'))
      return
    }

    setLoading(true)
    setError(null)

    if (!codeVerified) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'recovery',
      })
      if (verifyError) {
        setError(t('invalidVerificationCode'))
        setLoading(false)
        return
      }
      setCodeVerified(true)
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      // Errori più comuni spiegati nella lingua dell'utente
      const errorCode = (updateError as { code?: string }).code
      setError(
        errorCode === 'same_password'
          ? t('samePasswordError')
          : errorCode === 'weak_password'
            ? t('weakPasswordError')
            : updateError.message
      )
      setLoading(false)
      return
    }

    setStep('done')
    setLoading(false)
    setTimeout(() => router.push(`/${locale}/login`), 2000)
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError(null)
    setResendMessage(null)
    const { error: resendError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/${locale}/reset-password`,
    })
    if (resendError) {
      setError(resendError.message)
      return
    }
    setCodeVerified(false)
    setResendMessage(t('codeResent'))
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
  }

  return (
    <MaintenanceGate>
      <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[var(--background)] py-12 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(199,154,59,0.18),transparent_42%)]" />
        <Link
          href="/"
          className="absolute left-6 top-6 flex items-center gap-2 font-semibold text-[var(--ink-soft)] transition-colors hover:text-[var(--gold)]"
        >
          <Logo size={32} priority />
          <Home className="w-4 h-4 sm:hidden" />
        </Link>

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--ink)]">
            {step === 'verify' ? t('enterResetCode') : t('forgotPasswordTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 'verify' ? t('resetCodeDescription', { email }) : t('forgotPasswordDescription')}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="relative border border-[var(--gold)]/35 bg-[var(--paper)] px-4 py-8 shadow-[0_20px_55px_rgba(23,23,23,0.14)] sm:rounded-2xl sm:px-10">
            {error && (
              <div className="mb-4 border-l-4 bg-red-50 border-red-400 p-4 rounded-r">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-red-700">{error}</p>
                </div>
              </div>
            )}

            {step === 'done' ? (
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-green-700 mb-4">{t('passwordUpdated')}</p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-[var(--ink-soft)]"
                >
                  {t('backToLogin')}
                </Link>
              </div>
            ) : step === 'verify' ? (
              <>
                {resendMessage && <p className="mb-4 text-center text-sm text-green-700">{resendMessage}</p>}
                <form className="space-y-6" onSubmit={handleResetPassword}>
                  <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-700">{t('verificationCode')}</label>
                    <div className="relative mt-1">
                      <ShieldCheck className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                      <input
                        id="code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="w-full rounded-md border border-stone-300 bg-white pl-10 pr-4 py-2.5 shadow-sm font-mono tracking-[0.3em] text-center focus:border-[var(--gold)] focus:ring-[var(--gold)]"
                        placeholder="123456"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">{t('newPassword')}</label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                      <input
                        id="password"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-md border border-stone-300 bg-white pl-10 pr-4 py-2.5 shadow-sm focus:border-[var(--gold)] focus:ring-[var(--gold)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">{t('confirmPassword')}</label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                      <input
                        id="confirmPassword"
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-md border border-stone-300 bg-white pl-10 pr-4 py-2.5 shadow-sm focus:border-[var(--gold)] focus:ring-[var(--gold)]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--ink-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)] focus:ring-offset-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    {loading ? t('updating') : t('updatePassword')}
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep('request'); setError(null); setResendMessage(null) }}
                    className="font-medium text-gray-500 hover:text-[var(--gold)]"
                  >
                    {t('backToForm')}
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="font-medium text-[var(--gold)] hover:text-[var(--ink)] disabled:text-gray-400"
                  >
                    {resendCooldown > 0 ? t('resendCodeIn', { seconds: resendCooldown }) : t('resendCode')}
                  </button>
                </div>
              </>
            ) : (
              <form className="space-y-6" onSubmit={handleRequestCode}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">{t('email')}</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-md border border-stone-300 bg-white pl-10 pr-4 py-2.5 shadow-sm focus:border-[var(--gold)] focus:ring-[var(--gold)]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-transparent bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--ink-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)] focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {loading ? t('sending') : t('resetPassword')}
                </button>
              </form>
            )}

            {step === 'request' && (
              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm font-medium text-[var(--gold)] hover:text-[var(--ink)] hover:underline">
                  {t('backToLogin')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </MaintenanceGate>
  )
}

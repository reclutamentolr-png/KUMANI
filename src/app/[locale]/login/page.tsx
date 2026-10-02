'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { awardDailyPoint } from '@/app/actions/award-daily-point'
import { endImpersonation } from '@/lib/impersonation'
import { resetProfileReminder } from '@/components/ProfileReminder'
import MaintenanceGate from '@/components/MaintenanceGate'
import Logo from '@/components/Logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const t = useTranslations('auth')
  const tg = useTranslations('guides')
  
  const router = useRouter()
  const locale = useLocale()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      if (authError.code === 'email_not_confirmed') {
        router.push(`/${locale}/register?verify=${encodeURIComponent(email)}`)
        return
      }
      setError(t('invalidCredentials'))
      setLoading(false)
      return
    }

    // Traduttore o Agente venditore: vanno nella loro area
    const role = (authData.user?.app_metadata as { role?: string } | undefined)?.role
    if (role === 'translator' || role === 'agent') {
      endImpersonation()
      router.push(`/${locale}/${role === 'translator' ? 'traduzioni' : 'agente'}`)
      router.refresh()
      return
    }

    if (authData.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_blocked')
        .eq('id', authData.user.id)
        .single()

      if (profileError) {
        console.error('Errore nel controllo profilo:', profileError)
      }

      // Accesso creato ma registrazione mai completata (nessun profilo): si
      // prova a completarla subito con i dati salvati da RegisterForm nei
      // metadata dell'utente. Se non riesce (es. invito non più valido) si
      // completa da "Registrati" con la stessa email e password.
      if (!profile && profileError?.code === 'PGRST116') {
        const meta = (authData.user.user_metadata ?? {}) as {
          first_name?: string
          last_name?: string
          country_code?: string
          city?: string
          referral_code?: string
          voucher_code?: string
          professional?: boolean
          agent_code?: string
        }
        const { data: status, error: registrationError } = meta.first_name && meta.last_name && meta.country_code
          ? await supabase.rpc('complete_registration', {
              p_first_name: meta.first_name,
              p_last_name: meta.last_name,
              p_country: meta.country_code,
              p_city: meta.city ?? '',
              p_referral_code: meta.referral_code ?? '',
              p_agent_code: meta.agent_code ?? '',
            })
          : { data: null, error: null }

        if (registrationError || status !== 'ok') {
          await supabase.auth.signOut()
          setError(t('registrationIncomplete'))
          setLoading(false)
          return
        }

        // Come in RegisterForm: coupon e prova Pro, senza bloccare l'accesso
        // se non vanno a buon fine (si riprovano dalla dashboard).
        const voucherCode = (meta.voucher_code ?? '').trim().toUpperCase()
        if (voucherCode) await supabase.rpc('redeem_subscription_voucher', { p_code: voucherCode })
        if (meta.professional) await supabase.rpc('start_pro_trial')
      }

      if (profile?.is_blocked) {
        await supabase.auth.signOut()
        setError(t('blockedAccount'))
        setLoading(false)
        return
      }

      await awardDailyPoint()
      // Nuovo accesso: il promemoria "completa il profilo" riparte da zero.
      resetProfileReminder()
      // Accesso normale: nessuna impersonificazione in corso in questa scheda
      endImpersonation()
    }

    // ?next=/viaggi/invito/CODICE: dopo l'accesso si torna alla pagina di
    // partenza (solo percorsi interni, mai altri siti).
    const next = new URLSearchParams(window.location.search).get('next') ?? ''
    const safeNext = /^\/(?!\/)[A-Za-z0-9/_\-.?=&%]*$/.test(next) ? next : null
    router.push(safeNext ? `/${locale}${safeNext}` : `/${locale}/dashboard`)
    router.refresh()
  }

  return (
    <MaintenanceGate>
      <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[var(--background)] py-12 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(199,154,59,0.18),transparent_42%)]" />
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center mb-4">
            <Link href="/" className="transition-opacity hover:opacity-80">
              <Logo size={128} priority />
            </Link>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--ink)]">
            {t('loginTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('loginDescription')}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="relative border border-[var(--gold)]/35 bg-[var(--paper)] px-4 py-8 shadow-[0_20px_55px_rgba(23,23,23,0.14)] sm:rounded-2xl sm:px-10">
            {error && (
              <div className={`mb-4 border-l-4 p-4 rounded-r ${
                error.includes('bloccato') ? 'bg-amber-50 border-amber-400' : 'bg-red-50 border-red-400'
              }`}>
                <p className={`text-sm font-medium ${error.includes('bloccato') ? 'text-amber-700' : 'text-red-700'}`}>
                  {error}
                </p>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleLogin}>
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

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">{t('password')}</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                {loading ? t('loggingIn') : t('login')}
              </button>
            </form>

             <div className="mt-6 text-center space-y-2">
              <Link href="/forgot-password" className="text-sm font-medium text-[var(--gold)] hover:text-[var(--ink)] hover:underline">
                {t('forgotPassword')}
              </Link>
              <Link href="/register" className="block text-sm font-medium text-[var(--gold)] hover:text-[var(--ink)] hover:underline">
                {t('noAccount')}
              </Link>
              <Link href="/guida/accesso" className="block text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:underline">
                {tg('authHelp')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MaintenanceGate>
  )
}
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

type InviterData = { referral_code: string; country_code: string; first_name: string; last_name: string }

const FLAGS: Record<string, string> = { IT: '🇮🇹', US: '🇺🇸', DE: '🇩🇪', FR: '🇫🇷', ES: '🇪🇸', PT: '🇵🇹', BR: '🇧🇷', RU: '🇷🇺', GB: '🇬🇧' }

// Pagina di invito personale (/ref/CODICE): chi arriva qui viene invitato
// da un Kumano e si registra con il suo codice già compilato.
export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const normalizedCode = code.toUpperCase()
  const t = await getTranslations('referralLanding')

  const supabase = await createClient()
  // Funzione pubblica: restituisce solo nome, paese e codice di chi invita.
  const { data: inviter, error } = (await supabase
    .rpc('get_public_profile_by_referral', { p_referral_code: normalizedCode })
    .single()) as { data: InviterData | null; error: unknown }

  if (error || !inviter) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-gray-100 max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('invalidTitle')}</h1>
          <p className="text-gray-600 mb-6">{t('invalidText', { code })}</p>
          <Link
            href="/register"
            className="inline-block bg-indigo-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t('registerWithoutInvite')}
          </Link>
        </div>
      </div>
    )
  }

  const registerUrl = `/register?sponsor=${encodeURIComponent(inviter.referral_code)}`
  const inviterName = inviter.first_name.trim()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-indigo-100">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">{FLAGS[inviter.country_code] ?? '🌍'}</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('title', { name: inviterName })}</h1>
        <p className="text-gray-600 mb-8">{t('description')}</p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8">
          <p className="text-sm text-gray-500 mb-1">{t('invitedBy')}</p>
          <p className="text-2xl font-mono font-bold text-indigo-600 tracking-wider">{inviter.referral_code}</p>
        </div>

        <Link
          href={registerUrl}
          className="w-full block bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        >
          {t('registerNow')}
        </Link>

        <p className="text-xs text-gray-400 mt-6">
          {t('alreadyRegistered')}{' '}
          <Link href="/dashboard" className="text-indigo-600 hover:underline font-medium">
            {t('goToDashboard')}
          </Link>
        </p>
      </div>
    </div>
  )
}

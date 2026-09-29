'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { endImpersonation } from '@/lib/impersonation'

// Rientro dai link di accesso dell'impersonificazione (entrata nell'account
// di un utente, o ?restore=1 per tornare admin). Le chiavi di accesso
// arrivano nell'hash dell'indirizzo (#access_token=...): si tolgono subito,
// così non restano nella cronologia né sullo schermo.
function ImpersonateCallbackContent() {
  const searchParams = useSearchParams()
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const isRestore = searchParams.get('restore') === '1'

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      window.history.replaceState(null, '', window.location.pathname + window.location.search)

      if (accessToken && refreshToken) {
        const { error: sessionError } = await createClient().auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) {
          setError(sessionError.message)
          return
        }
      }

      // Di nuovo admin: l'impersonificazione è finita, nessun dato resta
      if (isRestore) endImpersonation()

      window.location.replace(isRestore ? `/${locale}/admin` : `/${locale}/dashboard`)
    }

    run()
  }, [searchParams, locale])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <div className="text-red-600 text-xl font-bold mb-2">❌ Errore di accesso</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Accesso in corso...</p>
      </div>
    </div>
  )
}

export default function ImpersonateCallbackPage() {
  return (
    <Suspense fallback={null}>
      <ImpersonateCallbackContent />
    </Suspense>
  )
}

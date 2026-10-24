'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { checkImpersonationNonce, clearImpersonationNonce, endImpersonation } from '@/lib/impersonation'

// Rientro dai link di accesso dell'impersonificazione (entrata nell'account
// di un utente, o ?restore=1 per tornare admin). Il link porta il codice
// monouso (?th=) e il sigillo della scheda (?n=): l'accesso si fa solo se il
// sigillo coincide con quello salvato da questa scheda quando l'admin ha
// chiesto i link. Chiavi di accesso nell'hash (#access_token=...) non si
// accettano più: chiunque poteva costruirle e far entrare un utente in un
// altro account. L'indirizzo si ripulisce subito.
function ImpersonateCallbackContent() {
  const searchParams = useSearchParams()
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)
  // Il codice è monouso: una seconda esecuzione dell'effetto lo troverebbe già usato
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const run = async () => {
      const isRestore = searchParams.get('restore') === '1'

      const tokenHash = searchParams.get('th')
      const nonce = searchParams.get('n')
      window.history.replaceState(null, '', window.location.pathname)

      if (!tokenHash || !checkImpersonationNonce(nonce)) {
        setError('Link non valido per questa scheda. Riprova dal pannello Admin.')
        return
      }

      const { error: verifyError } = await createClient().auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      })
      if (verifyError) {
        setError(verifyError.message)
        return
      }

      // Di nuovo admin: l'impersonificazione è finita, nessun dato resta
      if (isRestore) {
        endImpersonation()
        clearImpersonationNonce()
      }

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

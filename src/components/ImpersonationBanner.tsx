'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Shield } from 'lucide-react'
import { endImpersonation, readImpersonation } from '@/lib/impersonation'
import { askConfirm } from '@/lib/confirm'

// Fascia arancione durante l'impersonificazione, in cima a ogni pagina.
// Fa parte della pagina (non galleggia sopra), così non copre l'intestazione.
// I dati stanno nella memoria della sola scheda (vedi lib/impersonation).
export default function ImpersonationBanner() {
  const t = useTranslations('dashboard')
  const [session, setSession] = useState<{ restoreUrl: string; adminName: string } | null>(null)

  // La memoria della scheda esiste solo nel browser, dopo l'apertura
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(readImpersonation())
  }, [])

  const handleExit = async () => {
    if (!(await askConfirm(t('exitImpersonation')))) return
    const restoreUrl = session?.restoreUrl
    endImpersonation()
    // Si chiude solo la sessione di questo browser: l'utente resta collegato
    // sui suoi dispositivi (senza scope 'local' lo si scollegava ovunque)
    await createClient().auth.signOut({ scope: 'local' })
    window.location.href = restoreUrl || '/login'
  }

  if (!session) return null

  return (
    <div className="relative z-40 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="bg-white/20 p-2 rounded-full flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm">{t('impersonationActive')}</p>
            <p className="text-xs text-amber-50 truncate">
              {t('impersonationDesc')}
              {session.adminName && <> {t('adminAccount')} <strong>{session.adminName}</strong></>}
            </p>
          </div>
        </div>
        <button
          onClick={handleExit}
          className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 hover:bg-orange-50 rounded-lg text-sm font-bold transition-colors shadow-md flex-shrink-0"
        >
          <Shield className="w-4 h-4" />
          {t('returnAdmin')}
        </button>
      </div>
    </div>
  )
}

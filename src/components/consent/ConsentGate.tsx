'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CONSENT_CHANGED_EVENT, CONSENT_OFF, hasConsent, openCookiePreferences, readConsent, type ConsentCategory, type ConsentConfig } from '@/lib/consent'

// Banner cookie impostato dall'Admin (acceso e categorie), passato dal layout
const ConsentContext = createContext<ConsentConfig>(CONSENT_OFF)

export function ConsentProvider({ config, children }: { config: ConsentConfig; children: React.ReactNode }) {
  return <ConsentContext.Provider value={config}>{children}</ConsentContext.Provider>
}

export function useConsentConfig(): ConsentConfig {
  return useContext(ConsentContext)
}

// true solo se la categoria è accesa e la persona l'ha accettata (si aggiorna
// appena cambia scelta). Da usare per caricare statistiche, pixel e simili.
export function useConsent(category: ConsentCategory): boolean {
  const config = useConsentConfig()
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    const update = () => setAllowed(hasConsent(category, config, readConsent()))
    update()
    window.addEventListener(CONSENT_CHANGED_EVENT, update)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, update)
  }, [category, config])
  return allowed
}

// Mostra (o carica) il contenuto solo dopo il consenso alla categoria
export default function ConsentGate({ category, children }: { category: ConsentCategory; children: React.ReactNode }) {
  return useConsent(category) ? <>{children}</> : null
}

// Link «Preferenze cookie» (piè di pagina, informativa): visibile solo
// quando il banner è acceso con cookie facoltativi
export function CookiePreferencesLink({ className }: { className?: string }) {
  const t = useTranslations('cookieConsent')
  const config = useConsentConfig()
  if (!config.enabled || !config.categories.length) return null
  return (
    <button type="button" onClick={openCookiePreferences} className={className}>
      {t('preferencesLink')}
    </button>
  )
}

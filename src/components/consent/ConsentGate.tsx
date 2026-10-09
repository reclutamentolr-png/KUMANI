'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CONSENT_CHANGED_EVENT, hasConsent, openCookiePreferences, OPTIONAL_CATEGORIES, readConsent, type ConsentCategory } from '@/lib/consent'

// true solo se la persona ha accettato quella categoria (si aggiorna appena
// cambia scelta). Da usare per caricare statistiche, pixel e simili.
export function useConsent(category: ConsentCategory): boolean {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    const update = () => setAllowed(hasConsent(category, readConsent()))
    update()
    window.addEventListener(CONSENT_CHANGED_EVENT, update)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, update)
  }, [category])
  return allowed
}

// Mostra (o carica) il contenuto solo dopo il consenso alla categoria
export default function ConsentGate({ category, children }: { category: ConsentCategory; children: React.ReactNode }) {
  return useConsent(category) ? <>{children}</> : null
}

// Link «Preferenze cookie» (piè di pagina, informativa): visibile solo
// quando il sito usa cookie facoltativi
export function CookiePreferencesLink({ className }: { className?: string }) {
  const t = useTranslations('cookieConsent')
  if (!OPTIONAL_CATEGORIES.length) return null
  return (
    <button type="button" onClick={openCookiePreferences} className={className}>
      {t('preferencesLink')}
    </button>
  )
}

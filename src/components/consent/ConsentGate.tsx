'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CONSENT_CHANGED_EVENT, hasConsent, openCookiePreferences, readConsent, type ConsentCategory } from '@/lib/consent'

// Categorie di cookie facoltativi accese dall'Admin, passate dal layout
const ActiveCategories = createContext<ConsentCategory[]>([])

export function ConsentProvider({ categories, children }: { categories: ConsentCategory[]; children: React.ReactNode }) {
  return <ActiveCategories.Provider value={categories}>{children}</ActiveCategories.Provider>
}

export function useActiveConsentCategories(): ConsentCategory[] {
  return useContext(ActiveCategories)
}

// true solo se la categoria è accesa e la persona l'ha accettata (si aggiorna
// appena cambia scelta). Da usare per caricare statistiche, pixel e simili.
export function useConsent(category: ConsentCategory): boolean {
  const active = useActiveConsentCategories()
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    const update = () => setAllowed(hasConsent(category, active, readConsent()))
    update()
    window.addEventListener(CONSENT_CHANGED_EVENT, update)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, update)
  }, [category, active])
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
  const active = useActiveConsentCategories()
  if (!active.length) return null
  return (
    <button type="button" onClick={openCookiePreferences} className={className}>
      {t('preferencesLink')}
    </button>
  )
}

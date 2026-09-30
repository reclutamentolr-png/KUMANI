'use client'

import { createContext, useContext } from 'react'

// Lingue attive del sito (decise dall'Admin), per il menu delle lingue
const EnabledLocalesContext = createContext<string[] | null>(null)

export function EnabledLocalesProvider({ locales, children }: { locales: string[]; children: React.ReactNode }) {
  return <EnabledLocalesContext.Provider value={locales}>{children}</EnabledLocalesContext.Provider>
}

export function useEnabledLocales(): string[] | null {
  return useContext(EnabledLocalesContext)
}

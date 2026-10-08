'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordToolOpen } from '@/app/actions/toolOpens'
import { locales } from '../../../i18n'

// Segna quale servizio viene aperto (una volta al giorno per servizio e per
// browser) per i «servizi più usati» di Admin → Panoramica. Nessun dato su
// cosa si fa dentro il servizio.

// Servizi con la pagina fuori da /marketplace
const OUTSIDE: Record<string, string> = {
  viaggi: 'travel',
  events: 'events',
  spotlight: 'spotlight',
  convivio: 'convivio',
  affinity: 'affinity',
  veritas: 'veritas',
}
const NOT_TOOLS = new Set(['category', 'preferiti'])

export function toolFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  if (segments[0] === 'marketplace') return segments[1] && !NOT_TOOLS.has(segments[1]) ? segments[1] : null
  return OUTSIDE[segments[0] ?? ''] ?? null
}

export default function ToolOpenTracker() {
  const pathname = usePathname()
  useEffect(() => {
    const tool = toolFromPath(pathname)
    if (!tool) return
    const key = `kumani-open:${tool}`
    const today = new Date().toISOString().slice(0, 10)
    try {
      if (localStorage.getItem(key) === today) return
      localStorage.setItem(key, today)
    } catch {
      // Senza memoria del browser si registra comunque (il database tiene una riga al giorno)
    }
    void recordToolOpen(tool)
  }, [pathname])
  return null
}

'use client'

import { useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatEventDate } from '@/lib/events'

// Fuso orario di chi guarda: letto solo nel browser (sul server resta null),
// così non ci sono differenze tra HTML del server e primo render del client.
const noopSubscribe = () => () => {}
const readViewerZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

export function useViewerTimeZone(): string | null {
  return useSyncExternalStore(noopSubscribe, readViewerZone, () => null)
}

// Orario nel fuso di chi guarda, mostrato solo se diverso da quello dell'evento.
export default function ViewerTime({ iso, timeZone, className = '' }: { iso: string; timeZone: string; className?: string }) {
  const t = useTranslations('events')
  const locale = useLocale()
  const viewerZone = useViewerTimeZone()
  if (!viewerZone || viewerZone === timeZone) return null
  // Stessa ora locale in entrambi i fusi (es. Roma e Parigi): nessuna nota.
  const here = formatEventDate(iso, viewerZone, locale)
  if (here === formatEventDate(iso, timeZone, locale)) return null
  return <p className={className}>{t('yourTime', { time: here })}</p>
}

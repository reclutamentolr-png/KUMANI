'use client'

import { useSyncExternalStore } from 'react'

// I grafici SVG si rimpiccioliscono con lo schermo: sul telefono (meno di
// 640px) scritte, margini e riquadri vengono ingranditi per restare leggibili.
const QUERY = '(max-width: 639px)'
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

export function useChartScale() {
  const small = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
  return small ? 1.8 : 1
}

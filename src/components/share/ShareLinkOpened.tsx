'use client'

import { useEffect } from 'react'
import { markShareLinkOpened } from '@/app/actions/shareLinks'

// Conta un'apertura del link corto dal browser: le anteprime che WhatsApp e
// i social scaricano per mostrare il link non contano (una volta per scheda)
export default function ShareLinkOpened({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `kumani_v_${slug}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // facoltativo
    }
    markShareLinkOpened(slug).catch(() => {})
  }, [slug])
  return null
}

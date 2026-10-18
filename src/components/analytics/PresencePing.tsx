'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { readImpersonation } from '@/lib/impersonation'
import { locales } from '../../../i18n'

// «In questo momento» (Admin → Uso reale): ogni scheda aperta manda un
// segnale ogni 45 secondi, solo con la pagina in primo piano, con un codice
// casuale della scheda (sessionStorage: niente cookie, niente IP, niente
// nome) e la pagina, senza codici o nomi personali (diventano «:id»). Anche
// per chi non ha l'account. Lo Staff non conta (lo scarta il database).
const EVERY_MS = 45_000
const ID_KEY = 'kumani_presence_id'

// Sezioni il cui sotto-percorso è una pagina fissa (es. /marketplace/svat);
// altrove il pezzo dopo è un codice o un nome e diventa «:id»
const KEEP_CHILD = new Set([
  'marketplace', 'strumenti', 'guida', 'community', 'dashboard', 'convivium', 'viaggi', 'documenti', 'scheda-attivita', 'events',
  'catalogo', 'servizi', 'wallet', 'billing', 'pro', 'pass', 'sorprese', 'spese-condivise', 'calendario-collegato', 'controlla', 'test-truffa',
])

export function presencePage(pathname: string): string {
  const segments = pathname.toLowerCase().split('/').filter(Boolean)
  if (segments[0] && locales.includes(segments[0])) segments.shift()
  const out: string[] = []
  for (const [i, seg] of segments.slice(0, 4).entries()) {
    out.push(i === 0 || (KEEP_CHILD.has(segments[i - 1]) && /^[a-z][a-z-]{1,30}$/.test(seg)) ? seg.slice(0, 40) : ':id')
  }
  return ('/' + out.join('/')).replace(/[^a-z0-9/:._-]/g, '').slice(0, 119)
}

function tabId(): string {
  try {
    const saved = sessionStorage.getItem(ID_KEY)
    if (saved && /^[a-z0-9]{16,40}$/.test(saved)) return saved
    const bytes = crypto.getRandomValues(new Uint8Array(12))
    const id = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
    sessionStorage.setItem(ID_KEY, id)
    return id
  } catch {
    return [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
}

export default function PresencePing() {
  const page = presencePage(usePathname())

  useEffect(() => {
    if (page.startsWith('/admin') || page.startsWith('/api') || readImpersonation()) return
    const supabase = createClient()
    const id = tabId()
    const device = (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024) || /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    const send = () => {
      if (document.visibilityState !== 'visible') return
      void supabase.rpc('presence_ping', { p_id: id, p_page: page, p_device: device }).then(() => {})
    }
    send()
    const timer = setInterval(send, EVERY_MS)
    const onVisibility = () => document.visibilityState === 'visible' && send()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [page])

  return null
}

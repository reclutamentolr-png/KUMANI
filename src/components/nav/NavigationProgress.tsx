'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Barra dorata in cima allo schermo appena si tocca un link interno: dà
// subito un segno che il clic è arrivato mentre il server prepara la pagina
// (es. «Torna ai servizi» → /servizi, che può richiedere 1-3 secondi).
// Si chiude quando cambia l'indirizzo; per sicurezza al massimo dopo 15 s.
export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }

  // Indirizzo cambiato: la barra si completa e sparisce
  useEffect(() => {
    clear()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fine della navigazione
    setState((s) => (s === 'loading' ? 'done' : s))
    timers.current.push(window.setTimeout(() => setState('idle'), 300))
  }, [pathname, searchParams])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      // Stessa pagina (solo un'ancora o nessun cambio): niente barra
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      clear()
      setState('loading')
      timers.current.push(window.setTimeout(() => setState('idle'), 15000))
    }
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      clear()
    }
  }, [])

  if (state === 'idle') return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className={`h-full bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)] shadow-[0_0_8px_rgba(212,175,55,0.7)] ${
          state === 'loading' ? 'animate-[navprogress_8s_cubic-bezier(0.1,0.7,0.2,1)_forwards]' : 'w-full opacity-0 transition-opacity duration-300'
        }`}
      />
    </div>
  )
}

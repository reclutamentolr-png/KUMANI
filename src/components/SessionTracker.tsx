'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { readImpersonation } from '@/lib/impersonation'

// Sessioni d'uso per il «Tempo medio per sessione» dell'Admin: un segnale
// leggero al minuto, solo con la pagina in primo piano, più uno quando si
// esce dalla pagina. Il database raggruppa i segnali in sessioni (30 minuti
// senza attività chiudono la sessione) e non conta lo Staff.
const EVERY_MS = 60 * 1000

export default function SessionTracker() {
  const locale = useLocale()

  // Lingua in cui la persona usa KUMANI: serve per mandarle le comunicazioni
  // nella sua lingua. Si salva solo se è cambiata (ricordata nel browser).
  useEffect(() => {
    const KEY = 'kumani-locale-saved'
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session || readImpersonation()) return
      try {
        if (localStorage.getItem(KEY) === `${data.session.user.id}:${locale}`) return
      } catch {
        // memoria del browser non disponibile: si salva lo stesso
      }
      void supabase.rpc('set_my_locale', { p_locale: locale }).then(({ error }) => {
        if (error) return
        try {
          localStorage.setItem(KEY, `${data.session!.user.id}:${locale}`)
        } catch {
          // niente
        }
      })
    })
  }, [locale])

  useEffect(() => {
    const supabase = createClient()
    let token: string | null = null
    let member = false
    let lastPing = 0
    let timer: ReturnType<typeof setInterval> | null = null
    const device = () =>
      (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024) || /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'

    const ping = () => {
      if (!member || document.visibilityState !== 'visible' || readImpersonation()) return
      if (Date.now() - lastPing < 20_000) return
      lastPing = Date.now()
      void supabase.rpc('session_ping', { p_device: device() }).then(() => {})
    }

    // Uscendo dalla pagina: ultimo segnale che arriva anche se la pagina si chiude
    const leave = () => {
      if (!member || !token || document.visibilityState !== 'hidden' || readImpersonation()) return
      if (Date.now() - lastPing < 15_000) return
      lastPing = Date.now()
      try {
        void fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/session_ping`, {
          method: 'POST',
          keepalive: true,
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_device: device() }),
        }).catch(() => {})
      } catch {
        // il segnale finale è facoltativo
      }
    }

    const onVisibility = () => (document.visibilityState === 'visible' ? ping() : leave())

    const update = (session: Session | null) => {
      const role = (session?.user.app_metadata as { role?: string } | undefined)?.role
      member = !!session && role !== 'agent' && role !== 'translator' && role !== 'guest'
      token = session?.access_token ?? null
      if (member && !timer) {
        ping()
        timer = setInterval(ping, EVERY_MS)
      }
      if (!member && timer) {
        clearInterval(timer)
        timer = null
      }
    }
    supabase.auth.getSession().then(({ data }) => update(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => update(session))
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', leave)
    return () => {
      if (timer) clearInterval(timer)
      data.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', leave)
    }
  }, [])

  return null
}

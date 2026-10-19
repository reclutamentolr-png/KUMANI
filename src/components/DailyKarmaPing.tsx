'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { readImpersonation } from '@/lib/impersonation'

// KU Karma dell'accesso giornaliero anche per chi resta connesso: alla prima
// visita del giorno (ora di Roma), con la pagina in primo piano, e di nuovo
// dopo la mezzanotte se la scheda resta aperta. Prima arrivava solo dalla
// pagina di Login, quindi chi restava connesso (o usava l'app installata) non
// lo riceveva più. «Uno al giorno» lo garantisce award_daily_login_point()
// nel database; il browser ricorda solo che oggi è già stato chiesto, per non
// richiederlo a ogni pagina. Esclusi Staff in impersonificazione, agenti,
// traduttori e ospiti.
const CHECK_MS = 5 * 60 * 1000
const romeToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())

export default function DailyKarmaPing() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let userId: string | null = null
    let busy = false
    const keyOf = (id: string) => `kumani_daily_karma:${id}`

    const claim = async () => {
      if (!userId || busy || document.visibilityState !== 'visible' || readImpersonation()) return
      const today = romeToday()
      try {
        if (localStorage.getItem(keyOf(userId)) === today) return
      } catch {
        // senza memoria del browser si chiede comunque (il database decide)
      }
      busy = true
      const id = userId
      const { data, error } = await supabase.rpc('award_daily_login_point').maybeSingle<{ awarded: boolean; new_daily_points: number }>()
      busy = false
      if (error || !data) return
      try {
        localStorage.setItem(keyOf(id), today)
      } catch {
        // facoltativo
      }
      // Punto appena arrivato: si aggiornano i numeri della pagina (Karma di oggi)
      if (data.awarded) router.refresh()
    }

    const update = (session: Session | null) => {
      const role = (session?.user.app_metadata as { role?: string } | undefined)?.role
      userId = session && role !== 'agent' && role !== 'translator' && role !== 'guest' ? session.user.id : null
      void claim()
    }

    supabase.auth.getSession().then(({ data }) => update(data.session))
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => update(session))
    const onVisibility = () => void claim()
    document.addEventListener('visibilitychange', onVisibility)
    const timer = setInterval(() => void claim(), CHECK_MS)
    return () => {
      auth.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(timer)
    }
  }, [router])

  return null
}

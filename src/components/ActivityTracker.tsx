'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readImpersonation } from '@/lib/impersonation'
import { useRouter } from 'next/navigation'
import { awardDailyPoint } from '@/app/actions/award-daily-point'

type ActivityTrackerProps = {
  userId: string
}

// "Ultimo accesso" (profiles.last_seen): serve all'Admin per contare chi è
// online negli ultimi 15 minuti. Basta aggiornarlo ogni 5 minuti e solo con
// la pagina in primo piano (prima: una scrittura al minuto anche con la
// scheda in secondo piano).
const EVERY_MS = 5 * 60 * 1000

export default function ActivityTracker({ userId }: ActivityTrackerProps) {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    let lastUpdate = 0

    const updateLastSeen = () => {
      if (document.visibilityState !== 'visible') return
      // Lo Staff che impersona non deve far risultare l'utente online
      if (readImpersonation()) return
      if (Date.now() - lastUpdate < EVERY_MS - 1000) return
      lastUpdate = Date.now()
      void supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {})
    }

    // KU Karma dell'accesso (+1 al giorno) e giorni di accesso: anche per chi
    // arriva dalla registrazione o resta collegato senza passare dal login.
    // Una chiamata al giorno per scheda; il server non assegna mai due volte.
    const awardToday = () => {
      if (document.visibilityState !== 'visible' || readImpersonation()) return
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
      const key = `kumani_daily_point_${userId}`
      try {
        if (sessionStorage.getItem(key) === day) return
        sessionStorage.setItem(key, day)
      } catch {
        // memoria della scheda non disponibile: chiede lo stesso
      }
      awardDailyPoint()
        .then((r) => {
          if (r.success) router.refresh()
        })
        .catch(() => {})
    }

    updateLastSeen()
    awardToday()
    const interval = setInterval(() => {
      updateLastSeen()
      awardToday()
    }, EVERY_MS)
    // Tornando sulla scheda dopo un po' (anche il giorno dopo), si aggiorna subito
    const onVisible = () => {
      updateLastSeen()
      awardToday()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, router])

  return null // Componente invisibile
}
